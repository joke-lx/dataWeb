"""``GET /api/bed/overlap`` — synthetic bed-style records.

Supported ``kind`` values: ``ab``, ``tad``, ``pei``, ``gene``. The response
is JSON ``{"records": [...]}`` where each record contains the fields
described in ``docx/plan/visualizable_features.md``.
"""

from __future__ import annotations

from fastapi import APIRouter, HTTPException, Query

from app.mock import bed_records

router = APIRouter(prefix="/api", tags=["bed"])

_VALID_KINDS = {"ab", "tad", "pei", "gene"}


@router.get("/bed/overlap")
async def bed_overlap_endpoint(
    sample: str = Query(..., description="Sample id, e.g. Brain_BF3"),
    track: str = Query("default", description="Track name (seed diversifier)"),
    chr: str = Query(..., alias="chr", description="Chromosome name"),
    start: int = Query(..., ge=0, description="Region start (bp, 0-based)"),
    end: int = Query(..., gt=0, description="Region end (bp, exclusive)"),
    kind: str = Query(..., description="Track kind: ab|tad|pei|gene"),
) -> dict:
    """Return bed-style records for the requested kind/region."""
    if kind not in _VALID_KINDS:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported kind '{kind}'. Expected one of {sorted(_VALID_KINDS)}.",
        )
    records = bed_records(sample, chr, start, end, track, kind)
    return {"records": records}