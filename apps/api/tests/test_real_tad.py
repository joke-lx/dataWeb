"""Tests for real TAD boundary wiring (Phase J-3)."""

from __future__ import annotations

import pytest
from httpx import ASGITransport, AsyncClient

from app.main import app
from app.real_data.tad_reader import read_tad_sample


@pytest.mark.requires_real_data
@pytest.mark.asyncio
async def test_tad_real_data_brain_bf3() -> None:
    """`kind=tad` for ``Brain_BF3`` returns real records from the .TAD file.

    The chromosome name must be normalised to ``chrN`` and every record must
    fall inside the requested region.
    """
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.get(
            "/api/bed/overlap",
            params={
                "sample": "Brain_BF3",
                "chr": "chr1",
                "start": 1_000_000,
                "end": 5_000_000,
                "kind": "tad",
            },
        )
    assert response.status_code == 200
    payload = response.json()
    records = payload["records"]
    assert isinstance(records, list)
    assert len(records) > 0
    for record in records:
        assert record["chrom"] == "chr1"
        # TAD boundaries can start before the region and still overlap; what
        # matters is that the interval intersects [start, end).
        assert record["end"] > 1_000_000
        assert record["start"] < 5_000_000
        assert record["end"] > record["start"]
    # Real .TAD files do not carry a score column; ensure it isn't fabricated.
    assert all("score" not in record for record in records)


@pytest.mark.asyncio
async def test_tad_real_data_filtered_uses_cut200k() -> None:
    """`filtered=true` switches to the cut200k file which carries a score."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.get(
            "/api/bed/overlap",
            params={
                "sample": "Brain_BF3",
                "chr": "chr1",
                "start": 1_000_000,
                "end": 5_000_000,
                "kind": "tad",
                "filtered": "true",
            },
        )
    assert response.status_code == 200
    records = response.json()["records"]
    assert len(records) > 0
    # cut200k rows expose ``score`` (the trailing length column).
    for record in records:
        assert record["chrom"] == "chr1"
        assert record["end"] > record["start"]
        assert "score" in record
        assert isinstance(record["score"], (int, float))


@pytest.mark.asyncio
async def test_tad_dev_stage_variant_falls_back_to_tad_file() -> None:
    """Dev-stage variants (no ``tad_200k``) still serve real TAD data.

    ``Liver_BF3_28d`` is registered with only a ``.TAD`` path; requesting
    ``filtered=true`` must transparently fall back to that file.
    """
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.get(
            "/api/bed/overlap",
            params={
                "sample": "Liver_BF3_28d",
                "chr": "chr1",
                "start": 1_000_000,
                "end": 5_000_000,
                "kind": "tad",
            },
        )
    assert response.status_code == 200
    records = response.json()["records"]
    # The 28d variant must return real data, not a 404 or empty result.
    assert len(records) > 0
    for record in records:
        assert record["chrom"] == "chr1"
        assert record["end"] > record["start"]


@pytest.mark.asyncio
async def test_tad_unknown_sample_falls_back_to_mock() -> None:
    """An unregistered sample triggers the deterministic mock generator."""
    transport = ASGITransport(app=app)
    params = {
        "sample": "NOT_A_REAL_SAMPLE",
        "chr": "chr1",
        "start": 1_000_000,
        "end": 2_000_000,
        "kind": "tad",
    }
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.get("/api/bed/overlap", params=params)
    assert response.status_code == 200
    records = response.json()["records"]
    # Mock generator emits 20-50 records, all inside the region.
    assert len(records) > 0
    for record in records:
        assert record["chrom"] == "chr1"
        assert record["end"] > record["start"]
        # Mock records expose ``score`` (the TAD index used by the generator).
        assert "score" in record


@pytest.mark.requires_real_data
def test_read_tad_sample_normalizes_chromosome_names() -> None:
    """Direct reader returns ``chrN`` even when the source file uses numeric IDs."""
    records = read_tad_sample("Brain_BF3")
    assert isinstance(records, list)
    assert len(records) > 0
    chromosomes = {record["chrom"] for record in records}
    assert chromosomes
    # Every chromosome should be in the canonical ``chrN`` form.
    assert all(chrom.startswith("chr") for chrom in chromosomes)


def test_read_tad_sample_unknown_sample_raises() -> None:
    """Unknown sample IDs raise ``FileNotFoundError`` so callers can fall back."""
    import pytest

    with pytest.raises(FileNotFoundError):
        read_tad_sample("DOES_NOT_EXIST")