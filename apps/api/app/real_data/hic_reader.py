"""Real Hi-C matrix reader — mmap-backed submatrix extraction.

The raw ``.quantile`` TSVs (see ``scripts/convert_hic_matrix.py``) are too
large to parse per request, so they are converted once into float32 ``.npy``
files under ``{hic_matrix_root}/npy/{sample}.chr{N}.20kb.npy``. This reader
memory-maps those caches and slices the requested region in O(1).

Resolution contract
-------------------
* The matrices are fixed at 20 kb bins.
* ``bin < 20 kb``  → clamped to 20 kb (cannot fabricate finer data).
* ``bin > 20 kb``  → neighbouring blocks are pooled with a mean.
* Regions beyond the file's coverage → empty ``0×0`` matrix (the client
  renders "no data"; it never falls back to synthetic values).
"""

from __future__ import annotations

import functools
import math
import os
from pathlib import Path
from typing import Optional

import numpy as np

from .sample_resolver import load_registry, normalize_chr

BIN_SIZE = 20_000
NPY_DIRNAME = "npy"
NPY_SUFFIX = "20kb.npy"


def hic_matrix_root() -> Optional[Path]:
    """Root dir holding the ``npy`` subdirectory of converted Hi-C caches.

    Resolution order (same pattern as ``DATAWEB_DATA_ROOT``):
      1. ``DATAWEB_HIC_ROOT`` env var (highest priority) — lets local dev
         point at a Windows path while the registry keeps the container
         path (``/data/hic``) for deployment.
      2. ``hic_matrix_root`` key in ``registry.yaml`` (container default).
      3. ``None`` — Hi-C route falls back to mock.

    The returned path is the *parent* of the ``npy/`` cache directory
    (matching the registry value ``/data/hic`` → caches at ``/data/hic/npy``).
    """
    env = os.environ.get("DATAWEB_HIC_ROOT")
    if env:
        return Path(env)
    root = load_registry().get("hic_matrix_root")
    return Path(root) if root else None


@functools.lru_cache(maxsize=8)
def _load_npy(path_str: str) -> np.ndarray:
    """Memory-map one chromosome cache (cached — mmap pages are shared)."""
    return np.load(path_str, mmap_mode="r")


def _npy_path(sample_id: str, chrom_norm: str) -> Optional[Path]:
    root = hic_matrix_root()
    if root is None:
        return None
    chrom_num = chrom_norm.removeprefix("chr")
    path = root / NPY_DIRNAME / f"{sample_id}.chr{chrom_num}.{NPY_SUFFIX}"
    return path if path.exists() else None


def read_hic_matrix(
    sample_id: str,
    chrom: str,
    start: int,
    end: int,
    bin_bp: int,
) -> tuple[np.ndarray, float, float]:
    """Slice ``[start, end) × [start, end)`` from the real matrix.

    Returns ``(matrix, vmin, vmax)`` where the matrix is ``log1p``-scaled
    float32 (matching the mock contract) and ``vmin``/``vmax`` are the
    submatrix minimum and 99th percentile.

    Raises ``FileNotFoundError`` when no converted cache exists for the
    sample/chromosome — the route then falls back to the mock generator.
    """
    chrom_norm = normalize_chr(chrom)
    path = _npy_path(sample_id, chrom_norm)
    if path is None:
        raise FileNotFoundError(f"no hic npy for {sample_id}/{chrom_norm}")

    full = _load_npy(str(path))
    n_bins = full.shape[0]

    # 请求区间 → 方阵行列范围;先裁到文件覆盖范围。
    r0 = max(0, start // BIN_SIZE)
    r1 = min(n_bins, -(-end // BIN_SIZE))  # ceil
    if r1 <= r0:
        return np.zeros((0, 0), dtype=np.float32), 0.0, 1.0

    sub = np.asarray(full[r0:r1, r0:r1], dtype=np.float32)

    # 分辨率:请求 bin 换算成聚合因子(≥1)。
    factor = max(1, math.floor(bin_bp / BIN_SIZE))
    if factor > 1:
        usable = (sub.shape[0] // factor) * factor
        if usable == 0:
            return np.zeros((0, 0), dtype=np.float32), 0.0, 1.0
        trimmed = sub[:usable, :usable]
        sub = trimmed.reshape(
            usable // factor, factor, usable // factor, factor
        ).mean(axis=(1, 3))

    # 与 mock 管线一致:log1p 后 vmin = min,vmax = p99。
    scaled = np.log1p(sub)
    vmin = float(scaled.min())
    vmax = float(np.percentile(scaled, 99))
    if vmax <= vmin:
        vmax = vmin + 1.0
    return scaled.astype(np.float32), vmin, vmax
