"""Unit tests for the Hi-C SV (structural variant) strategy.

Each test builds a synthetic log1p Hi-C sub-matrix, runs
:class:`SVStrategy`, and checks the BED-like output contract:

* ``kind == "sv_bed"``
* ``values`` is a list of ``{chrom, start, end, kind="deletion"}`` dicts
* ``extra["n_sv"]`` equals ``len(values)``

No fixtures, no real data — these tests run in tens of milliseconds.
"""

from __future__ import annotations

import numpy as np

from app.real_data.derived import HiCCoords
from app.real_data.derived.sv import SVStrategy


# ---------------------------------------------------------------------------
# Synthetic matrix builders
# ---------------------------------------------------------------------------

def make_smooth_matrix(
    n: int,
    decay: float = 0.05,
    seed: int = 0,
) -> np.ndarray:
    """Build a log1p Hi-C-like matrix with strong diagonal decay.

    Diagonal bins have high contact (close in 3D); off-diagonal falls off
    exponentially with distance. Returns a (n, n) float32 matrix.
    """
    rng = np.random.default_rng(seed)
    base = rng.uniform(0.5, 2.0, size=(n, n)).astype(np.float32)
    base = (base + base.T) / 2
    dist = np.abs(np.subtract.outer(np.arange(n), np.arange(n))).astype(np.float32)
    base *= np.exp(-dist * decay)
    base += np.eye(n, dtype=np.float32) * 5
    return np.log1p(base)


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------

def test_sv_no_break_clean_matrix() -> None:
    """A smooth random matrix has no detectable SV breakpoints → empty output."""
    coords = HiCCoords(chrom="chr1", start=0, end=40_000, bin_size=1_000)
    mat = make_smooth_matrix(40, seed=0)
    result = SVStrategy().compute(coords, {"mat": mat})
    assert result.kind == "sv_bed"
    assert result.extra["n_sv"] == 0
    assert list(result.values) == []


def test_sv_detects_diagonal_gap() -> None:
    """A dark stripe from bin 20-30 on the diagonal produces ≥ 1 deletion."""
    coords = HiCCoords(chrom="chr1", start=0, end=60_000, bin_size=1_000)
    mat = make_smooth_matrix(60, seed=1)
    # Carve out a low-contact block on the diagonal covering bins 20-30.
    # This is the "dark stripe" the spec describes.
    mat[20:31, 20:31] = np.log1p(0.01)
    result = SVStrategy().compute(coords, {"mat": mat})
    assert result.kind == "sv_bed"
    assert len(result.values) >= 1
    assert result.extra["n_sv"] >= 1
    # The gap occupies bins 20..30 (inclusive) → bp [20_000, 31_000).
    gap_start = 20 * coords.bin_size  # 20_000
    gap_end = (30 + 1) * coords.bin_size  # 31_000
    # At least one deletion record must overlap ≥ 50% of the gap region
    # (the exact start/end depend on the off-diagonal window size, which
    # in turn depends on N — allowing slack keeps the test robust).
    overlap_min = (gap_end - gap_start) // 2
    found = False
    for rec in result.values:
        if rec.get("kind") != "deletion":
            continue
        rec_start = int(rec["start"])  # type: ignore[arg-type]
        rec_end = int(rec["end"])  # type: ignore[arg-type]
        overlap = max(0, min(rec_end, gap_end) - max(rec_start, gap_start))
        if overlap >= overlap_min:
            found = True
            break
    assert found, (
        f"no deletion record overlaps bins 20-30 by >= {overlap_min} bp; "
        f"got records: {result.values}"
    )


def test_sv_kind_field() -> None:
    """Every record produced by SVStrategy must have ``kind == 'deletion'``."""
    coords = HiCCoords(chrom="chr1", start=0, end=60_000, bin_size=1_000)
    mat = make_smooth_matrix(60, seed=2)
    mat[20:31, 20:31] = np.log1p(0.01)
    result = SVStrategy().compute(coords, {"mat": mat})
    assert len(result.values) >= 1, (
        "expected at least one record to verify kind; "
        f"got values={result.values}"
    )
    for rec in result.values:
        assert rec["kind"] == "deletion"
