"""Mock package for the dataWeb API.

Contains the deterministic sample/chromosome registry and the seed-keyed
generators used by the FastAPI routes.
"""

from .generators import (
    bed_records,
    bigwig_track,
    ctcf_genotype_distribution,
    ctcf_loops,
    ctcf_motif_matrix,
    differential_hic,
    hic_matrix,
    insulation_score,
    sv_records,
)
from .registry import CHROMOSOMES, SAMPLES, SPECIES, find_sample
from .samples import CHROMOSOMES as _CHROMOSOMES  # re-export

__all__ = [
    "CHROMOSOMES",
    "SAMPLES",
    "SPECIES",
    "bed_records",
    "bigwig_track",
    "ctcf_genotype_distribution",
    "ctcf_loops",
    "ctcf_motif_matrix",
    "differential_hic",
    "find_sample",
    "hic_matrix",
    "insulation_score",
    "sv_records",
]