"""Insulation Score + TAD boundary detection strategies.

Insulation Score (IS, Crane 2015) is the workhorse for TAD boundary
calling: at each diagonal bin ``i`` it averages the upstream and downstream
quadrants of the log1p Hi-C matrix, then takes their log-ratio. Local
minima of IS mark TAD boundaries.

This module exports two strategies:

* ``InsulationScoreStrategy`` — returns the per-bin IS signal (1D).
* ``TADBoundaryStrategy`` — runs IS internally and picks the local minima
  as a list of bin indices.

The window size is given in bins and should be ≥1; a typical value is
``max(1, window_bp / bin_size)`` (e.g. 500 kb window at 20 kb bins →
window=25).
"""

from __future__ import annotations

import numpy as np

from .base import (
    DerivedResult,
    HiCCoords,
    HiCDerivedStrategy,
    register,
)

# Default IS window in base pairs. 500 kb matches Crane 2015 and TopDom
# recommendations; the route layer may override per-request.
DEFAULT_IS_WINDOW_BP = 500_000


def _quadrant_mean(
    mat: np.ndarray,
    i: int,
    w: int,
) -> tuple[float, float]:
    """Return (upstream-quadrant mean, downstream-quadrant mean) for bin ``i``.

    The upstream quadrant is the square of size ``w`` ending at row/col ``i``
    (the diamond just above the diagonal). The downstream quadrant is the
    square of size ``w`` starting at row/col ``i+1`` (just below). Both
    quadrants exclude the diagonal itself.
    """
    n = mat.shape[0]
    up_end = i
    up_start = max(0, up_end - w)
    down_start = i + 1
    down_end = min(n, down_start + w)
    up_slice = mat[up_start:up_end, up_start:up_end]
    down_slice = mat[down_start:down_end, down_start:down_end]
    up_mean = float(up_slice.mean()) if up_slice.size else 0.0
    down_mean = float(down_slice.mean()) if down_slice.size else 0.0
    return up_mean, down_mean


@register
class InsulationScoreStrategy(HiCDerivedStrategy):
    """Per-bin Insulation Score = log2(upstream_mean / downstream_mean).

    Uses the matrix key ``"mat"`` (the only one consumed).
    """

    name = "insulation_score"

    def __init__(self, window_bp: int = DEFAULT_IS_WINDOW_BP) -> None:
        self.window_bp = window_bp

    def compute(
        self,
        coords: HiCCoords,
        matrices: dict[str, np.ndarray],
    ) -> DerivedResult:
        mat = matrices.get("mat")
        if mat is None:
            raise KeyError(
                "InsulationScoreStrategy requires 'mat' in matrices "
                f"(got keys: {sorted(matrices)})"
            )
        n = mat.shape[0]
        if n < 2 or coords.bin_size <= 0:
            return DerivedResult(
                kind="signal",
                values=np.zeros(n, dtype=np.float32),
                extra={"window_bp": self.window_bp, "vmin": 0.0, "vmax": 0.0},
            )

        w = max(1, self.window_bp // coords.bin_size)
        # Use a vectorised quadrant mean via cumulative sums.
        # cum[i, j] = sum of mat[<i, <j]. Quadrant mean = (cum[A,B]-cum[a,b]-cum[A,b]+cum[a,B]) / area.
        cum = np.zeros((n + 1, n + 1), dtype=np.float64)
        cum[1:, 1:] = mat.astype(np.float64, copy=False).cumsum(axis=0).cumsum(axis=1)
        scores = np.zeros(n, dtype=np.float32)
        for i in range(n):
            up_end = i
            up_start = max(0, up_end - w)
            down_start = i + 1
            down_end = min(n, down_start + w)
            up_a = up_end - up_start
            up_area = up_a * up_a
            down_a = down_end - down_start
            down_area = down_a * down_a
            if up_area == 0 or down_area == 0:
                scores[i] = 0.0
                continue
            up_sum = (
                cum[up_end, up_end]
                - cum[up_start, up_end]
                - cum[up_end, up_start]
                + cum[up_start, up_start]
            )
            down_sum = (
                cum[down_end, down_end]
                - cum[down_start, down_end]
                - cum[down_end, down_start]
                + cum[down_start, down_start]
            )
            up_mean = up_sum / up_area
            down_mean = down_sum / down_area
            # log2(up / down). 0 if either side is 0 (eigenvector of "no
            # signal" case) — avoids -inf that would dominate auto-colormap.
            ratio = up_mean / down_mean if down_mean > 0 else 1.0
            scores[i] = float(np.log2(ratio)) if ratio > 0 else 0.0
        return DerivedResult(
            kind="signal",
            values=scores,
            extra={"window_bp": self.window_bp},
        )


def _local_minima(
    signal: np.ndarray,
    min_distance: int,
) -> np.ndarray:
    """Return indices of strict local minima separated by ≥ ``min_distance`` bins.

    A local minimum is a bin whose value is less than both its immediate
    neighbours (or boundary if at the array edge). Ties are broken by the
    lower value; on equal values, the earlier index wins. Minimums closer
    than ``min_distance`` are merged: keep the deepest.
    """
    n = signal.size
    if n < 3:
        return np.array([], dtype=np.int32)
    left = np.concatenate(([signal[0]], signal[:-1]))
    right = np.concatenate((signal[1:], [signal[-1]]))
    is_min = (signal < left) & (signal < right)
    candidates = np.flatnonzero(is_min)
    if candidates.size == 0:
        return np.array([], dtype=np.int32)
    # Sort candidates by ascending signal value (deepest first).
    order = np.argsort(signal[candidates], kind="mergesort")
    candidates = candidates[order]
    chosen: list[int] = []
    for idx in candidates.tolist():
        if all(abs(idx - j) >= min_distance for j in chosen):
            chosen.append(idx)
    return np.asarray(sorted(chosen), dtype=np.int32)


@register
class TADBoundaryStrategy(HiCDerivedStrategy):
    """Bin indices of TAD boundaries detected as IS local minima.

    Wraps the IS strategy and applies a local-minima detector with a
    minimum-distance filter (in bp, converted to bins) so that nearby
    dips collapse into a single boundary.
    """

    name = "tad_boundary"

    def __init__(
        self,
        window_bp: int = DEFAULT_IS_WINDOW_BP,
        min_distance_bp: int = 200_000,
    ) -> None:
        self.window_bp = window_bp
        self.min_distance_bp = min_distance_bp

    def compute(
        self,
        coords: HiCCoords,
        matrices: dict[str, np.ndarray],
    ) -> DerivedResult:
        is_result = InsulationScoreStrategy(self.window_bp).compute(
            coords, matrices
        )
        min_distance = max(1, self.min_distance_bp // max(1, coords.bin_size))
        boundary_bins = _local_minima(is_result.values, min_distance)
        return DerivedResult(
            kind="boundaries",
            values=boundary_bins,
            extra={
                "window_bp": self.window_bp,
                "min_distance_bp": self.min_distance_bp,
                "n_boundaries": int(boundary_bins.size),
            },
        )
