"""``GET /api/bigwig/values`` — synthetic 1D bigwig signal as float32 bytes.

Query parameters
----------------
``sample``  : sample id
``track``   : track name (free-form, used to diversify the seed)
``chr``     : chromosome
``start``   : region start (bp)
``end``     : region end (bp)
``bins``    : number of output bins along the region

The response body is the raw little-endian ``float32`` array, with shape
metadata in the ``X-Genomics-Shape`` header (``"{N}"``).
"""

from __future__ import annotations

from fastapi import APIRouter, Query
from fastapi.responses import Response

from app.mock import bigwig_track

router = APIRouter(prefix="/api", tags=["bigwig"])


@router.get("/bigwig/values")
async def bigwig_values_endpoint(
    sample: str = Query(..., description="Sample id, e.g. Brain_BF3"),
    track: str = Query("rna_seq", description="Track name"),
    chr: str = Query(..., alias="chr", description="Chromosome name"),
    start: int = Query(..., ge=0, description="Region start (bp, 0-based)"),
    end: int = Query(..., gt=0, description="Region end (bp, exclusive)"),
    bins: int = Query(..., gt=0, description="Number of output bins"),
) -> Response:
    """Return the synthetic bigwig signal as raw float32 bytes."""
    arr = bigwig_track(sample, chr, start, end, bins, track)
    return Response(
        content=arr.tobytes(),
        media_type="application/octet-stream",
        headers={
            "X-Genomics-Dtype": "float32",
            "X-Genomics-Shape": f"{arr.shape[0]}",
        },
    )