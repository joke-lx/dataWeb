"""Mock sample registry.

Defines a representative subset of the 28 pig samples documented in
``docx/plan/visualizable_features.md``. Each entry exposes the metadata the
frontend needs to render the sample list. The chromosome list mirrors the
Sus scrofa 11.1 assembly.
"""

from __future__ import annotations

# ---------------------------------------------------------------------------
# Chromosomes — Sus scrofa 11.1
# ---------------------------------------------------------------------------

CHROMOSOMES: list[dict] = [
    {"name": "chr1", "length": 274330532},
    {"name": "chr2", "length": 241935688},
    {"name": "chr3", "length": 232174574},
    {"name": "chr4", "length": 219987491},
    {"name": "chr5", "length": 210709260},
    {"name": "chr6", "length": 203550307},
    {"name": "chr7", "length": 198749988},
    {"name": "chr8", "length": 187382144},
    {"name": "chr9", "length": 175437498},
    {"name": "chr10", "length": 169851988},
    {"name": "chr11", "length": 158828723},
    {"name": "chr12", "length": 154215833},
    {"name": "chr13", "length": 144508318},
    {"name": "chr14", "length": 141536284},
    {"name": "chr15", "length": 138862489},
    {"name": "chr16", "length": 133534560},
    {"name": "chr17", "length": 132555086},
    {"name": "chr18", "length": 131902733},
    {"name": "chrX", "length": 158294765},
]

SPECIES: list[dict] = [
    {"id": "pig", "assembly": "susScr11", "chromosomes": CHROMOSOMES},
]


# ---------------------------------------------------------------------------
# Samples — 6 representative entries (subset of 28)
# ---------------------------------------------------------------------------

SAMPLES: list[dict] = [
    {
        "id": "Brain_BF3",
        "species": "pig",
        "tissue": "Brain",
        "breed": "Berkshire",
        "sex": "F",
        "individual": 3,
        "dev_stage": "adult",
    },
    {
        "id": "Brain_TM4",
        "species": "pig",
        "tissue": "Brain",
        "breed": "Tibetan",
        "sex": "M",
        "individual": 4,
        "dev_stage": "adult",
    },
    {
        "id": "Liver_BF3",
        "species": "pig",
        "tissue": "Liver",
        "breed": "Berkshire",
        "sex": "F",
        "individual": 3,
        "dev_stage": "adult",
    },
    {
        "id": "Liver_TF2_28d",
        "species": "pig",
        "tissue": "Liver",
        "breed": "Tibetan",
        "sex": "F",
        "individual": 2,
        "dev_stage": "28d",
    },
    {
        "id": "Muscle_BM4",
        "species": "pig",
        "tissue": "Muscle",
        "breed": "Berkshire",
        "sex": "M",
        "individual": 4,
        "dev_stage": "adult",
    },
    {
        "id": "Muscle_TM3",
        "species": "pig",
        "tissue": "Muscle",
        "breed": "Tibetan",
        "sex": "M",
        "individual": 3,
        "dev_stage": "adult",
    },
]


def find_sample(sample_id: str) -> dict | None:
    """Look up a sample by id; returns ``None`` when absent."""
    for sample in SAMPLES:
        if sample["id"] == sample_id:
            return sample
    return None