"""Expression / ChIP / ATAC activity proxy from Hi-C A/B compartment.

Real RNA-seq, ChIP-seq, and ATAC-seq tracks are not available for the
porcine Brain_BF3 sample. This strategy supplies a defensible *proxy* by
using the A/B compartment signal derived from Hi-C, under the well-
established correspondence that:

* compartment A  ~ open / transcriptionally active / H3K4me3-rich / RNA+
* compartment B  ~ closed / transcriptionally silent / H3K27me3-rich / RNA-

Steps:

1. Block-mean coarsen the input log1p Hi-C matrix to ``coarsen_bp`` per
   bin (default 500 kb) so the per-bin correlation is stable.
2. Compute the column-wise Pearson correlation of the coarsened matrix.
3. Take the eigenvector of the largest eigenvalue → PC1.
4. Linearly rescale PC1 to ``[0, 1]`` so ``0`` = most B-like,
   ``1`` = most A-like at every coarsened bin.
5. Up-sample back to the original ``N`` bins (nearest-neighbour repeat).
6. Return ``kind="activity_signal"`` with a per-bin float32 array plus
   ``extra["source"] = "ab_proxy"`` and a caveat ``note`` so downstream
   callers know this is not real RNA/ChIP/ATAC.

The construction only uses ``numpy``; no scipy/sklearn required.
"""

from __future__ import annotations

import numpy as np

from .base import (
    DerivedResult,
    HiCCoords,
    HiCDerivedStrategy,
    register,
)

# Default coarsening resolution (bp) for the A/B correlation. 500 kb gives
# a stable PC1 on typical Hi-C even when the input resolution is 10–50 kb.
DEFAULT_COARSEN_BP = 500_000


def _coarsen_mean(mat: np.ndarray, factor: int) -> np.ndarray:
    """Block-mean coarsen a square matrix by integer ``factor`` (no overlap)."""
    n = mat.shape[0]
    new_n = n // factor
    if new_n == 0:
        return np.zeros((0, 0), dtype=mat.dtype)
    cropped = mat[: new_n * factor, : new_n * factor]
    return (
        cropped.reshape(new_n, factor, new_n, factor)
        .mean(axis=(1, 3))
        .astype(np.float32, copy=False)
    )


def _column_correlation(m: np.ndarray) -> np.ndarray:
    """Column-wise Pearson correlation; NaN columns collapse to zero."""
    centered = m - m.mean(axis=0, keepdims=True)
    std = m.std(axis=0, keepdims=True)
    safe_std = np.where(std > 0, std, 1.0)
    normed = centered / safe_std
    corr = normed.T @ normed
    n_cols = m.shape[1]
    corr /= n_cols
    return np.nan_to_num(corr, nan=0.0)


@register
class ExpressionActivityStrategy(HiCDerivedStrategy):
    """Per-bin expression/ChIP/ATAC activity proxy from Hi-C A/B.

    Inputs: ``matrices["mat"]`` — log1p float32 Hi-C sub-matrix.
    Output: ``values`` — float32 array of length ``N`` in ``[0, 1]``
    where ``1`` marks the most A-like (active) bin.
    """

    name = "activity_signal"

    def __init__(self, coarsen_bp: int = DEFAULT_COARSEN_BP) -> None:
        self.coarsen_bp = coarsen_bp

    def compute(
        self,
        coords: HiCCoords,
        matrices: dict[str, np.ndarray],
    ) -> DerivedResult:
        mat = matrices.get("mat")
        if mat is None:
            raise KeyError(
                "ExpressionActivityStrategy requires 'mat' in matrices "
                f"(got keys: {sorted(matrices)})"
            )
        n = mat.shape[0]
        # Coarsening ratio: round coarsen_bp down to integer bin multiples.
        # factor = 1 (no coarsening) when the input is already at or finer
        # than coarsen_bp.
        factor = max(1, self.coarsen_bp // max(1, coords.bin_size))
        note = (
            "not real RNA/ChIP/ATAC — derived from Hi-C A/B compartment"
        )
        extra_base: dict[str, object] = {
            "source": "ab_proxy",
            "note": note,
            "coarsen_bp": self.coarsen_bp,
        }

        # Too short for a meaningful PC1 — return zeros safely (and document
        # that no compartment signal could be extracted).
        if n < factor * 3:
            return DerivedResult(
                kind="activity_signal",
                values=np.zeros(n, dtype=np.float32),
                extra={**extra_base, "eigenvalue": 0.0},
            )
        coarse = _coarsen_mean(mat, factor)
        # Drop zero-variance columns (constant contact — no compartment info
        # at that bin). Use a tolerance for float32 round-off.
        std = coarse.std(axis=0)
        keep = std > 1e-6
        if keep.sum() < 3:
            return DerivedResult(
                kind="activity_signal",
                values=np.zeros(n, dtype=np.float32),
                extra={**extra_base, "eigenvalue": 0.0},
            )
        corr = _column_correlation(coarse[:, keep])
        # Top eigenvector via symmetric eigendecomposition.
        eigvals, eigvecs = np.linalg.eigh(corr)
        pc1 = eigvecs[:, -1]  # largest eigenvalue direction
        # Rescale linearly to [0, 1]. The additive 1e-9 keeps division safe
        # for the degenerate "pc1 is constant" case (which should already
        # be caught above but is defensive).
        pc1_min = float(pc1.min())
        pc1_max = float(pc1.max())
        span = pc1_max - pc1_min
        activity = (pc1 - pc1_min) / (span + 1e-9)
        activity = np.clip(activity, 0.0, 1.0).astype(np.float32, copy=False)
        # Up-sample back to the original N bins via nearest-neighbour repeat.
        upsampled = np.repeat(activity, factor)[:n]
        # Pad with the edge value if repeat-truncation shortened us.
        if upsampled.size < n:
            pad = np.full(n - upsampled.size, activity[-1], dtype=np.float32)
            upsampled = np.concatenate([upsampled, pad])
        return DerivedResult(
            kind="activity_signal",
            values=upsampled.astype(np.float32, copy=False),
            extra={**extra_base, "eigenvalue": float(eigvals[-1])},
        )
