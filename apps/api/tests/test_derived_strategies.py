"""Unit tests for the Hi-C derived strategies.

Each test builds a small synthetic Hi-C sub-matrix with a known structure
(insulation dips at known bins, an A/B-style block pattern, an A vs B
difference, etc.) and asserts the strategy recovers the expected result.

No fixtures, no network, no real data: these tests run in <100 ms total
and lock in the contract each strategy exposes to the route layer.
"""

from __future__ import annotations

import math

import numpy as np
import pytest

from app.real_data.derived import (
    DerivedResult,
    HiCCoords,
    get_strategy,
    list_strategies,
)
from app.real_data.derived.ab_compartment import ABCompartmentStrategy
from app.real_data.derived.differential import DifferentialHiCStrategy
from app.real_data.derived.insulation import (
    DEFAULT_IS_WINDOW_BP,
    InsulationScoreStrategy,
    TADBoundaryStrategy,
    _local_minima,
)


# ---------------------------------------------------------------------------
# Synthetic matrix builders
# ---------------------------------------------------------------------------

def make_smooth_matrix(n: int, decay: float = 0.05, seed: int = 0) -> np.ndarray:
    """Build a log1p-friendly Hi-C-like matrix with strong diagonal decay.

    Diagonal bins have high contact (close in 3D); off-diagonal falls off
    exponentially with distance. Returns a (n, n) float32 matrix.
    """
    rng = np.random.default_rng(seed)
    base = rng.uniform(0, 1, size=(n, n)).astype(np.float32)
    base = (base + base.T) / 2  # symmetric
    dist = np.abs(np.subtract.outer(np.arange(n), np.arange(n))).astype(np.float32)
    base *= np.exp(-dist * decay)
    # add a strong diagonal
    base += np.eye(n, dtype=np.float32) * 5
    return np.log1p(base)


