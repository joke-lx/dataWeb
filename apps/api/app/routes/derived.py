"""``GET /api/derived/*`` — Hi-C derived signals computed on the fly.

Each endpoint reads the real (or falls back to mock) Hi-C sub-matrix for
the requested interval, runs a registered strategy, and serialises the
result. Response formats follow the existing binary/JSON conventions:

* ``/api/derived/tad_boundary`` → JSON ``{"records": [{chrom,start,end}...]}``
  (same shape as ``/api/bed/overlap?kind=tad``).
* ``/api/derived/insulation``   → JSON ``{"records": [{chrom,start,end,score}...]}``
  (same shape as ``/api/bed/overlap?kind=is``).
* ``/api/derived/ab``           → JSON ``{"records": [{chrom,start,end,score}...]}``
  (same shape as ``/api/bed/overlap?kind=ab``).
* ``/api/derived/differential`` → raw float32 bytes + ``X-Genomics-*`` headers
  (same shape as ``/api/differential/matrix``).

Fallback contract: when the real Hi-C cache is unavailable
(``DATAWEB_HIC_ROOT`` unset / missing npy), the endpoint falls back to the
deterministic mock generator so existing UI never breaks — identical to how
``bed.py`` and ``differential.py`` already behave.
"""

from __future__ import annotations

import logging
from typing import Annotated, Any

import numpy as np
from fastapi import APIRouter, Query
from fastapi.responses import Response

from app.mock import bed_records as mock_bed_records
from app.mock import differential_hic as mock_differential_hic
from app.real_data.derived import (
    HiCCoords,
    get_strategy,
)
from app.real_data.hic_reader import read_hic_matrix

router = APIRouter(prefix="/api", tags=["derived"])
logger = logging.getLogger(__name__)


def _load_real_matrix(
    sample: str,
    chrom: str,
    start: int,
    end: int,
    bin_bp: int,
) -> tuple[Any, bool]:
    """Load the log1p Hi-C sub-matrix; return ``(matrix_or_None, is_real)``."""
    try:
        mat, _, _ = read_hic_matrix(sample, chrom, start, end, bin_bp)
        # read_hic_matrix returns 0×0 for out-of-coverage — treat as no data.
        if mat.size == 0:
            return None, False
        return mat, True
    except FileNotFoundError:
        return None, False


def _bin_size_for(start: int, end: int, bin_bp: int) -> int:
    """Round requested bp-bin down to a sensible slice bin size."""
    return max(1, bin_bp)


@router.get("/derived/tad_boundary")
async def derived_tad_boundary(
    sample: Annotated[str, Query(description="Sample id")],
    chr: Annotated[str, Query(alias="chr", description="Chromosome")],
    start: Annotated[int, Query(ge=0, description="Region start (bp)")],
    end: Annotated[int, Query(gt=0, description="Region end (bp, exclusive)")],
    bin: Annotated[int, Query(gt=0, description="Bin size (bp)")],
) -> dict:
    """TAD boundaries from the Insulation-Score strategy (real) or mock fallback."""
    mat, is_real = _load_real_matrix(sample, chr, start, end, bin)
    if not is_real or mat is None:
        logger.debug("Falling back to mock tad_boundary for %s/%s", sample, chr)
        records = mock_bed_records(sample, chr, start, end, "tad", "tad")
        return {"records": records, "source": "mock"}

    coords = HiCCoords(chrom=chr, start=start, end=end, bin_size=_bin_size_for(start, end, bin))
    result = get_strategy("tad_boundary").compute(coords, {"mat": mat})
    n = coords.n_bins
    records = [
        {
            "chrom": chr,
            "start": start + int(b) * bin,
            "end": start + int(b) * bin + bin,
        }
        for b in result.values.tolist()
        if 0 <= int(b) < n
    ]
    return {"records": records, "source": "real"}


