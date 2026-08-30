"""Hi-C SV (structural variant) breakpoint detection along the diagonal.

A long gap of low contact along the diagonal of the Hi-C map hints at a
deletion or translocation breakpoint: the chromosome two regions apart
which should normally interact stop interacting because the intervening
sequence is missing or has been moved. This strategy looks for those
"off-diagonal dark stripes" and emits BED-like records for any contiguous
low-contact run it finds.

Algorithm (per bin ``i``):

1. Compute the off-diagonal mean contact
   ``off[i] = mean(mat[i:i+w, i+w:i+2*w])`` where
   ``w = min(10, max(1, N // 20))``. This is contact between the diagonal
   region around bin ``i`` and the diagonal region ``w`` bins farther
   along — a gap along the diagonal shows up as a sharp drop in ``off``.
2. Find indices where ``off[i]`` drops below half the local median AND
   that drop spans at least 5 consecutive bins (a single noisy bin is
   ignored).
3. Output ONE BED-like record per contiguous run of low bins. Only
   ``"deletion"`` is produced (this simplified version does not try to
   distinguish deletion / inversion / duplication / translocation).
"""

from __future__ import annotations

import numpy as np

from .base import (
    DerivedResult,
    HiCCoords,
    HiCDerivedStrategy,
    register,
)

# Minimum run length (bins) for an "off" drop to qualify as a candidate SV.
# Five bins is empirically enough to avoid single-bin noise triggering
# false positives in smooth random matrices while still picking up the
# modest-width dark stripes one typically sees on real Hi-C at typical
# bin sizes.
_MIN_RUN_LEN = 5
# Cap on the off-diagonal window width (bins). 10 is conservative for any
# resolution; the strategy scales this with N anyway.
_MAX_WINDOW_BINS = 10


def _off_diagonal_means(mat: np.ndarray, w: int) -> np.ndarray:
    """Return ``off[i] = mean(mat[i:i+w, i+w:i+2*w])`` for each valid ``i``.

    Length is ``max(0, n - 2*w)`` where ``n = mat.shape[0]``. Returns an
    empty float32 array if the matrix is too small for the window.
    """
    n = mat.shape[0]
    if w <= 0 or n < 2 * w:
        return np.zeros(0, dtype=np.float32)
    # Vectorised via cumulative sum: each off[i] is a single w*w block.
    cum = np.zeros((n + 1, n + 1), dtype=np.float64)
    cum[1:, 1:] = mat.astype(np.float64, copy=False).cumsum(axis=0).cumsum(axis=1)
    length = n - 2 * w
    out = np.empty(length, dtype=np.float32)
    for i in range(length):
        r0, r1 = i, i + w
        c0, c1 = i + w, i + 2 * w
        block_sum = (
            cum[r1, c1]
            - cum[r0, c1]
            - cum[r1, c0]
            + cum[r0, c0]
        )
        out[i] = float(block_sum / (w * w))
    return out


@register
class SVStrategy(HiCDerivedStrategy):
    """BED-like SV records from off-diagonal Hi-C contact drops.

    Outputs ``kind="sv_bed"`` with ``values`` as a list of
    ``{chrom, start, end, kind}`` dicts (one per detected event) and
    ``extra={"n_sv": N}``. Empty input → empty list, ``n_sv == 0``.
    """

    name = "sv_bed"

    def compute(
        self,
        coords: HiCCoords,
        matrices: dict[str, np.ndarray],
    ) -> DerivedResult:
        mat = matrices.get("mat")
        if mat is None:
            raise KeyError(
                "SVStrategy requires 'mat' in matrices "
                f"(got keys: {sorted(matrices)})"
            )
        n = mat.shape[0]
        if n < 2 or coords.bin_size <= 0:
            return DerivedResult(
                kind="sv_bed",
                values=[],
                extra={"n_sv": 0},
            )
        w = min(_MAX_WINDOW_BINS, max(1, n // 20))
        off = _off_diagonal_means(mat, w)
        if off.size == 0:
            return DerivedResult(
                kind="sv_bed",
                values=[],
                extra={"n_sv": 0},
            )

        median_off = float(np.median(off))
        # Guard: if the median is zero (degenerate empty/constant matrix
        # near boundary), skip detection.
        if median_off <= 0:
            return DerivedResult(
                kind="sv_bed",
                values=[],
                extra={"n_sv": 0},
            )
        threshold = 0.5 * median_off
        low = off < threshold

        records: list[dict[str, object]] = []
        i = 0
        length = low.size
        while i < length:
            if not low[i]:
                i += 1
                continue
            j = i
            while j < length and low[j]:
                j += 1
            run_len = j - i
            if run_len >= _MIN_RUN_LEN:
                start = coords.start + i * coords.bin_size
                end = coords.start + (j + 1) * coords.bin_size
                records.append(
                    {
                        "chrom": coords.chrom,
                        "start": start,
                        "end": end,
                        "kind": "deletion",
                    }
                )
            i = j
        return DerivedResult(
            kind="sv_bed",
            values=records,
            extra={"n_sv": len(records)},
        )
