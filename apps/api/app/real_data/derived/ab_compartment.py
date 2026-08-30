"""A/B compartment strategy: PCA on a binned Hi-C correlation matrix.

The first principal component of the (column-wise) correlation matrix of
the Hi-C map is a robust A/B signal: positive values mark compartment A
(active / open chromatin), negative values mark compartment B (inactive
/ closed). This is the same approach used by HiGlass and the original
Lieberman-Aiden 2009 paper.

The strategy takes the log1p Hi-C sub-matrix under the key ``"mat"`` and:

1. Coarsens it to ``coarsen_bp`` resolution (default 200 kb) so the
   per-bin signal is stable.
2. Computes the column-wise Pearson correlation matrix.
3. Extracts the eigenvector of the largest-eigenvalue component.
4. Returns the per-bin PC1 score (length = number of coarsened bins).
"""

from __future__ import annotations

import numpy as np

from .base import (
    DerivedResult,
    HiCCoords,
    HiCDerivedStrategy,
    register,
)

# Default coarsening resolution (bp) for the correlation matrix. 200 kb
# gives ~150 bins per typical pig autosome — enough resolution to see
# compartment blocks while smoothing per-bin noise.
DEFAULT_COARSEN_BP = 200_000


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
    # NaN -> 0 (constant column) so downstream eigendecomposition is safe.
    return np.nan_to_num(corr, nan=0.0)


@register
class ABCompartmentStrategy(HiCDerivedStrategy):
    """Per-bin A/B compartment score = PC1 of binned Hi-C correlation."""

    name = "ab_compartment"

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
                "ABCompartmentStrategy requires 'mat' in matrices "
                f"(got keys: {sorted(matrices)})"
            )
        n = mat.shape[0]
        # Number of coarsened bins. Sub-resolution slice returns empty.
        factor = max(1, self.coarsen_bp // max(1, coords.bin_size))
        if n < factor * 3:  # need at least 3 coarsened bins for a meaningful PC1
            return DerivedResult(
                kind="signal",
                values=np.zeros(n, dtype=np.float32),
                extra={"coarsen_bp": self.coarsen_bp, "eigenvalue": 0.0},
            )
        coarse = _coarsen_mean(mat, factor)
        # Drop zero-variance columns (constant contact — no compartment info).
        # Use a tolerance for float32 round-off (otherwise all-constant columns
        # have std ≈ 2e-7 and sneak through the ``> 0`` check).
        std = coarse.std(axis=0)
        keep = std > 1e-6
        if keep.sum() < 3:
            return DerivedResult(
                kind="signal",
                values=np.zeros(n, dtype=np.float32),
                extra={"coarsen_bp": self.coarsen_bp, "eigenvalue": 0.0},
            )
        corr = _column_correlation(coarse[:, keep])
        # Top eigenvector via symmetric eigendecomposition.
        eigvals, eigvecs = np.linalg.eigh(corr)
        pc1 = eigvecs[:, -1]  # largest eigenvalue
        # Sign convention: positive PC1 -> A compartment (the conventional
        # convention is arbitrary; downstream code does not depend on the
        # sign as long as it is consistent).
        # Up-sample PC1 back to the original bin resolution.
        upsampled = np.repeat(pc1.astype(np.float32, copy=False), factor)[:n]
        return DerivedResult(
            kind="signal",
            values=upsampled,
            extra={
                "coarsen_bp": self.coarsen_bp,
                "eigenvalue": float(eigvals[-1]),
            },
        )
