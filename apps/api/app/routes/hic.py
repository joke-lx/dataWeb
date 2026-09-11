"""``GET /api/hic/matrix`` — Hi-C contact matrix as float32 bytes.

Query parameters
----------------
``sample`` : sample id (e.g. ``Brain_BF3``)
``chr``    : chromosome (e.g. ``chr1``)
``start``  : 1-based inclusive start in bp
``end``    : 1-based exclusive end in bp
``bin``    : bin size in bp
``normalization`` : one of ``log2`` (default) / ``raw`` / ``ice``.

The reader layer always returns the matrix in ``log1p`` (natural-log) space
along with ``(vmin, vmax)``. This endpoint re-projects that matrix according to
the requested display normalization before streaming it out:

* ``log2`` — convert ``ln(1+x)`` to ``log2(1+x)`` (colour scale in log2 units).
* ``raw``  — invert ``log1p`` back to raw contact counts; ``vmin=0``,
  ``vmax = 99th percentile`` of the raw submatrix.
* ``ice``  — invert ``log1p``, apply a symmetric Sinkhorn (ICE) row/column
  balancing, then re-apply ``log1p`` so colour mapping stays in log space.

The response body is the raw little-endian ``float32`` matrix (row-major),
with shape and colour-range metadata in custom headers:

* ``X-Genomics-Dtype`` — ``float32``
* ``X-Genomics-Shape`` — ``"{rows},{cols}"``
* ``X-Genomics-Vmin``  — colour lower bound
* ``X-Genomics-Vmax``  — colour upper bound (99th percentile of the chosen space)

Data sources (real first, mock fallback):
    When a converted real-data cache exists for the sample/chromosome
    (``{hic_matrix_root}/npy/{sample}.chr{N}.20kb.npy``, produced by
    ``scripts/convert_hic_matrix.py``) the submatrix is sliced from it via
    mmap. Regions beyond the file's coverage return an empty ``0×0`` matrix
    rather than synthetic values. Only when no cache exists at all does the
    deterministic mock generator serve the request.
"""

from __future__ import annotations

import logging
from typing import Literal

import numpy as np
from fastapi import APIRouter, Query
from fastapi.responses import Response

from app.mock import hic_matrix
from app.real_data.hic_reader import read_hic_matrix

router = APIRouter(prefix="/api", tags=["hic"])
logger = logging.getLogger(__name__)

Normalization = Literal["log2", "raw", "ice"]


def _ice_balance(mat: np.ndarray, iters: int = 8) -> np.ndarray:
    """Symmetric Sinkhorn-Knopp balancing (a lightweight ICE approximation).

    Divides each row/column by its marginal sum so every bin contributes
    equally. Zero-sum rows are left untouched to avoid division by zero.
    """
    m = mat.astype(np.float64, copy=True)
    n = m.shape[0]
    if n == 0:
        return m
    for _ in range(iters):
        row_sum = m.sum(axis=1)
        col_sum = m.sum(axis=0)
        row_safe = np.where(row_sum > 0, row_sum, 1.0)
        col_safe = np.where(col_sum > 0, col_sum, 1.0)
        # Outer product of marginals — same factor for symmetric matrices.
        factor = np.outer(row_safe, col_safe)
        m = m / factor
    return m


def apply_normalization(
    mat: np.ndarray, mode: Normalization
) -> tuple[np.ndarray, float, float]:
    """Re-project a ``log1p``-scaled submatrix into the requested display space.

    Returns ``(float32 matrix, vmin, vmax)`` where ``vmax`` is the 99th
    percentile (the client's colour-map upper bound).
    """
    if mat.size == 0 or mat.shape[0] == 0:
        return mat.astype(np.float32), 0.0, 1.0

    # NOTE: vmin/vmax must be computed on the SAME float32 array that is
    # streamed out, so the header values round-trip exactly to what the client
    # decodes (test_hic_matrix_... asserts header vmin == decoded matrix min).
    if mode == "raw":
        # Invert log1p back to raw contact counts.
        raw = np.expm1(mat.astype(np.float64))
        raw = np.maximum(raw, 0.0)
        result = raw.astype(np.float32)
        vmin = 0.0
        vmax = float(np.percentile(result, 99))
        if vmax <= vmin:
            vmax = vmin + 1.0
        return result, vmin, vmax

    if mode == "ice":
        raw = np.expm1(mat.astype(np.float64))
        raw = np.maximum(raw, 0.0)
        balanced = _ice_balance(raw)
        result = np.log1p(balanced).astype(np.float32)
        vmin = float(result.min())
        vmax = float(np.percentile(result, 99))
        if vmax <= vmin:
            vmax = vmin + 1.0
        return result, vmin, vmax

    # default: log2 — convert ln(1+x) to log2(1+x).
    result = (mat.astype(np.float64) / np.log(2.0)).astype(np.float32)
    vmin = float(result.min())
    vmax = float(np.percentile(result, 99))
    if vmax <= vmin:
        vmax = vmin + 1.0
    return result, vmin, vmax


@router.get("/hic/matrix")
async def hic_matrix_endpoint(
    sample: str = Query(..., description="Sample id, e.g. Brain_BF3"),
    chr: str = Query(..., alias="chr", description="Chromosome name"),
    start: int = Query(..., ge=0, description="Region start (bp, 0-based)"),
    end: int = Query(..., gt=0, description="Region end (bp, exclusive)"),
    bin: int = Query(..., gt=0, alias="bin", description="Bin size in bp"),
    normalization: Normalization = Query(
        "log2", description="Display normalization: log2 / raw / ice"
    ),
) -> Response:
    """Return the Hi-C contact matrix as raw float32 bytes."""
    try:
        mat, _vmin, _vmax = read_hic_matrix(sample, chr, start, end, bin)
    except FileNotFoundError as error:
        logger.debug("Falling back to mock hic for %s/%s: %s", sample, chr, error)
        mat, _vmin, _vmax = hic_matrix(sample, chr, start, end, bin)

    mat, vmin, vmax = apply_normalization(mat, normalization)
    return Response(
        content=mat.tobytes(),
        media_type="application/octet-stream",
        headers={
            "X-Genomics-Dtype": "float32",
            "X-Genomics-Shape": f"{mat.shape[0]},{mat.shape[1]}",
            "X-Genomics-Vmin": str(vmin),
            "X-Genomics-Vmax": str(vmax),
        },
    )