@router.get("/derived/insulation")
async def derived_insulation(
    sample: Annotated[str, Query(description="Sample id")],
    chr: Annotated[str, Query(alias="chr", description="Chromosome")],
    start: Annotated[int, Query(ge=0, description="Region start (bp)")],
    end: Annotated[int, Query(gt=0, description="Region end (bp, exclusive)")],
    bin: Annotated[int, Query(gt=0, description="Bin size (bp)")],
    n_bins: Annotated[int, Query(ge=1, le=2000, description="Output bins")] = 100,
) -> dict:
    """Insulation Score signal (real strategy) or mock fallback."""
    mat, is_real = _load_real_matrix(sample, chr, start, end, bin)
    if not is_real or mat is None:
        logger.debug("Falling back to mock insulation for %s/%s", sample, chr)
        records = mock_bed_records(sample, chr, start, end, "is", "is")
        return {"records": records, "source": "mock"}

    coords = HiCCoords(chrom=chr, start=start, end=end, bin_size=_bin_size_for(start, end, bin))
    result = get_strategy("insulation_score").compute(coords, {"mat": mat})
    n = coords.n_bins
    # Resample the per-bin signal to the requested n_bins by averaging.
    values = result.values
    if n == n_bins:
        resampled = values
    else:
        resampled = _resample_1d(values, n_bins)
    records = [
        {
            "chrom": chr,
            "start": start + i * (end - start) // n_bins,
            "end": start + (i + 1) * (end - start) // n_bins,
            "score": float(resampled[i]),
        }
        for i in range(n_bins)
    ]
    return {"records": records, "source": "real"}


@router.get("/derived/ab")
async def derived_ab(
    sample: Annotated[str, Query(description="Sample id")],
    chr: Annotated[str, Query(alias="chr", description="Chromosome")],
    start: Annotated[int, Query(ge=0, description="Region start (bp)")],
    end: Annotated[int, Query(gt=0, description="Region end (bp, exclusive)")],
    bin: Annotated[int, Query(gt=0, description="Bin size (bp)")],
    n_bins: Annotated[int, Query(ge=1, le=2000, description="Output bins")] = 100,
) -> dict:
    """A/B compartment score (real strategy) or mock fallback."""
    mat, is_real = _load_real_matrix(sample, chr, start, end, bin)
    if not is_real or mat is None:
        logger.debug("Falling back to mock ab for %s/%s", sample, chr)
        records = mock_bed_records(sample, chr, start, end, "ab", "ab")
        return {"records": records, "source": "mock"}

    coords = HiCCoords(chrom=chr, start=start, end=end, bin_size=_bin_size_for(start, end, bin))
    result = get_strategy("ab_compartment").compute(coords, {"mat": mat})
    values = result.values
    if values.size != coords.n_bins:
        resampled = _resample_1d(values, coords.n_bins)
    else:
        resampled = values
    if coords.n_bins != n_bins:
        resampled = _resample_1d(resampled, n_bins)
    records = [
        {
            "chrom": chr,
            "start": start + i * (end - start) // n_bins,
            "end": start + (i + 1) * (end - start) // n_bins,
            "score": float(resampled[i]),
        }
        for i in range(n_bins)
    ]
    return {"records": records, "source": "real"}


@router.get("/derived/differential")
async def derived_differential(
    sample_a: Annotated[str, Query(description="First sample id")],
    sample_b: Annotated[str, Query(description="Second sample id")],
    chr: Annotated[str, Query(alias="chr", description="Chromosome")],
    start: Annotated[int, Query(ge=0, description="Region start (bp)")],
    end: Annotated[int, Query(gt=0, description="Region end (bp, exclusive)")],
    bin: Annotated[int, Query(gt=0, description="Bin size (bp)")],
) -> Response:
    """Differential log-ratio (real strategy) or mock fallback."""
    mat_a, a_real = _load_real_matrix(sample_a, chr, start, end, bin)
    mat_b, b_real = _load_real_matrix(sample_b, chr, start, end, bin)
    if not (a_real and b_real) or mat_a is None or mat_b is None:
        logger.debug("Falling back to mock differential for %s/%s", sample_a, sample_b)
        mat, vmin, vmax = mock_differential_hic(sample_a, sample_b, chr, start, end, bin)
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

    coords = HiCCoords(chrom=chr, start=start, end=end, bin_size=_bin_size_for(start, end, bin))
    result = get_strategy("differential_hic").compute(
        coords, {"mat_a": mat_a, "mat_b": mat_b}
    )
    mat = result.values
    vmin = float(result.extra.get("vmin", 0.0))
    vmax = float(result.extra.get("vmax", 0.0))
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


