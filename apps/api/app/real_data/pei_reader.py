"""Read real PEI (Promoter-Enhancer Interaction) files for the pig dataset.

The PEI files use an 8-column tab-separated schema. The fourth column
(``gene_details``) packs several colon-separated fields:

    EnsemblGeneID:distance_to_gene:p_value:q_value:score:rank

Only the gene id and the numeric columns are needed by the API; this
reader extracts them into a flat record dict per row.
"""

from __future__ import annotations

from pathlib import Path

from .sample_resolver import DATA_ROOT, get_sample, normalize_chr

# Minimum number of tab-separated columns required for a usable record.
_MIN_COLUMNS = 8


def _parse_gene_details(gene_details: str) -> tuple[str, float | None]:
    """Split ``EnsemblID:dist:p:q:score:rank`` into ``(gene_id, p_value)``."""
    if ":" not in gene_details:
        return gene_details, None
    tokens = gene_details.split(":")
    gene_id = tokens[0]
    p_value: float | None = None
    if len(tokens) >= 3:
        try:
            p_value = float(tokens[2])
        except ValueError:
            p_value = None
    return gene_id, p_value


def read_pei_sample(sample_id: str) -> list[dict]:
    """Return PEI records for ``sample_id`` parsed from its real file."""
    sample = get_sample(sample_id)
    if not sample:
        raise FileNotFoundError(f"Unknown sample id: {sample_id}")
    if "pei" not in sample.get("real_files", {}):
        raise FileNotFoundError(f"No PEI file registered for sample {sample_id}")

    path = DATA_ROOT / sample["real_files"]["pei"]
    if not path.exists():
        raise FileNotFoundError(f"PEI file missing on disk: {path}")

    records: list[dict] = []
    with open(path, "r", encoding="utf-8") as handle:
        for line in handle:
            parts = line.rstrip("\n").split("\t")
            if len(parts) < _MIN_COLUMNS:
                continue
            try:
                start = int(parts[1])
                end = int(parts[2])
                distance_kb = float(parts[4])
                score = float(parts[5])
            except ValueError:
                # Skip header rows or any line with non-numeric coords.
                continue
            gene_id, p_value = _parse_gene_details(parts[3])
            records.append(
                {
                    "chrom": normalize_chr(parts[0]),
                    "start": start,
                    "end": end,
                    "gene_id": gene_id,
                    "distance_kb": distance_kb,
                    "score": score,
                    "p_value": p_value,
                }
            )
    return records
