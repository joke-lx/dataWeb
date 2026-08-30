"""Unit tests for the CTCF loop derived strategy.

Each test crafts a small synthetic Hi-C sub-matrix with a known loop
structure (uniform background, injected spike, diagonal-only, two
nearby peaks) and asserts the strategy recovers what the algorithm
contract promises. The tests run in <100 ms and lock in the per-pixel
output shape plus the diagonal / dedup guarantees.
"""

from __future__ import annotations

import numpy as np

from app.real_data.derived import DerivedResult, HiCCoords
from app.real_data.derived.ctcf_loop import CTCFLoopStrategy


# ---------------------------------------------------------------------------
# Test 1 — uniform matrix -> no loops, correct output shape & kind
# ---------------------------------------------------------------------------

def test_loops_shape_and_kind() -> None:
    """A 20x20 matrix with zero enrichment returns 0 loops.

    A constant matrix has bg == mat everywhere, so every pixel's
    enrichment ratio collapses to ~1, below the 1.5 threshold.
    """
    coords = HiCCoords(chrom="chr1", start=0, end=400_000, bin_size=20_000)
    mat = np.log1p(np.full((20, 20), 2.0, dtype=np.float32))
    result = CTCFLoopStrategy().compute(coords, {"mat": mat})
    assert isinstance(result, DerivedResult)
    assert result.kind == "loops"
    assert result.extra["n_loops"] == 0
    # Empty object array flattens to a JSON-serializable empty list.
    assert result.values.tolist() == []


# ---------------------------------------------------------------------------
# Test 2 — injected 3x3 spike -> loop at (10, 20)
# ---------------------------------------------------------------------------

def test_loops_detects_injected_peak() -> None:
    """A 3x3 spike about 4x the local background must produce a loop.

    The spike is 3x3 constant pixels, so all 9 spike cells have the same
    enrichment ratio. The dedup step must pick the centre cell (10, 20)
    as the loop representative — that's where the centroid of the cluster
    lands.
    """
    coords = HiCCoords(chrom="chr1", start=0, end=800_000, bin_size=20_000)
    n = 40
    # Log1p domain: linear 0.5 vs linear 2.0 is a 4x ratio in raw contacts.
    # In log1p space the ratio collapses a bit (still well above 1.5).
    mat = np.log1p(np.full((n, n), 0.5, dtype=np.float32))  # ~0.405
    mat[9:12, 19:22] = np.log1p(2.0)  # 3x3 spike at (10, 20), ~1.099

    result = CTCFLoopStrategy().compute(coords, {"mat": mat})
    assert result.kind == "loops"

    loops = result.values.tolist()
    assert any(
        loop["anchor1"] == 10 and loop["anchor2"] == 20
        for loop in loops
    ), f"expected a loop at (10, 20); got {loops}"


# ---------------------------------------------------------------------------
# Test 3 — diagonal-only enrichment -> nothing returned
# ---------------------------------------------------------------------------

def test_loops_skips_diagonal() -> None:
    """A matrix with a huge diagonal must still produce no loops.

    The diagonal filter (|i - j| > 2) must remove every cell on the main
    diagonal and the 2 nearest sub-diagonals before thresholding, so a
    matrix where the diagonal dwarfs the background yields zero loops.
    """
    coords = HiCCoords(chrom="chr1", start=0, end=600_000, bin_size=20_000)
    n = 30
    mat = np.zeros((n, n), dtype=np.float32)
    np.fill_diagonal(mat, np.log1p(10.0))  # diagonal ~2.4 vs 0 background

    result = CTCFLoopStrategy().compute(coords, {"mat": mat})
    assert result.kind == "loops"
    assert result.extra["n_loops"] == 0
    for loop in result.values.tolist():
        # Every returned loop must be off the diagonal beyond 2 bins.
        assert abs(loop["anchor1"] - loop["anchor2"]) > 2, (
            f"diagonal pixel {loop} should have been filtered out"
        )


# ---------------------------------------------------------------------------
# Test 4 — two nearby peaks -> dedup collapses to a single loop
# ---------------------------------------------------------------------------

def test_loops_deduplicates() -> None:
    """Two peaks 1 bin apart must collapse to one loop.

    The greedy dedup step claims both candidate pixels into a single
    +/-5-bin Chebyshev cluster and picks a single representative. The
    upper-triangle diagonal filter additionally merges the symmetric
    counterparts (20, 10)/(21, 11), so the final count is exactly 1.
    """
    coords = HiCCoords(chrom="chr1", start=0, end=800_000, bin_size=20_000)
    n = 40
    mat = np.log1p(np.full((n, n), 0.5, dtype=np.float32))
    # Inject two adjacent peaks (same loop, 1 bin shifted). They share
    # the same ~4x local-background enrichment, so r is tied.
    mat[10, 20] = np.log1p(2.0)
    mat[11, 21] = np.log1p(2.0)

    result = CTCFLoopStrategy().compute(coords, {"mat": mat})
    assert result.kind == "loops"
    loops = result.values.tolist()
    assert len(loops) == 1, f"expected 1 loop after dedup; got {loops}"
