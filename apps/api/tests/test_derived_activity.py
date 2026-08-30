"""Unit tests for the Hi-C-derived expression/ChIP/ATAC activity proxy.

Each test builds a synthetic log1p Hi-C sub-matrix, runs
:class:`ExpressionActivityStrategy`, and checks the per-bin activity
contract:

* ``kind == "activity_signal"``
* ``values`` is float32 in ``[0, 1]`` of the original N bins
* ``extra["source"] == "ab_proxy"`` and the caveat note is present
* a clean A/B block pattern produces higher activity on the A side

No fixtures, no real data — these tests run in tens of milliseconds.
"""

from __future__ import annotations

import numpy as np

from app.real_data.derived import HiCCoords
from app.real_data.derived.activity import ExpressionActivityStrategy


# ---------------------------------------------------------------------------
# Synthetic matrix builders
# ---------------------------------------------------------------------------

def make_smooth_matrix(
    n: int,
    decay: float = 0.05,
    seed: int = 0,
) -> np.ndarray:
    """Build a log1p Hi-C-like matrix with strong diagonal decay."""
    rng = np.random.default_rng(seed)
    base = rng.uniform(0.5, 2.0, size=(n, n)).astype(np.float32)
    base = (base + base.T) / 2
    dist = np.abs(np.subtract.outer(np.arange(n), np.arange(n))).astype(np.float32)
    base *= np.exp(-dist * decay)
    base += np.eye(n, dtype=np.float32) * 5
    return np.log1p(base)


def make_ab_block_matrix(n: int, half_level: float = 2.0) -> np.ndarray:
    """Build a (n, n) matrix with one A-like half and one B-like half.

    Within the A half (bins 0..n/2-1), within-block contact is high
    (``half_level``); within the B half (bins n/2..n-1) it's
    lower (``half_level * 0.25``); between-block contact is uniformly
    low (0.1). A diagonal bias is added so that the log1p matrix is
    numerically pleasant.
    """
    base = np.full((n, n), 0.1, dtype=np.float32)
    half = n // 2
    for i in range(n):
        for j in range(n):
            if (i < half) == (j < half):
                base[i, j] = half_level if i < half else half_level * 0.25
    base += np.eye(n, dtype=np.float32) * 0.1
    return np.log1p(base)


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------

def test_activity_shape_and_range() -> None:
    """Output is shape (N,), float32, in [0, 1+ε]."""
    coords = HiCCoords(chrom="chr1", start=0, end=60_000, bin_size=1_000)
    mat = make_smooth_matrix(60, seed=0)
    result = ExpressionActivityStrategy().compute(coords, {"mat": mat})
    assert result.kind == "activity_signal"
    assert result.values.shape == (60,)
    assert result.values.dtype == np.float32
    assert (result.values >= 0).all()
    assert (result.values <= 1.0 + 1e-6).all()


def test_activity_source_marker() -> None:
    """``extra`` must mark source ``ab_proxy`` and note that it is not real."""
    coords = HiCCoords(chrom="chr1", start=0, end=60_000, bin_size=1_000)
    mat = make_smooth_matrix(60, seed=1)
    result = ExpressionActivityStrategy().compute(coords, {"mat": mat})
    assert result.extra["source"] == "ab_proxy"
    assert "not real" in result.extra["note"]


def test_activity_block_structure() -> None:
    """An A/B block matrix gives higher activity on the A side than the B side.

    Uses an 80×80 matrix with ``bin_size=100_000`` so the default 500 kb
    coarsening produces 16 coarsened bins (8 in the A half, 8 in the B
    half) — enough resolution for the PC1 to separate the two compartments.
    """
    n = 80
    coords = HiCCoords(
        chrom="chr1", start=0, end=n * 100_000, bin_size=100_000
    )
    mat = make_ab_block_matrix(n, half_level=2.0)
    result = ExpressionActivityStrategy().compute(coords, {"mat": mat})
    assert result.kind == "activity_signal"
    a_mean = float(result.values[:40].mean())
    b_mean = float(result.values[40:].mean())
    assert a_mean > b_mean + 0.05, (
        f"expected A-half activity > B-half + 0.05; got A={a_mean:.4f}, "
        f"B={b_mean:.4f}"
    )


def test_activity_short_returns_zeros() -> None:
    """Below the coarsening threshold the strategy returns zeros of length N."""
    # n=2 with bin_size=200_000 → factor = 500_000 // 200_000 = 2,
    # factor * 3 = 6 > 2 → zero output (length N).
    coords = HiCCoords(chrom="chr1", start=0, end=2 * 200_000, bin_size=200_000)
    mat = np.zeros((2, 2), dtype=np.float32)
    result = ExpressionActivityStrategy().compute(coords, {"mat": mat})
    assert result.kind == "activity_signal"
    assert result.values.shape == (2,)
    assert result.values.dtype == np.float32
    np.testing.assert_array_equal(
        result.values,
        np.zeros(2, dtype=np.float32),
    )