def _resample_1d(values: Any, n_out: int) -> Any:
    """Average a 1D signal into ``n_out`` bins (handles len<n_out)."""
    import numpy as np

    values = np.asarray(values, dtype=np.float32)
    n_in = values.size
    if n_in == 0:
        return np.zeros(n_out, dtype=np.float32)
    if n_in == n_out:
        return values
    if n_out <= 0:
        return np.zeros(0, dtype=np.float32)
    # Block-average from n_in to n_out.
    factor = n_in / n_out
    out = np.zeros(n_out, dtype=np.float32)
    for i in range(n_out):
        lo = int(i * factor)
        hi = max(lo + 1, int((i + 1) * factor))
        out[i] = float(values[lo:hi].mean())
    return out


# ---------------------------------------------------------------------------
# New strategies: 3D structure, CTCF loops, SV, expression activity proxy
# ---------------------------------------------------------------------------


@router.get("/derived/three_d")
async def derived_three_d(
    sample: Annotated[str, Query(description="Sample id")],
    chr: Annotated[str, Query(alias="chr", description="Chromosome")],
    start: Annotated[int, Query(ge=0, description="Region start (bp)")],
    end: Annotated[int, Query(gt=0, description="Region end (bp, exclusive)")],
    bin: Annotated[int, Query(gt=0, description="Bin size (bp)")],
) -> dict:
    """3D chromatin coordinates from classical MDS on the Hi-C sub-matrix.

    Returns ``{"coords": [[x,y,z], ...], "n_bins": N, "source": "real"|"mock"}``.
    For "mock" we return an empty coords list (no 3D model without real data).
    """
    mat, is_real = _load_real_matrix(sample, chr, start, end, bin)
    if not is_real or mat is None:
        return {"coords": [], "n_bins": 0, "source": "mock"}
    coords = HiCCoords(chrom=chr, start=start, end=end, bin_size=_bin_size_for(start, end, bin))
    result = get_strategy("three_d").compute(coords, {"mat": mat})
    coords_array = np.asarray(result.values, dtype=np.float32)
    return {
        "coords": coords_array.tolist(),
        "n_bins": int(result.extra.get("n_bins", coords_array.shape[0])),
        "source": "real",
    }


@router.get("/derived/ctcf_loop")
async def derived_ctcf_loop(
    sample: Annotated[str, Query(description="Sample id")],
    chr: Annotated[str, Query(alias="chr", description="Chromosome")],
    start: Annotated[int, Query(ge=0, description="Region start (bp)")],
    end: Annotated[int, Query(gt=0, description="Region end (bp, exclusive)")],
    bin: Annotated[int, Query(gt=0, description="Bin size (bp)")],
) -> dict:
    """CTCF loop anchors detected from the Hi-C sub-matrix.

    The strategy returns bin indices (anchor1, anchor2); this route converts
    them to bp coordinates so the shape matches ``/api/ctcf/loops``:
    ``{"records": [{chrom1, start1, end1, chrom2, start2, end2, score}...],
        "source": "real"|"mock"}``.
    On mock fallback, records is an empty list.
    """
    mat, is_real = _load_real_matrix(sample, chr, start, end, bin)
    if not is_real or mat is None:
        return {"records": [], "source": "mock"}
    coords = HiCCoords(chrom=chr, start=start, end=end, bin_size=_bin_size_for(start, end, bin))
    result = get_strategy("ctcf_loop").compute(coords, {"mat": mat})
    bin_size = coords.bin_size
    records = []
    for loop in list(np.asarray(result.values, dtype=object).tolist()):
        a1 = int(loop["anchor1"])
        a2 = int(loop["anchor2"])
        s1 = start + a1 * bin_size
        e1 = s1 + bin_size
        s2 = start + a2 * bin_size
        e2 = s2 + bin_size
        records.append(
            {
                "chrom1": chr,
                "start1": s1,
                "end1": e1,
                "chrom2": chr,
                "start2": s2,
                "end2": e2,
                "score": float(loop.get("score", 0.0)),
            }
        )
    return {"records": records, "source": "real"}


