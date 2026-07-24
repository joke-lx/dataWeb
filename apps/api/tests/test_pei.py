"""End-to-end tests for the PEI (Promoter-Enhancer Interaction) data route.

Phase J-5: PEI is wired to the real 8-column tab-separated files under
``03.PEI/``. 24 of 36 samples have a registered PEI file; the rest fall
back to the deterministic mock generator.
"""

from __future__ import annotations

import pytest
from httpx import ASGITransport, AsyncClient

from app.main import app


def _query(sample: str, kind: str, chrom: str, start: int, end: int):
    transport = ASGITransport(app=app)

    async def _do() -> dict:
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            response = await client.get(
                "/api/bed/overlap",
                params={
                    "sample": sample,
                    "track": "default",
                    "chr": chrom,
                    "start": start,
                    "end": end,
                    "kind": kind,
                },
            )
        assert response.status_code == 200, response.text
        return response.json()

    return _do()


@pytest.mark.asyncio
async def test_pei_real_data_returns_gene_anchored_records() -> None:
    """Brain_BF3 has a real PEI file; records expose gene_id, distance, score."""
    payload = await _query("Brain_BF3", "pei", "chr1", 1_000_000, 2_000_000)
    records = payload["records"]
    assert isinstance(records, list)
    assert len(records) > 0
    first = records[0]
    assert set(first.keys()) >= {
        "chrom",
        "start",
        "end",
        "gene_id",
        "distance_kb",
        "score",
    }
    # Real PEI rows have an Ensembl gene id.
    assert first["gene_id"].startswith("ENSSSCG")
    # distance_kb is parsed from column 5 and is a positive float.
    assert isinstance(first["distance_kb"], (int, float))
    assert first["distance_kb"] > 0
    # score is the -log10(p) value from column 6.
    assert isinstance(first["score"], (int, float))
    assert first["score"] > 0
    # Each record lies inside the queried window.
    assert first["chrom"] == "chr1"
    assert first["start"] >= 1_000_000
    assert first["end"] <= 2_000_000
    assert first["end"] > first["start"]


@pytest.mark.asyncio
async def test_pei_chr_prefix_is_preserved() -> None:
    """Real PEI rows already have a ``chr`` prefix; the reader must not double it."""
    payload = await _query("Brain_BF3", "pei", "chr1", 1_000_000, 2_000_000)
    records = payload["records"]
    assert records, "Expected PEI records on chr1 for Brain_BF3"
    for record in records:
        assert record["chrom"].startswith("chr")
        # Avoid a duplicated 'chrchr' prefix.
        assert not record["chrom"].startswith("chrchr")
    # All returned records are on chr1 (the queried chrom).
    assert {record["chrom"] for record in records} == {"chr1"}


@pytest.mark.requires_real_data
@pytest.mark.asyncio
async def test_pei_filter_returns_only_overlapping_records() -> None:
    """Narrowing the region yields a subset of the wider query."""
    wide = await _query("Brain_BF3", "pei", "chr1", 1_000_000, 5_000_000)
    narrow = await _query("Brain_BF3", "pei", "chr1", 1_000_000, 2_000_000)
    assert wide["records"]
    assert narrow["records"]
    wide_count = len(wide["records"])
    narrow_count = len(narrow["records"])
    # Narrowing can only remove records.
    assert narrow_count <= wide_count
    # Every narrow record also appears in the wide result (matched by tuple).
    wide_index = {(r["chrom"], r["start"], r["end"], r["gene_id"]) for r in wide["records"]}
    for record in narrow["records"]:
        key = (record["chrom"], record["start"], record["end"], record["gene_id"])
        assert key in wide_index
        assert record["start"] < 2_000_000
        assert record["end"] > 1_000_000


@pytest.mark.asyncio
async def test_pei_falls_back_to_mock_when_file_missing() -> None:
    """Liver_BF5 has no PEI file registered; the endpoint must fall back to mock."""
    payload = await _query("Liver_BF5", "pei", "chr1", 1_000_000, 2_000_000)
    records = payload["records"]
    assert isinstance(records, list)
    assert len(records) > 0
    first = records[0]
    # Mock PEI records use the same schema, so this should still validate.
    assert first["chrom"] == "chr1"
    assert first["start"] >= 1_000_000
    assert first["end"] <= 2_000_000
    assert first["end"] > first["start"]
    assert first["gene_id"].startswith("ENSSSCG")
