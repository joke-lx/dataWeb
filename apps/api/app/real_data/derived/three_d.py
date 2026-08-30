"""3D structure strategy: classical MDS on a Hi-C correlation-derived distance.

Implements a ShRec3D-style pipeline reduced to its essentials for the demo.
The full ShRec3D algorithm (Lesne et al. 2014) models expected contact as a
function of genomic distance, then takes ``-log(observed / expected)`` as a
distance before classical MDS. We short-circuit the expected-model fit and
use ``1 - corr`` (with ``corr`` the column-wise Pearson correlation of the
log1p matrix) as the distance directly. This captures the same
cluster-level topology (within-block similarity, cross-block dissimilarity)
without needing a fitted expected model, and runs in well under a second
on a 200x200 sub-matrix. The result is suitable for visualising 3D
structure in the demo; it is not meant for a published 3D reconstruction.

Output: ``DerivedResult(kind="matrix3d", values=(N, 3) float32,
extra={"n_bins": N})``.
"""

from __future__ import annotations

import numpy as np

from .base import (
    DerivedResult,
    HiCCoords,
    HiCDerivedStrategy,
    register,
)


def _column_correlation(m: np.ndarray) -> np.ndarray:
    """Column-wise Pearson correlation; constant columns collapse to zero.

    Local copy of the helper in ``ab_compartment.py`` so this module has no
    cross-module private imports.
    """
    centered = m - m.mean(axis=0, keepdims=True)
    std = m.std(axis=0, keepdims=True)
    safe_std = np.where(std > 0, std, 1.0)
    normed = centered / safe_std
    corr = normed.T @ normed
    n_cols = m.shape[1]
    if n_cols > 0:
        corr /= n_cols
    return np.nan_to_num(corr, nan=0.0)


@register
class ThreeDStructureStrategy(HiCDerivedStrategy):
    """Per-bin 3D coordinates via classical MDS on a column-correlation distance."""

    name = "three_d"

    def compute(
        self,
        coords: HiCCoords,
        matrices: dict[str, np.ndarray],
    ) -> DerivedResult:
        mat = matrices.get("mat")
        if mat is None:
            raise KeyError(
                "ThreeDStructureStrategy requires 'mat' in matrices "
                f"(got keys: {sorted(matrices)})"
            )
        n = mat.shape[0]

        # Fewer than 3 columns: classical MDS yields at most 2 nontrivial
        # eigenvalues (often fewer for rank-deficient distance matrices),
        # so there is no 3D structure to recover.
        if n < 3:
            return DerivedResult(
                kind="matrix3d",
                values=np.zeros((n, 3), dtype=np.float32),
                extra={"n_bins": int(n)},
            )

        # 1. Distance transform via 1 - column-Pearson correlation.
        corr = _column_correlation(np.asarray(mat, dtype=np.float32))
        distance = 1.0 - corr

        # 2. Symmetrise and clip into [0, 2] (correlation is bounded by
        # [-1, 1] in theory; the clip guards against float32 round-off
        # that could otherwise push the distance negative).
        d = (distance + distance.T) / 2.0
        d = np.clip(d, 0.0, 2.0).astype(np.float64, copy=False)

        # 3. Classical MDS: double-centre the squared distance matrix,
        # then take the top-3 eigenvectors of the Gram-like matrix B.
        # Internal maths run in float64 for numerical stability; the
        # input is float32 and the output is float32 per the strategy
        # contract.
        d2 = d * d
        row_mean = d2.mean(axis=1, keepdims=True)
        col_mean = d2.mean(axis=0, keepdims=True)
        grand_mean = float(d2.mean())
        b = -0.5 * (d2 - row_mean - col_mean + grand_mean)
        eigvals, eigvecs = np.linalg.eigh(b)
        top_vals = eigvals[-3:]
        top_vecs = eigvecs[:, -3:]
        coords_3d = top_vecs * np.sqrt(np.maximum(top_vals, 0.0))

        # 4. Centre the centroid at the origin and rescale so the maximum
        # absolute coordinate equals 1. The rescale gives downstream
        # viewers a unit-bounding-box that does not depend on N.
        centered = coords_3d - coords_3d.mean(axis=0, keepdims=True)
        max_abs = float(np.max(np.abs(centered))) if centered.size else 0.0
        if max_abs > 0:
            centered = centered / max_abs
        values = centered.astype(np.float32, copy=False)
        return DerivedResult(
            kind="matrix3d",
            values=values,
            extra={"n_bins": int(n)},
        )
