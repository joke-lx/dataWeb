"""Hi-C derived computation strategies.

Importing this package registers every strategy via the ``@register``
class decorator in each module. After ``from .derived import ...`` runs,
``get_strategy(name)`` returns an instance ready to ``compute()``.

Public surface:
    HiCDerivedStrategy        — base class for new strategies
    HiCCoords                 — input coordinates value object
    DerivedResult             — output value object
    get_strategy(name)        — lookup a registered strategy
    list_strategies()         — list all registered names
"""

from .base import (
    DerivedKind,
    DerivedResult,
    HiCCoords,
    HiCDerivedStrategy,
    get_strategy,
    list_strategies,
    register,
)

# Importing each strategy module ensures its ``@register`` decorator runs
# at package import time. Without these, strategies that were never
# directly imported elsewhere would not appear in ``list_strategies()``
# until their first route call.
from . import ab_compartment, activity, ctcf_loop, differential, insulation, sv, three_d  # noqa: F401

__all__ = [
    "DerivedKind",
    "DerivedResult",
    "HiCCoords",
    "HiCDerivedStrategy",
    "ab_compartment",
    "activity",
    "ctcf_loop",
    "differential",
    "get_strategy",
    "insulation",
    "list_strategies",
    "register",
    "sv",
    "three_d",
]
