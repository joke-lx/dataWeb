"""Stub reader for CTCF motif and genotype real-data files.

Intended as a drop-in replacement point once raw CTCF ChIP-seq and
variant-call data is available. Current implementation raises
``FileNotFoundError`` to signal "not yet wired" — callers should fall
back to the deterministic mock generator.
"""


def read_ctcf_motif(region: str) -> None:
    """Read CTCF motif PWM from real data (not yet implemented)."""
    raise FileNotFoundError("CTCF motif real data not available yet")


def read_ctcf_genotype(population: str) -> None:
    """Read CTCF genotype distribution from real data (not yet implemented)."""
    raise FileNotFoundError("CTCF genotype real data not available yet")
