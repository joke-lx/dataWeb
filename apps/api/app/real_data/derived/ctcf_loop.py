"""CTCF loop detection strategy.

A "loop" is a pair of genomic anchors (i, j) where the contact at pixel
(i, j) is much higher than the local background — the same intuition
HiCCUPS uses when calling loops in Hi-C. This is a deliberately simple
variant suited to per-slice detection at ~1 s on a 200x200 matrix:

  1. Local background: ``bg[i, j] = mean(mat[max(0, i-d):i+d, max(0, j-d):j+d])``
     with ``d = 5`` (square window, half-width 5 bins per side). Computed
     via a 2D cumulative sum so the per-pixel mean is O(1) once the sum
     table is built.
  2. Enrichment ratio: ``r = mat / (bg + 1e-6)``. The epsilon keeps the
     denominator strictly positive even where the local background is
     exactly zero.
  3. Threshold + diagonal filter: keep (i, j) where ``r > 1.5`` and
     ``j - i > 2`` (strictly upper triangle, skipping the diagonal + 2
     sub-diagonals). Symmetric counterparts (j, i) are merged into the
     same loop by the upper-triangle restriction.
  4. Greedy dedup with centroid-based representative selection: sort
     surviving candidates by ``r`` descending, then for each cluster of
     pixels within a +/-5-bin Chebyshev box pick the cell closest to the
     cluster centroid as the loop's representative (tie-break by higher
     ``r``). Suppressed cells drop out via a 2D boolean mask.

The output is ``kind="loops"`` with a numpy object array of dicts so
``result.values.tolist()`` yields a JSON-friendly list. ``extra`` reports
the loop count.
"""

from __future__ import annotations

import numpy as np

from .base import (
    DerivedResult,
    HiCCoords,
    HiCDerivedStrategy,
    register,
)

# Algorithm defaults. Locked to the spec; tuning these is out of scope.
_DEFAULT_HALFWIDTH = 5  # bg window half-width in bins per side
_DEFAULT_R_THRESHOLD = 1.5
_DEFAULT_DEDUP_BINS = 5  # +/- bins for the Chebyshev dedup box
_DEFAULT_DIAGONAL_SKIP = 2  # skip the diagonal + 2 sub-diagonals
_EPS = 1e-6  # denominator floor so r stays finite where bg == 0


