"""``GET /api/ctcf/loops`` — synthetic CTCF loop bedpe records.

Query parameters
----------------
``sample`` : sample id (e.g. ``Brain_BF3``)
``chr``    : chromosome (e.g. ``chr1``)
``start``  : region start (bp)
``end``    : region end (bp)

Returns JSON ``{"records": [...]}`` with bedpe-style entries
(``chrom1``/``start1``/``end1``/``chrom2``/``start2``/``end2``/``score``).
"""

from __future__ import annotations

from fastapi import APIRouter, Query

from app.mock import ctcf_loops

router = APIRouter(prefix="/api", tags=["ctcf"])


@router.get("/ctcf/loops")
async def ctcf_loops_endpoint(
    sample: str = Query(..., description="Sample id, e.g. Brain_BF3"),
    chr: str = Query(..., alias="chr", description="Chromosome name"),
    start: int = Query(..., ge=0, description="Region start (bp, 0-based)"),
    end: int = Query(..., gt=0, description="Region end (bp, exclusive)"),
) -> dict:
    """Return bedpe-style CTCF loop records for the requested region."""
    return {"records": ctcf_loops(sample, chr, start, end)}