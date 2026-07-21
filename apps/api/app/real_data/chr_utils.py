"""Chromosome-name normalization helpers."""


def normalize_chr(chrom: str) -> str:
    """Convert numeric chromosome names to the ``chrN`` convention."""
    value = str(chrom).strip()
    return value if value.startswith("chr") else f"chr{value}"
