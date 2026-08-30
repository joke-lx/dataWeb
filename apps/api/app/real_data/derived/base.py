"""Strategy base class and shared data structures for Hi-C derived signals.

This module defines the contract every Hi-C derived strategy must satisfy:
``HiCDerivedStrategy.compute(coords, matrices)`` takes a genomic interval
plus one or more log1p Hi-C sub-matrices and returns a ``DerivedResult``
whose ``kind`` field tells the route layer how to serialise the payload.

The design favours small, single-purpose strategies (differential / IS /
TAD boundary / AB compartment) that can be unit-tested in isolation with
synthetic matrices, then composed by the route layer in arbitrary ways.
"""

from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import Any, ClassVar, Literal

import numpy as np

# Strategy return kinds. Routes dispatch on this to pick a serialiser
# (float32 row-major bytes for ``matrix*``, 1D float32 for ``signal``,
# JSON list of records for ``boundaries``).
DerivedKind = Literal[
    "matrix",
    "matrix_diff",
    "matrix3d",
    "signal",
    "boundaries",
    "loops",
    "sv_bed",
    "activity_signal",
]


@dataclass(frozen=True)
class HiCCoords:
    """Genomic coordinates for the slice the matrices describe.

    ``start``/``end`` are 0-based half-open in base pairs. ``bin_size`` is
    the bp-width of one matrix bin (i.e. ``(end - start) / mat.shape[0]``
    for a square slice). All strategies must respect ``bin_size``.
    """

    chrom: str
    start: int
    end: int
    bin_size: int

    @property
    def n_bins(self) -> int:
        """Number of bins implied by the interval; assumes square slice."""
        span = self.end - self.start
        if self.bin_size <= 0:
            return 0
        return span // self.bin_size


@dataclass
class DerivedResult:
    """Uniform return shape for every Hi-C derived strategy.

    Attributes
    ----------
    kind:
        How the route layer should serialise ``values``:
          * ``matrix`` / ``matrix_diff`` — 2D float32, row-major
          * ``signal`` — 1D float32 (one value per bin on the diagonal)
          * ``boundaries`` — 1D int32 (bin indices of detected features)
    values:
        Strategy payload. Shape rules per ``kind`` (see above).
    extra:
        Strategy-specific metadata. The route layer forwards ``vmin``/
        ``vmax`` keys to the X-Genomics-* response headers when present.
    """

    kind: DerivedKind
    values: np.ndarray
    extra: dict[str, Any] = field(default_factory=dict)


class HiCDerivedStrategy(ABC):
    """Abstract base class for all Hi-C derived computation strategies.

    Subclasses set ``name`` (a short slug, used as the registry key) and
    implement ``compute``. The route layer calls the strategy like this::

        strategy = get_strategy("ab_compartment")
        result = strategy.compute(coords, matrices={"mat": log1p_submatrix})

    Subclasses document which keys of ``matrices`` they consume.
    """

    name: ClassVar[str]

    @abstractmethod
    def compute(
        self,
        coords: HiCCoords,
        matrices: dict[str, np.ndarray],
    ) -> DerivedResult:
        """Compute a derived signal from one or more log1p Hi-C sub-matrices.

        Parameters
        ----------
        coords:
            The genomic interval the matrices correspond to.
        matrices:
            Mapping from strategy-defined keys to ``log1p(mat)`` float32
            sub-matrices (square). Common keys: ``"mat"`` (single matrix),
            ``"mat_a"`` / ``"mat_b"`` (two-sample differential).
        """
        raise NotImplementedError


# --- Strategy registry --------------------------------------------------------

_REGISTRY: dict[str, HiCDerivedStrategy] = {}


def register(cls: type[HiCDerivedStrategy]) -> type[HiCDerivedStrategy]:
    """Class decorator that registers a strategy under ``cls.name``."""
    if not cls.name:
        raise ValueError(f"{cls.__name__}.name must be set")
    instance = cls()
    _REGISTRY[cls.name] = instance
    return cls


def get_strategy(name: str) -> HiCDerivedStrategy:
    """Look up a registered strategy by name; raise ``KeyError`` if missing."""
    if name not in _REGISTRY:
        raise KeyError(
            f"Unknown derived strategy: {name!r}. "
            f"Registered: {sorted(_REGISTRY)}"
        )
    return _REGISTRY[name]


def list_strategies() -> list[str]:
    """All registered strategy names (for diagnostics / introspection)."""
    return sorted(_REGISTRY)
