"""``GET /api/hic/matrix`` — synthetic Hi-C contact matrix as float32 bytes.

Query parameters
----------------
``sample`` : sample id (e.g. ``Brain_BF3``)
``chr``    : chromosome (e.g. ``chr1``)
``start``  : 1-based inclusive start in bp
``end``    : 1-based exclusive end in bp
``bin``    : bin size in bp

The response body is the raw little-endian ``float32`` matrix (row-major),
with shape and colour-range metadata in custom headers:

* ``X-Genomics-Dtype`` — ``float32``
* ``X-Genomics-Shape`` — ``"{rows},{cols}"``
* ``X-Genomics-Vmin``  — matrix minimum (after ``log1p``)
* ``X-Genomics-Vmax``  — 99th percentile (used as the client's colour-map upper bound)
"""

from __future__ import annotations

from fastapi import APIRouter, Query
from fastapi.responses import Response

from app.mock import hic_matrix

router = APIRouter(prefix="/api", tags=["hic"])


@router.get("/hic/matrix")
async def hic_matrix_endpoint(
    sample: str = Query(..., description="Sample id, e.g. Brain_BF3"),
    chr: str = Query(..., alias="chr", description="Chromosome name"),
    start: int = Query(..., ge=0, description="Region start (bp, 0-based)"),
    end: int = Query(..., gt=0, description="Region end (bp, exclusive)"),
    bin: int = Query(..., gt=0, alias="bin", description="Bin size in bp"),
) -> Response:
    """Return the synthetic Hi-C contact matrix as raw float32 bytes."""
    mat, vmin, vmax = hic_matrix(sample, chr, start, end, bin)
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