@router.get("/derived/sv")
async def derived_sv(
    sample: Annotated[str, Query(description="Sample id")],
    chr: Annotated[str, Query(alias="chr", description="Chromosome")],
    start: Annotated[int, Query(ge=0, description="Region start (bp)")],
    end: Annotated[int, Query(gt=0, description="Region end (bp, exclusive)")],
    bin: Annotated[int, Query(gt=0, description="Bin size (bp)")],
) -> dict:
    """Large-scale structural-variant breakpoints from Hi-C off-diagonal loss.

    Returns ``{"records": [{chrom,start,end,kind}...], "source": ...}``.
    On mock fallback, records is an empty list (SV has no synthetic mock).
    """
    mat, is_real = _load_real_matrix(sample, chr, start, end, bin)
    if not is_real or mat is None:
        return {"records": [], "source": "mock"}
    coords = HiCCoords(chrom=chr, start=start, end=end, bin_size=_bin_size_for(start, end, bin))
    result = get_strategy("sv_bed").compute(coords, {"mat": mat})
    if isinstance(result.values, list):
        records = result.values
    else:
        records = list(np.asarray(result.values, dtype=object).tolist())
    return {"records": records, "source": "real"}


@router.get("/derived/activity")
async def derived_activity(
    sample: Annotated[str, Query(description="Sample id")],
    chr: Annotated[str, Query(alias="chr", description="Chromosome")],
    start: Annotated[int, Query(ge=0, description="Region start (bp)")],
    end: Annotated[int, Query(gt=0, description="Region end (bp, exclusive)")],
    bin: Annotated[int, Query(gt=0, description="Bin size (bp)")],
    n_bins: Annotated[int, Query(ge=1, le=2000, description="Output bins")] = 100,
) -> dict:
    """Expression/ChIP/ATAC activity proxy derived from Hi-C A/B compartment.

    This is NOT real RNA-seq/ChIP-seq/ATAC — it is a proxy: A-compartment
    bins (active) get high scores, B-compartment bins (inactive) get low.
    The endpoint always sets ``source: "ab_proxy"`` so the UI can label it.
    Returns ``{"records": [{chrom,start,end,score}...], "source": "ab_proxy"}``.
    """
    mat, is_real = _load_real_matrix(sample, chr, start, end, bin)
    if not is_real or mat is None:
        return {
            "records": [],
            "source": "ab_proxy",
            "note": "Hi-C data unavailable - cannot derive activity proxy.",
        }
    coords = HiCCoords(chrom=chr, start=start, end=end, bin_size=_bin_size_for(start, end, bin))
    result = get_strategy("activity_signal").compute(coords, {"mat": mat})
    values = result.values
    if values.size != coords.n_bins:
        values = _resample_1d(values, coords.n_bins)
    if coords.n_bins != n_bins:
        values = _resample_1d(values, n_bins)
    records = [
        {
            "chrom": chr,
            "start": start + i * (end - start) // n_bins,
            "end": start + (i + 1) * (end - start) // n_bins,
            "score": float(values[i]),
        }
        for i in range(n_bins)
    ]
    return {
        "records": records,
        "source": "ab_proxy",
        "note": str(result.extra.get("note", "Derived from Hi-C A/B compartment.")),
    }
