"""``GET /api/differential/matrix`` — log2 ratio of two Hi-C samples.

Query parameters
----------------
``sample_a`` : first sample id (e.g. ``Brain_BF3``)
``sample_b`` : second sample id (e.g. ``Liver_BF3``)
``chr``      : chromosome (e.g. ``chr1``)
``start``    : region start (bp)
``end``      : region end (bp)
``bin``      : bin size in bp

The response body is the raw little-endian ``float32`` matrix (row-major).
``X-Genomics-Vmin`` / ``X-Genomics-Vmax`` are the symmetric ±99th-percentile
clip values used as the colour-map range.
"""

from __future__ import annotations

from fastapi import APIRouter, Query
from fastapi.responses import Response

from app.mock import differential_hic

router = APIRouter(prefix="/api", tags=["differential"])


@router.get("/differential/matrix")
async def differential_matrix_endpoint(
    sample_a: str = Query(..., description="First sample id, e.g. Brain_BF3"),
    sample_b: str = Query(..., description="Second sample id, e.g. Liver_BF3"),
    chr: str = Query(..., alias="chr", description="Chromosome name"),
    start: int = Query(..., ge=0, description="Region start (bp, 0-based)"),
    end: int = Query(..., gt=0, description="Region end (bp, exclusive)"),
    bin: int = Query(..., gt=0, alias="bin", description="Bin size in bp"),
) -> Response:
    """Return the differential Hi-C matrix as raw float32 bytes."""
    mat, vmin, vmax = differential_hic(sample_a, sample_b, chr, start, end, bin)
    return Response(
        content=mat.tobytes(),
        media_type="application/octet-stream",
        headers={
            "X-Genomics-Dtype": "float32",
            "X-Genomics-Shape": f"{mat.shape[0]},{mat.shape[1]}",
            "X-Genomics-Vmin": str(vmin),
            "X-Genomics-Vmax": str(vmax),
        },
    )