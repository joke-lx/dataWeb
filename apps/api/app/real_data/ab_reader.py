"""Read real AB Index / mean track files for the pig dataset.

Supports two on-disk schemas (handled transparently):

* 4-column bedGraph:
    ``chrom<TAB>start<TAB>end<TAB>score``
* 5-column bedGraph with bin_index:
    ``bin_index<TAB>chrom<TAB>start<TAB>end<TAB>score``

The frontend only needs ``{chrom, start, end, score}`` so the bin_index is
always dropped and the chromosome name is normalized to the ``chrN`` form.
"""

from __future__ import annotations

from pathlib import Path
from typing import Optional

from .sample_resolver import DATA_ROOT, get_sample, normalize_chr

# ``bed_records`` lives in ``app.mock.generators``; we keep it as a lazy
# fallback so the route can gracefully degrade when a sample lacks the file.
_MEAN_TYPES = {"breed", "parental", "tissue"}


def _parse_bedgraph_line(line: str) -> Optional[dict]:
    """Parse a single 4- or 5-column bedGraph line.

    Returns ``None`` for empty/blank/malformed lines so callers can simply
    skip them.
    """
    stripped = line.strip()
    if not stripped:
        return None
    parts = stripped.split("\t")
    if len(parts) == 4:
        # chrom, start, end, score
        chrom_field, start_field, end_field, score_field = parts
    elif len(parts) >= 5:
        # bin_index, chrom, start, end, score[, ...]
        _, chrom_field, start_field, end_field, score_field = parts[:5]
    else:
        return None
    try:
        start = int(start_field)
        end = int(end_field)
        score = float(score_field)
    except ValueError:
        return None
    return {
        "chrom": normalize_chr(chrom_field),
        "start": start,
        "end": end,
        "score": score,
    }


def _read_bedgraph(path: Path) -> list[dict]:
    """Read an entire bedGraph file into a list of records."""
    if not path.exists():
        raise FileNotFoundError(f"Bedgraph file not found: {path}")
    records: list[dict] = []
    with open(path, "r", encoding="utf-8") as handle:
        for line in handle:
            record = _parse_bedgraph_line(line)
            if record is not None:
                records.append(record)
    return records


def read_ab_sample(sample_id: str) -> list[dict]:
    """Read a single-sample AB Index ``.txt`` for ``sample_id``.

    The sample ID is resolved through the real-data registry, which maps
    canonical IDs (e.g. ``Brain_BF3``) to on-disk paths under
    ``01.AB_compartment/``. Raises ``FileNotFoundError`` when the sample
    has no AB file.
    """
    sample = get_sample(sample_id)
    if not sample:
        raise FileNotFoundError(f"Unknown sample: {sample_id}")
    real_files = sample.get("real_files", {})
    rel = real_files.get("ab")
    if not rel:
        raise FileNotFoundError(f"No AB file registered for {sample_id}")
    path = DATA_ROOT / rel
    return _read_bedgraph(path)


def resolve_mean_track_path(
    mean_type: str, tissue: str, group: str = ""
) -> Path:
    """Compute the on-disk path for a mean AB track.

    ``mean_type`` is one of ``breed``, ``parental``, ``tissue``.
    For ``tissue`` mean, ``group`` is ignored. For ``breed`` / ``parental``
    mean, ``group`` is the breed name (``Berkshire``, ``Tibetan``) or the
    parental origin (``Maternal``, ``Paternal``).
    """
    if mean_type not in _MEAN_TYPES:
        raise ValueError(
            f"Invalid mean_type '{mean_type}'. Expected one of {sorted(_MEAN_TYPES)}."
        )
    base = DATA_ROOT / "01.AB_compartment"
    if mean_type == "tissue":
        return base / "Tissue_mean" / f"{tissue}.mean_AB_index.bedgraph"
    folder = f"{mean_type.capitalize()}_mean"
    return base / folder / f"{tissue}.{group}_mean_AB.bedgraph"


def read_ab_mean_track(mean_type: str, tissue: str, group: str = "") -> list[dict]:
    """Read a mean-track ``.bedgraph``.

    See :func:`resolve_mean_track_path` for the path convention.
    """
    path = resolve_mean_track_path(mean_type, tissue, group)
    return _read_bedgraph(path)