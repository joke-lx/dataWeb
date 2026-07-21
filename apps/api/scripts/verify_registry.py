"""Verify all paths in registry.yaml actually exist on disk."""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from app.real_data.sample_resolver import DATA_ROOT, load_registry


registry = load_registry()
total = 0
missing = 0
for sample in registry["samples"]:
    for kind, rel_path in sample.get("real_files", {}).items():
        full = DATA_ROOT / rel_path
        total += 1
        if not full.exists():
            print(f"MISSING: {sample['id']} / {kind} = {rel_path}")
            missing += 1

# Check mean-track directories too.
mean_root = DATA_ROOT / "01.AB_compartment"
for subdirectory in ["Breed_mean", "Parental_mean", "Tissue_mean"]:
    directory = mean_root / subdirectory
    if not directory.exists():
        print(f"MEAN DIR MISSING: {directory}")
        missing += 1
    else:
        print(f"OK mean dir: {subdirectory}")

print(f"\nTotal: {total} files, {missing} missing")
