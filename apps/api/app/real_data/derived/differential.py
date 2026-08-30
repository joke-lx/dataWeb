"""Differential Hi-C strategy: log-ratio between two log1p matrices.

The contract: receive two log1p sub-matrices ``mat_a`` and ``mat_b`` of equal
shape (the route layer slices both samples to the same genomic interval
at the same bin size). The output is ``log1p(A) - log1p(B)``, which is a
standard log-ratio approximation that stays finite even when either input
contact is zero (which log2(A/B) would not).
"""

from __future__ import annotations

import numpy as np

from .base import (
    DerivedResult,
    HiCCoords,
    HiCDerivedStrategy,
    register,
)


@register
class DifferentialHiCStrategy(HiCDerivedStrategy):
    """Element-wise log-ratio ``log1p(A) - log1p(B)`` over a square slice."""

    name = "differential_hic"

    def compute(
        self,
        coords: HiCCoords,
        matrices: dict[str, np.ndarray],
    ) -> DerivedResult:
        mat_a = matrices.get("mat_a")
        mat_b = matrices.get("mat_b")
        if mat_a is None or mat_b is None:
            raise KeyError(
                "DifferentialHiCStrategy requires both 'mat_a' and 'mat_b' "
                f"in matrices (got keys: {sorted(matrices)})"
            )
        if mat_a.shape != mat_b.shape:
            raise ValueError(
                f"mat_a shape {mat_a.shape} != mat_b shape {mat_b.shape}"
            )

        # log1p(A) - log1p(B) is finite everywhere (avoids 0/0 in log2(A/B)).
        diff = (mat_a - mat_b).astype(np.float32, copy=False)
        # Use non-zero reference range for vmin/vmax (symmetric around 0).
        abs_max = float(np.abs(diff).max()) if diff.size else 0.0
        return DerivedResult(
            kind="matrix_diff",
            values=diff,
            extra={"vmin": -abs_max, "vmax": abs_max},
        )
