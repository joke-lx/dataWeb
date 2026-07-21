"""``GET /api/bed/overlap`` — bed-style records backed by real data when available.

Supported ``kind`` values: ``ab``, ``tad``, ``pei``, ``gene``, ``is``.

The AB kind reads from real ``.txt`` / ``.bedgraph`` files when the requested
sample is registered in ``app/real_data/registry.yaml``. For mean tracks the
client can either pass a synthesised sample ID with the ``_mean`` suffix
(e.g. ``Brain_Berkshire_mean``) or the explicit ``mean``/``tissue``/``group``
query parameters. The TAD kind reads from real ``.TAD`` / ``.200k`` files in
``02.TAD/boundary/``; pass ``filtered=true`` to use the cut200k length-
filtered file when one exists for the sample. When real data is unavailable
(unknown sample, missing file, unsupported kind), the deterministic mock
generator is used as a fallback so existing UI behaviour is preserved.
"""

from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, HTTPException, Query

from app.mock import bed_records as mock_bed_records
from app.real_data.ab_reader import read_ab_mean_track, read_ab_sample
from app.real_data.pei_reader import read_pei_sample
from app.real_data.sample_resolver import get_sample
from app.real_data.tad_reader import read_tad_sample

router = APIRouter(prefix="/api", tags=["bed"])

_VALID_KINDS = {"ab", "tad", "pei", "gene", "is"}
_MEAN_KINDS = {"breed", "parental", "tissue"}
_MEAN_TISSUES = {"Brain", "Liver", "Muscle"}
_MEAN_GROUPS = {
    "breed": {"Berkshire", "Tibetan"},
    "parental": {"Maternal", "Paternal"},
    "tissue": set(),  # tissue-mean has no group dimension
}


def _parse_mean_id(sample_id: str) -> Optional[tuple[str, str, str]]:
    """Parse a synthesised mean-track sample ID into ``(mean_type, tissue, group)``.

    Accepted forms:

    * ``<Tissue>_mean`` — tissue-mean track (e.g. ``Liver_mean``)
    * ``<Tissue>_<Group>_mean`` — breed- or parental-mean track
      (e.g. ``Brain_Berkshire_mean``, ``Brain_Maternal_mean``)

    The mean_type is inferred by looking the candidate file up on disk
    under each of the three mean folders in turn.
    """
    if not sample_id.endswith("_mean"):
        return None
    body = sample_id[: -len("_mean")]
    parts = body.split("_", 1)
    if not parts:
        return None
    tissue = parts[0]
    group = parts[1] if len(parts) > 1 else ""
    if tissue not in _MEAN_TISSUES:
        return None
    # Infer mean_type by trying each folder; the first existing file wins.
    from app.real_data.ab_reader import resolve_mean_track_path

    if not group:
        # Only the tissue-mean folder has no group dimension.
        path = resolve_mean_track_path("tissue", tissue, "")
        if path.exists():
            return "tissue", tissue, ""
        return None
    for mean_type in ("breed", "parental"):
        path = resolve_mean_track_path(mean_type, tissue, group)
        if path.exists():
            return mean_type, tissue, group
    return None


def _resolve_ab_records(
    sample: str,
    mean: Optional[str],
    tissue: Optional[str],
    group: Optional[str],
) -> list[dict]:
    """Return AB records, reading from real data when possible.

    Resolution order:
        1. Explicit ``mean``/``tissue``/``group`` query parameters.
        2. A synthesised ``<Tissue>_<Group>_mean`` sample ID.
        3. A registered base sample (e.g. ``Brain_BF3``).
        4. Raise ``FileNotFoundError`` so the caller can fall back to the
           mock generator.
    """
    if mean:
        mean_type = mean
        if mean_type not in _MEAN_KINDS:
            raise FileNotFoundError(
                f"Unknown mean type '{mean}'. Expected one of {sorted(_MEAN_KINDS)}."
            )
        if not tissue:
            raise FileNotFoundError("mean query requires 'tissue'")
        resolved_group = group or ""
        if mean_type != "tissue":
            valid_groups = _MEAN_GROUPS[mean_type]
            if resolved_group not in valid_groups:
                raise FileNotFoundError(
                    f"Invalid group '{resolved_group}' for mean_type={mean_type}; "
                    f"expected one of {sorted(valid_groups)}."
                )
        return read_ab_mean_track(mean_type, tissue, resolved_group)

    parsed = _parse_mean_id(sample)
    if parsed is not None:
        mean_type, parsed_tissue, parsed_group = parsed
        return read_ab_mean_track(mean_type, parsed_tissue, parsed_group)

    sample_entry = get_sample(sample)
    if sample_entry and "ab" in sample_entry.get("real_files", {}):
        return read_ab_sample(sample)

    raise FileNotFoundError(f"No real AB data for sample '{sample}'")


@router.get("/bed/overlap")
async def bed_overlap_endpoint(
    sample: str = Query(..., description="Sample id, e.g. Brain_BF3"),
    track: str = Query("default", description="Track name (seed diversifier)"),
    chr: str = Query(..., alias="chr", description="Chromosome name"),
    start: int = Query(..., ge=0, description="Region start (bp, 0-based)"),
    end: int = Query(..., ge=0, description="Region end (bp, exclusive)"),
    kind: str = Query(..., description="Track kind: ab|tad|pei|gene|is"),
    mean: Optional[str] = Query(
        None,
        description="Mean-track kind (ab only): breed|parental|tissue. "
        "Use with 'tissue' and 'group'.",
    ),
    tissue: Optional[str] = Query(
        None, description="Tissue for mean tracks (Brain|Liver|Muscle)."
    ),
    group: Optional[str] = Query(
        None,
        description="Group for breed/parental mean (Berkshire|Tibetan|Maternal|Paternal).",
    ),
    filtered: bool = Query(
        False,
        description="TAD only: when true, prefer the cut200k (length-filtered) "
        "file if one exists for this sample.",
    ),
) -> dict:
    """Return bed-style records for the requested kind/region."""
    if kind not in _VALID_KINDS:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported kind '{kind}'. Expected one of {sorted(_VALID_KINDS)}.",
        )

    records: list[dict]
    if kind == "ab":
        try:
            records = _resolve_ab_records(sample, mean, tissue, group)
        except FileNotFoundError:
            # Graceful fallback to the mock so the UI never breaks when the
            # real file is missing or the sample isn't registered yet.
            records = mock_bed_records(sample, chr, start, end, track, kind)
    elif kind == "tad":
        try:
            records = read_tad_sample(sample, filtered=filtered)
        except FileNotFoundError:
            records = mock_bed_records(sample, chr, start, end, track, kind)
    elif kind == "pei":
        try:
            records = read_pei_sample(sample)
        except FileNotFoundError:
            records = mock_bed_records(sample, chr, start, end, track, kind)
    else:
        records = mock_bed_records(sample, chr, start, end, track, kind)

    # Real files are whole-genome; filter to the requested region. Mock
    # records already span only [start, end), so the filter is a no-op for them.
    filtered_records = [
        record
        for record in records
        if record["chrom"] == chr and record["end"] > start and record["start"] < end
    ]
    return {"records": filtered_records}