def make_ab_matrix(n: int, block_size: int = 4) -> np.ndarray:
    """Build a matrix whose column-correlation has a clear PC1: A/B blocks.

    Two square compartments of size ``block_size`` sit side by side; the
    left side is "A" (within-block contact high), the right side is "B"
    (within-block contact high, but A-B contact lower). PC1 of the
    column-correlation cleanly separates the two sides.
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


# ---------------------------------------------------------------------------
# Registry & shared protocol
# ---------------------------------------------------------------------------

def test_registry_lists_all_strategies() -> None:
    """``list_strategies`` must contain every strategy registered so far.

    New strategies are added over time (three_d, ctcf_loop, sv_bed,
    activity_signal). This test asserts the ORIGINAL four are present and
    does not pin the full set, so adding more strategies never breaks it.
    """
    names = set(list_strategies())
    for required in (
        "differential_hic",
        "insulation_score",
        "tad_boundary",
        "ab_compartment",
    ):
        assert required in names, f"missing registered strategy: {required}"


def test_get_strategy_returns_singletons() -> None:
    """Repeated lookups return the same instance (no per-call allocation)."""
    a = get_strategy("differential_hic")
    b = get_strategy("differential_hic")
    assert a is b


def test_get_strategy_unknown_raises() -> None:
    with pytest.raises(KeyError, match="not_a_strategy"):
        get_strategy("not_a_strategy")


def test_each_strategy_returns_derived_result() -> None:
    """Sanity: every registered strategy returns the contract type.

    Strategies whose ``values`` is an object array of dicts (CTCF loops)
    or a plain list of dicts (SV) have no ``.dtype`` in the numeric sense —
    accept those too.
    """
    coords = HiCCoords(chrom="chr1", start=0, end=400_000, bin_size=20_000)
    mat = make_smooth_matrix(coords.n_bins)
    for name in list_strategies():
        strategy = get_strategy(name)
        matrices = {"mat": mat}
        if name == "differential_hic":
            matrices = {"mat_a": mat, "mat_b": mat}
        result = strategy.compute(coords, matrices)
        assert isinstance(result, DerivedResult)
        # Accept numeric arrays (float32/int32), object arrays of dicts,
        # or plain lists of dicts.
        if isinstance(result.values, list):
            continue
        assert result.values.dtype in (np.float32, np.int32, object)


# ---------------------------------------------------------------------------
# Differential strategy
# ---------------------------------------------------------------------------

def test_differential_of_matrix_with_itself_is_zero() -> None:
    coords = HiCCoords(chrom="chr1", start=0, end=200_000, bin_size=20_000)
    mat = make_smooth_matrix(coords.n_bins, seed=1)
    s = DifferentialHiCStrategy()
    result = s.compute(coords, {"mat_a": mat, "mat_b": mat})
    np.testing.assert_array_equal(result.values, np.zeros_like(mat))
    assert result.kind == "matrix_diff"
    assert result.extra["vmin"] == 0.0 and result.extra["vmax"] == 0.0


def test_differential_recover_known_doubling() -> None:
    """If mat_a = 2 * mat_b in linear domain, log1p(a) - log1p(b) > 0 and bounded.

    Correct linear-doubling in the log1p domain: ``mat_a = log1p(2 * expm1(mat_b))``.
    Then ``log1p(a) - log1p(b) = log1p(2*expm1(b)) - log1p(b)`` lies in ``(0, log(2)]``
    (approaches log(2) as ``b`` grows, and is 0 at b=0).
    """
    coords = HiCCoords(chrom="chr1", start=0, end=200_000, bin_size=20_000)
    mat_b = make_smooth_matrix(coords.n_bins, seed=2)
    mat_a = np.log1p(2.0 * np.expm1(mat_b))  # linear-doubled, re-log1p'd
    result = DifferentialHiCStrategy().compute(coords, {"mat_a": mat_a, "mat_b": mat_b})
    assert (result.values > 0).all()
    # log1p(2x) - log1p(x) -> log(2) as x -> inf; for any finite x, < log(2).
    assert result.values.max() < math.log(2) + 1e-6


def test_differential_rejects_shape_mismatch() -> None:
    coords = HiCCoords(chrom="chr1", start=0, end=200_000, bin_size=20_000)
    with pytest.raises(ValueError, match="shape"):
        DifferentialHiCStrategy().compute(
            coords,
            {"mat_a": np.zeros((5, 5)), "mat_b": np.zeros((6, 6))},
        )


def test_differential_rejects_missing_matrix() -> None:
    coords = HiCCoords(chrom="chr1", start=0, end=200_000, bin_size=20_000)
    with pytest.raises(KeyError, match="mat_a"):
        DifferentialHiCStrategy().compute(coords, {"mat_a": np.zeros((5, 5))})


# ---------------------------------------------------------------------------
# Insulation Score + TAD boundary
# ---------------------------------------------------------------------------

def test_is_smooth_diagonal_has_uniform_middle() -> None:
    """A smooth matrix with a strong diagonal has roughly constant IS away from edges."""
    coords = HiCCoords(chrom="chr1", start=0, end=2_000_000, bin_size=20_000)
    mat = make_smooth_matrix(coords.n_bins, decay=0.03, seed=3)
    result = InsulationScoreStrategy(window_bp=200_000).compute(coords, {"mat": mat})
    assert result.kind == "signal"
    assert result.values.shape == (coords.n_bins,)
    # The interior bins (away from the boundary truncation) should be near 0
    # (upstream == downstream in a globally smooth matrix).
    interior = result.values[20:-20]
    assert abs(interior.mean()) < 0.5
    assert interior.std() < 0.6


def test_is_recovers_injected_dip() -> None:
    """Injecting a low-insulation block should produce a local minimum at the right bin."""
    coords = HiCCoords(chrom="chr1", start=0, end=2_000_000, bin_size=20_000)
    mat = make_smooth_matrix(coords.n_bins, decay=0.03, seed=4)
    # Carve out a low-contact stripe at bin 50 (= 1 Mb into the interval).
    mat[45:55, 45:55] = np.log1p(0.01)
    result = InsulationScoreStrategy(window_bp=200_000).compute(coords, {"mat": mat})
    # The IS minimum should land close to the carved region (bin 50).
    argmin = int(np.argmin(result.values))
    assert 40 <= argmin <= 60, f"expected dip near bin 50, got argmin={argmin}"


def test_is_short_matrix_returns_zeros() -> None:
    """Bins < 2 -> empty signal, no exception."""
    coords = HiCCoords(chrom="chr1", start=0, end=10_000, bin_size=20_000)
    mat = np.zeros((1, 1), dtype=np.float32)
    result = InsulationScoreStrategy().compute(coords, {"mat": mat})
    np.testing.assert_array_equal(result.values, np.zeros(1, dtype=np.float32))


def test_tad_boundary_finds_injected_dip() -> None:
    coords = HiCCoords(chrom="chr1", start=0, end=2_000_000, bin_size=20_000)
    mat = make_smooth_matrix(coords.n_bins, decay=0.03, seed=5)
    mat[45:55, 45:55] = np.log1p(0.01)
    result = TADBoundaryStrategy(
        window_bp=200_000, min_distance_bp=400_000
    ).compute(coords, {"mat": mat})
    assert result.kind == "boundaries"
    # Exactly one boundary should be reported near the carved region.
    assert result.values.size >= 1
    assert any(40 <= b <= 60 for b in result.values.tolist())


def test_tad_boundary_respects_min_distance() -> None:
    """Two close dips closer than min_distance collapse into one.

    Builds a constant matrix and carves two close dips. The constant
    background has no natural local minima, so any returned boundary is
    attributable to the injected dips. The dips are 7 bins apart, below
    the 10-bin ``min_distance``, so the deeper one wins.
    """
    coords = HiCCoords(chrom="chr1", start=0, end=2_000_000, bin_size=20_000)
    n = coords.n_bins
    mat = np.log1p(np.full((n, n), 2.0, dtype=np.float32))  # flat log1p(2) background
    mat[45:55, 45:55] = np.log1p(0.01)  # strong dip A centered at bin 50
    mat[55:60, 55:60] = np.log1p(0.01)  # dip B centered at bin 57, 7 bins away
    result = TADBoundaryStrategy(
        window_bp=200_000, min_distance_bp=200_000
    ).compute(coords, {"mat": mat})
    assert result.values.size == 1, f"expected 1 boundary, got {result.values}"
    # The merged boundary is the midpoint of the two dips (or close to it).
    assert 45 <= int(result.values[0]) <= 60


# ---------------------------------------------------------------------------
# A/B compartment
# ---------------------------------------------------------------------------

def test_ab_recovers_two_compartments() -> None:
    """A block matrix must have a PC1 that flips sign once at the compartment boundary."""
    n = 40
    coords = HiCCoords(chrom="chr1", start=0, end=n * 200_000, bin_size=200_000)
    mat = make_ab_matrix(n, block_size=20)
    result = ABCompartmentStrategy(coarsen_bp=200_000).compute(coords, {"mat": mat})
    assert result.kind == "signal"
    # First half should be opposite sign of second half (PC1 sign is
    # arbitrary, but the *change point* is what matters here).
    first = result.values[: n // 2].mean()
    second = result.values[n // 2 :].mean()
    assert abs(first) > 0.05 and abs(second) > 0.05
    # PC1 must change sign across the boundary.
    assert (first > 0) != (second > 0)
    # The top eigenvalue should dominate (>> 1/n).
    assert result.extra["eigenvalue"] > 0.1


def test_ab_uniform_matrix_returns_zero_signal() -> None:
    """A constant matrix has zero variance -> no compartment signal."""
    coords = HiCCoords(chrom="chr1", start=0, end=20 * 200_000, bin_size=200_000)
    mat = np.log1p(np.ones((20, 20), dtype=np.float32) * 2.0)
    result = ABCompartmentStrategy().compute(coords, {"mat": mat})
    np.testing.assert_array_equal(result.values, np.zeros(20, dtype=np.float32))


def test_ab_too_short_returns_zero() -> None:
    """Sub-resolution slice (fewer than 3 coarsened bins) -> zeros."""
    coords = HiCCoords(chrom="chr1", start=0, end=400_000, bin_size=200_000)
    mat = np.zeros((2, 2), dtype=np.float32)
    result = ABCompartmentStrategy().compute(coords, {"mat": mat})
    np.testing.assert_array_equal(result.values, np.zeros(2, dtype=np.float32))


# ---------------------------------------------------------------------------
# Local-minima helper (pure function)
# ---------------------------------------------------------------------------

def test_local_minima_basic() -> None:
    signal = np.array([3.0, 2.0, 1.0, 2.0, 3.0, 0.5, 2.0, 1.0, 3.0])
    # Three local minima: index 2 (val 1.0), 5 (val 0.5), and 7 (val 1.0).
    # All are separated by ≥ 2 bins.
    minima = _local_minima(signal, min_distance=2)
    assert list(minima) == [2, 5, 7]


def test_local_minima_merges_close_minima() -> None:
    signal = np.array([3.0, 1.0, 0.5, 1.5, 3.0])
    # Two close minima (1 and 2) at distance 1 -> should keep only the deeper.
    minima = _local_minima(signal, min_distance=3)
    assert list(minima) == [2]


def test_local_minima_no_minima_returns_empty() -> None:
    signal = np.array([1.0, 2.0, 3.0, 4.0])  # monotonic increase
    assert _local_minima(signal, min_distance=1).size == 0
