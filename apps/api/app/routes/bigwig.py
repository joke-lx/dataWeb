"""``GET /api/bigwig/values`` — 1D signal track as float32 bytes.

Query parameters
----------------
``sample``  : sample id
``track``   : track name (registry key for real data, free-form for mock)
``chr``     : chromosome
``start``   : region start (bp)
``end``     : region end (bp)
``bins``    : number of output bins along the region

The response body is the raw little-endian ``float32`` array, with shape
metadata in the ``X-Genomics-Shape`` header (``"{N}"``). When a registry-backed
real-data track is available it is served directly; otherwise the request falls
back to the deterministic mock generator.
"""

from __future__ import annotations

import logging

from fastapi import APIRouter, Query
from fastapi.responses import Response
from numpy.typing import NDArray

from app.mock import bigwig_track
from app.real_data.bigwig_reader import read_bigwig_track

router = APIRouter(prefix="/api", tags=["bigwig"])
logger = logging.getLogger(__name__)


def _binary_response(values: NDArray, vmin: float, vmax: float) -> Response:
    return Response(
        content=values.tobytes(),
        media_type="application/octet-stream",
        headers={
            "X-Genomics-Dtype": "float32",
            "X-Genomics-Shape": f"{values.shape[0]}",
            "X-Genomics-Vmin": repr(float(vmin)),
            "X-Genomics-Vmax": repr(float(vmax)),
        },
    )


@router.get("/bigwig/values")
async def bigwig_values_endpoint(
    sample: str = Query(..., description="Sample id, e.g. Brain_BF3"),
    track: str = Query("rna_seq", description="Track name"),
    chr: str = Query(..., alias="chr", description="Chromosome name"),
    start: int = Query(..., ge=0, description="Region start (bp, 0-based)"),
    end: int = Query(..., gt=0, description="Region end (bp, exclusive)"),
    bins: int = Query(..., gt=0, description="Number of output bins"),
) -> Response:
    """Return the signal track as raw float32 bytes."""
    try:
        result = read_bigwig_track(sample, track, chr, start, end, bins)
    except FileNotFoundError as error:
        logger.debug("Falling back to mock bigwig for %s/%s: %s", sample, track, error)
        arr = bigwig_track(sample, chr, start, end, bins, track)
        return _binary_response(arr, float(arr.min()), float(arr.max()))
    return _binary_response(result["values"], result["vmin"], result["vmax"])
