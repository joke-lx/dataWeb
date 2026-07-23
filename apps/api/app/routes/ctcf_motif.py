"""``GET /api/ctcf/motif`` and ``GET /api/ctcf/genotype`` — synthetic CTCF motif PWM
and population genotype distribution.

Query parameters
----------------
``motif``:
  ``sample`` : sample id (e.g. ``Brain_BF3``)
  ``chr``    : chromosome (e.g. ``chr1``)
  ``start``  : region start (bp)
  ``end``    : region end (bp)

Returns JSON ``{"matrix": [[float x 4] x 19], "consensus": str, "anchor_pos": int}``

``genotype``:
  ``population`` : population label (e.g. ``global``, ``Tibetan``, ``Berkshire``)

Returns JSON ``{"records": [...]}`` with SNP genotype distributions.
"""

from __future__ import annotations

from fastapi import APIRouter, Query

from app.mock import ctcf_genotype_distribution, ctcf_motif_matrix

router = APIRouter(prefix="/api", tags=["ctcf-motif"])


@router.get("/ctcf/motif")
async def ctcf_motif_endpoint(
    sample: str = Query("default", description="Sample id"),
    chr: str = Query("chr1", alias="chr", description="Chromosome name"),
    start: int = Query(1_000_000, ge=0, description="Region start (bp)"),
    end: int = Query(2_000_000, gt=0, description="Region end (bp)"),
) -> dict:
    """Return a synthetic CTCF motif PWM for the requested region."""
    return ctcf_motif_matrix(sample, chr, start, end)


@router.get("/ctcf/genotype")
async def ctcf_genotype_endpoint(
    population: str = Query("global", description="Population label"),
) -> dict:
    """Return synthetic genotype distribution at CTCF anchor SNP sites."""
    return ctcf_genotype_distribution(population)