@register
class CTCFLoopStrategy(HiCDerivedStrategy):
    """Detect CTCF loop anchors in a Hi-C log1p sub-matrix.

    Consumes the matrix under key ``"mat"`` (log1p float32, square) and
    returns one entry per detected loop with ``kind="loops"``.
    """

    name = "ctcf_loop"

    def compute(
        self,
        coords: HiCCoords,
        matrices: dict[str, np.ndarray],
    ) -> DerivedResult:
        mat = matrices.get("mat")
        if mat is None:
            raise KeyError(
                "CTCFLoopStrategy requires 'mat' in matrices "
                f"(got keys: {sorted(matrices)})"
            )
        n = mat.shape[0]
        if n == 0:
            return DerivedResult(
                kind="loops",
                values=np.empty(0, dtype=object),
                extra={"n_loops": 0},
            )

        # --- 1. Local background via cumulative sums.
        # cum[i, j] = sum of mat[<i, <j]; the 2D mean over a rectangle is
        # then a single subtract-and-divide regardless of window size.
        mat_f = mat.astype(np.float64, copy=False)
        d = _DEFAULT_HALFWIDTH
        cum = np.zeros((n + 1, n + 1), dtype=np.float64)
        cum[1:, 1:] = mat_f.cumsum(axis=0).cumsum(axis=1)

        idx = np.arange(n)
        I, J = np.meshgrid(idx, idx, indexing="ij")
        i_lo = np.maximum(0, I - d)
        i_hi = np.minimum(n, I + d)
        j_lo = np.maximum(0, J - d)
        j_hi = np.minimum(n, J + d)
        area = (i_hi - i_lo) * (j_hi - j_lo)
        # Edge pixels have small windows; keep area >= 1 to avoid /0.
        np.maximum(area, 1, out=area)
        bg = (
            cum[i_hi, j_hi]
            - cum[i_lo, j_hi]
            - cum[i_hi, j_lo]
            + cum[i_lo, j_lo]
        ) / area

        # --- 2. Enrichment ratio r.
        r = mat_f / (bg + _EPS)

        # --- 3. Threshold + diagonal filter. Upper triangle beyond 2 bins.
        diag_skip = _DEFAULT_DIAGONAL_SKIP
        mask = (r > _DEFAULT_R_THRESHOLD) & (J >= I + diag_skip + 1)
        cand_i, cand_j = np.where(mask)
        cand_r = r[cand_i, cand_j]
        if cand_r.size == 0:
            return DerivedResult(
                kind="loops",
                values=np.empty(0, dtype=object),
                extra={"n_loops": 0},
            )

        # --- 4. Greedy dedup with centroid-based representative.
        # Sort by r descending, stable so equal r preserves row-major order.
        order = np.argsort(-cand_r, kind="stable")
        cand_i = cand_i[order]
        cand_j = cand_j[order]
        cand_r = cand_r[order]

        # 2D masks let us skip processed cells in O(1) and slice
        # neighbourhoods in O(dedup_window_area) instead of O(N).
        is_candidate = np.zeros((n, n), dtype=bool)
        is_candidate[cand_i, cand_j] = True
        is_assigned = np.zeros((n, n), dtype=bool)
        representatives: list[tuple[int, int, float]] = []
        w = _DEFAULT_DEDUP_BINS
        n_cand = cand_r.size
        threshold = _DEFAULT_R_THRESHOLD

        for k in range(n_cand):
            ri = cand_r[k]
            # Sorted descending, so the moment we hit a non-candidate the rest
            # are also below threshold — match the spec's stop rule.
            if ri < threshold:
                break
            i = int(cand_i[k])
            j = int(cand_j[k])
            if is_assigned[i, j]:
                continue

            # Cluster = all candidates in the +/- w Chebyshev box around (i, j)
            # that have not yet been claimed by an earlier (higher-r) loop.
            i0 = max(0, i - w)
            i1 = min(n, i + w + 1)
            j0 = max(0, j - w)
            j1 = min(n, j + w + 1)
            sub_mask = is_candidate[i0:i1, j0:j1] & ~is_assigned[i0:i1, j0:j1]
            sub_local_i, sub_local_j = np.where(sub_mask)
            cluster_full_i = sub_local_i + i0
            cluster_full_j = sub_local_j + j0
            if cluster_full_i.size == 0:
                # Anchor itself is the only cell in its box — defensive fallback.
                cluster_full_i = np.array([i], dtype=np.int64)
                cluster_full_j = np.array([j], dtype=np.int64)
            cluster_full_r = r[cluster_full_i, cluster_full_j]

            if cluster_full_i.size == 1:
                best = 0
            else:
                # Representative = closest to centroid (Manhattan). On ties,
                # prefer the cell with the higher enrichment ratio.
                ci_mean = float(cluster_full_i.mean())
                cj_mean = float(cluster_full_j.mean())
                dist = (
                    np.abs(cluster_full_i.astype(np.float64) - ci_mean)
                    + np.abs(cluster_full_j.astype(np.float64) - cj_mean)
                )
                min_d = float(dist.min())
                near = np.where(dist <= min_d + 1e-9)[0]
                best = int(near[np.argmax(cluster_full_r[near])])

            representatives.append(
                (
                    int(cluster_full_i[best]),
                    int(cluster_full_j[best]),
                    float(cluster_full_r[best]),
                )
            )

            # Suppress the cluster cells and every cell in their +/- w boxes
            # so no later candidate can re-pick the same anchor twice.
            is_assigned[cluster_full_i, cluster_full_j] = True
            for ci_v, cj_v in zip(
                cluster_full_i.astype(np.int64).tolist(),
                cluster_full_j.astype(np.int64).tolist(),
            ):
                ci0 = max(0, ci_v - w)
                ci1 = min(n, ci_v + w + 1)
                cj0 = max(0, cj_v - w)
                cj1 = min(n, cj_v + w + 1)
                is_assigned[ci0:ci1, cj0:cj1] = True

        # Build the structured object array. .tolist() flattens this to
        # ``[{"anchor1": int, "anchor2": int, "score": float}, ...]``.
        values = np.empty(len(representatives), dtype=object)
        for idx_v, (i_v, j_v, r_v) in enumerate(representatives):
            values[idx_v] = {"anchor1": i_v, "anchor2": j_v, "score": r_v}

        return DerivedResult(
            kind="loops",
            values=values,
            extra={"n_loops": len(representatives)},
        )
