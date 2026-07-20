"""``GET /api/sv`` — synthetic structural-variant records.

Query parameters
----------------
``sample`` : sample id (e.g. ``Brain_BF3``)
``chr``    : chromosome (e.g. ``chr1``)
``start``  : region start (bp)
``end``    : region end (bp)

Returns JSON ``{"records": [...]}`` with ``kind`` drawn from
``{DEL, DUP, INV, TRA}``.
"""

from __future__ import annotations

from fastapi import APIRouter, Query

from app.mock import sv_records

router = APIRouter(prefix="/api", tags=["sv"])


@router.get("/sv")
async def sv_endpoint(
    sample: str = Query(..., description="Sample id, e.g. Brain_BF3"),
    chr: str = Query(..., alias="chr", description="Chromosome name"),
    start: int = Query(..., ge=0, description="Region start (bp, 0-based)"),
    end: int = Query(..., gt=0, description="Region end (bp, exclusive)"),
) -> dict:
    """Return synthetic structural-variant records for the requested region."""
    return {"records": sv_records(sample, chr, start, end)}