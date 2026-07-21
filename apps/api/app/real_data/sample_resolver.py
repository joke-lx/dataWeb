"""Resolve sample IDs to actual file paths and normalize chromosome names."""

from pathlib import Path
from typing import Optional

import yaml

DATA_ROOT = Path(r"D:\qq\猪多组学数据\猪多组学数据")
REGISTRY_PATH = Path(__file__).parent / "registry.yaml"

_cache: Optional[dict] = None


def load_registry() -> dict:
    """Load and cache the canonical real-data registry."""
    global _cache
    if _cache is None:
        with open(REGISTRY_PATH, "r", encoding="utf-8") as file:
            _cache = yaml.safe_load(file)
    return _cache


def get_sample(sample_id: str) -> Optional[dict]:
    """Look up a sample by canonical ID (with underscores)."""
    registry = load_registry()
    for sample in registry.get("samples", []):
        if sample["id"] == sample_id:
            return sample
    return None


def list_samples(tissue: Optional[str] = None, breed: Optional[str] = None) -> list:
    """List all samples, optionally filtered by tissue and breed."""
    registry = load_registry()
    samples = registry.get("samples", [])
    if tissue:
        samples = [sample for sample in samples if sample["tissue"] == tissue]
    if breed:
        samples = [sample for sample in samples if sample["breed"] == breed]
    return samples


def normalize_chr(chrom: str) -> str:
    """Convert ``1`` to ``chr1``; pass ``chr1`` through unchanged."""
    value = str(chrom).strip()
    if value.startswith("chr"):
        return value
    return f"chr{value}"


def resolve_ab_path(sample_id: str) -> Path:
    """Resolve the AB Index file path for a sample."""
    sample = get_sample(sample_id)
    if not sample or "ab" not in sample.get("real_files", {}):
        raise FileNotFoundError(f"No AB file for sample {sample_id}")
    return DATA_ROOT / sample["real_files"]["ab"]
