"""Unit tests for the 3D-structure derived strategy.

Each test builds a small synthetic log1p Hi-C sub-matrix and asserts the
ShRec3D-style classical-MDS pipeline returns a well-formed ``(N, 3)``
float32 result. No fixtures, no network, no real data: these tests run in
well under 1 s total.
"""

from __future__ import annotations

import numpy as np

from app.real_data.derived import DerivedResult, HiCCoords
from app.real_data.derived.three_d import ThreeDStructureStrategy


def _random_log1p(n: int, seed: int) -> np.ndarray:
    """Symmetric log1p matrix with diagonal decay and small per-bin noise."""
    rng = np.random.default_rng(seed)
    base = rng.uniform(0.0, 1.0, size=(n, n)).astype(np.float32)
    base = (base + base.T) / 2  # symmetric
    dist = np.abs(np.subtract.outer(np.arange(n), np.arange(n))).astype(np.float32)
    base *= np.exp(-dist * 0.05)
    base += np.eye(n, dtype=np.float32) * 5.0
    return np.log1p(base)


def _two_block_log1p(n: int) -> np.ndarray:
    """Symmetric log1p matrix with two clearly separated correlation blocks.

    Columns 0..n/2-1 share one contact profile (high within-block, low
    cross-block); columns n/2..n-1 share the opposite profile. Column
    correlations are therefore ~+1 within a block and ~-1 across blocks,
    which MDS translates into two spatially distinct clusters.
    """
    base = np.zeros((n, n), dtype=np.float32)
    half = n // 2
    for i in range(n):
        for j in range(n):
            if (i < half) == (j < half):
                base[i, j] = 1.0
            else:
                base[i, j] = 0.1
    base += np.eye(n, dtype=np.float32) * 0.1
    return np.log1p(base)


def test_three_d_shape_and_dtype() -> None:
    """A small (5, 5) matrix yields a (5, 3) float32 result with the right kind."""
    coords = HiCCoords(chrom="chr1", start=0, end=5 * 20_000, bin_size=20_000)
    mat = _random_log1p(5, seed=0)
    result = ThreeDStructureStrategy().compute(coords, {"mat": mat})
    assert isinstance(result, DerivedResult)
    assert result.kind == "matrix3d"
    assert result.values.shape == (5, 3)
    assert result.values.dtype == np.float32
    assert result.extra["n_bins"] == 5


def test_three_d_centred_and_bounded() -> None:
    """Random 30x30 matrix: centroid at origin and max |coord| <= 1."""
    coords = HiCCoords(chrom="chr1", start=0, end=30 * 20_000, bin_size=20_000)
    mat = _random_log1p(30, seed=1)
    result = ThreeDStructureStrategy().compute(coords, {"mat": mat})
    assert result.values.shape == (30, 3)
    # Centred: per-axis mean is ~0 (rotation through MDS is degenerate
    # in sign, so use absolute mean).
    assert np.abs(result.values.mean(axis=0)).max() < 0.1
    # Bounded: max |coord| <= 1 + tiny float round-off.
    assert float(np.abs(result.values).max()) <= 1.0 + 1e-5


def test_three_d_too_small_returns_zeros() -> None:
    """A (2, 2) matrix has no 3D structure -> all-zero (2, 3) output."""
    coords = HiCCoords(chrom="chr1", start=0, end=2 * 20_000, bin_size=20_000)
    mat = np.log1p(np.ones((2, 2), dtype=np.float32) * 2.0)
    result = ThreeDStructureStrategy().compute(coords, {"mat": mat})
    assert result.kind == "matrix3d"
    assert result.values.shape == (2, 3)
    assert result.values.dtype == np.float32
    np.testing.assert_array_equal(
        result.values, np.zeros((2, 3), dtype=np.float32)
    )
    assert result.extra["n_bins"] == 2


def test_three_d_block_diagonal_structure() -> None:
    """Two-cluster input: MDS separates the two cluster means in 3D."""
    coords = HiCCoords(chrom="chr1", start=0, end=60 * 20_000, bin_size=20_000)
    mat = _two_block_log1p(60)
    result = ThreeDStructureStrategy().compute(coords, {"mat": mat})
    assert result.values.shape == (60, 3)
    cluster_0 = result.values[:30].mean(axis=0)
    cluster_1 = result.values[30:].mean(axis=0)
    assert float(np.linalg.norm(cluster_1 - cluster_0)) > 0.3
