"""Read real TAD boundary files.

File formats
------------
``.TAD`` (e.g. ``02.TAD/boundary/Brain_BF3.IS_split.TAD``)
    Three tab-separated columns: ``chrom<TAB>start<TAB>end``. No score column.

``.200k`` (e.g. ``02.TAD/boundary/cut200k/Brain_BF3.IS_split.TAD.length.200k``)
    Four tab-separated columns: ``chrom<TAB>start<TAB>end<TAB>length``. The
    trailing length column is exposed as ``score``.

Rows that fail to parse are silently skipped so a single malformed entry does
not abort an otherwise useful response.
"""

from __future__ import annotations

from .sample_resolver import DATA_ROOT, get_sample, normalize_chr


def _open_path(rel: str | None):
    """Return ``(absolute_path, file_handle)`` or raise ``FileNotFoundError``."""
    if not rel:
        raise FileNotFoundError("No TAD path registered for this sample")
    path = DATA_ROOT / rel
    return path, open(path, "r", encoding="utf-8")


def read_tad_sample(sample_id: str, filtered: bool = False) -> list[dict]:
    """Read TAD records for ``sample_id`` from disk.

    When ``filtered`` is ``True`` and the registry has a ``tad_200k`` entry the
    cut200k (length-filtered) file is used; otherwise the canonical ``.TAD``
    file is returned. Samples without a ``tad_200k`` entry (e.g. dev_stage
    variants) transparently fall back to ``.TAD`` even when ``filtered`` is
    requested.

    Returns a list of ``{chrom, start, end}`` records. ``.200k`` rows also
    expose ``score`` (the trailing length column).
    """
    sample = get_sample(sample_id)
    if not sample:
        raise FileNotFoundError(f"Sample {sample_id} not in registry")

    real_files = sample.get("real_files", {}) or {}
    rel = real_files.get("tad_200k") if filtered else None
    if rel is None:
        rel = real_files.get("tad")

    path, handle = _open_path(rel)
    try:
        return _parse_tad(handle)
    finally:
        handle.close()


def _parse_tad(handle) -> list[dict]:
    """Parse TAD rows from an open text handle.

    Accepts both 3-column (``.TAD``) and 4-column (``.200k``) layouts so a
    caller that opens the wrong file variant still gets the chrom/start/end
    triple back rather than an exception.
    """
    records: list[dict] = []
    for line in handle:
        parts = line.rstrip("\n").split("\t")
        if len(parts) < 3:
            continue
        try:
            start = int(parts[1])
            end = int(parts[2])
        except ValueError:
            continue
        record = {
            "chrom": normalize_chr(parts[0]),
            "start": start,
            "end": end,
        }
        # 4-column rows (``.200k``) carry a length value as the 4th field.
        if len(parts) >= 4:
            try:
                record["score"] = float(parts[3])
            except ValueError:
                record["score"] = 0.0
        records.append(record)
    return records