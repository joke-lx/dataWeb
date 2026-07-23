"""Tests for the CTCF motif and genotype endpoints (Task 5)."""

from __future__ import annotations

import pytest
from httpx import ASGITransport, AsyncClient

from app.main import app


@pytest.mark.asyncio
async def test_ctcf_motif_returns_pwm_dict() -> None:
    """``/api/ctcf/motif`` returns a 4×19 matrix + consensus + anchor_pos."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.get(
            "/api/ctcf/motif",
            params={"sample": "Brain_BF3", "chr": "chr1", "start": 1_000_000, "end": 2_000_000},
        )
    assert response.status_code == 200
    payload = response.json()
    assert "matrix" in payload
    assert "consensus" in payload
    assert "anchor_pos" in payload
    matrix = payload["matrix"]
    assert len(matrix) == 4  # A, C, G, T
    assert len(matrix[0]) == 19  # 19 columns
    consensus = payload["consensus"]
    assert len(consensus) == 19
    assert set(consensus) <= {"A", "C", "G", "T"}
    assert 1_000_100 <= payload["anchor_pos"] <= 1_999_900


@pytest.mark.asyncio
async def test_ctcf_motif_deterministic() -> None:
    """Same request returns the same payload."""
    params = {"sample": "Liver_BF3", "chr": "chr2", "start": 500_000, "end": 1_500_000}
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        first = await client.get("/api/ctcf/motif", params=params)
        second = await client.get("/api/ctcf/motif", params=params)
    assert first.json() == second.json()


@pytest.mark.asyncio
async def test_ctcf_motif_differs_by_sample() -> None:
    """Different samples get different matrices (noise injection)."""
    transport = ASGITransport(app=app)
    params = {"chr": "chr1", "start": 1_000_000, "end": 2_000_000}
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        a = await client.get("/api/ctcf/motif", params={**params, "sample": "Brain_BF3"})
        b = await client.get("/api/ctcf/motif", params={**params, "sample": "Liver_BF3"})
    assert a.json() != b.json()


@pytest.mark.asyncio
async def test_ctcf_genotype_returns_records() -> None:
    """``/api/ctcf/genotype`` returns SNP records with distribution."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.get("/api/ctcf/genotype", params={"population": "global"})
    assert response.status_code == 200
    payload = response.json()
    assert "records" in payload
    records = payload["records"]
    assert len(records) == 3
    for record in records:
        assert "snp_id" in record
        assert "chrom" in record
        assert "pos" in record
        assert "ref_allele" in record
        assert "alt_allele" in record
        assert "distribution" in record
        dist = record["distribution"]
        assert "ref_hom" in dist
        assert "het" in dist
        assert "alt_hom" in dist
        total = dist["ref_hom"] + dist["het"] + dist["alt_hom"]
        assert total == pytest.approx(1.0, abs=0.01)


@pytest.mark.asyncio
async def test_ctcf_genotype_differs_by_population() -> None:
    """Different populations yield different distributions."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        a = await client.get("/api/ctcf/genotype", params={"population": "Tibetan"})
        b = await client.get("/api/ctcf/genotype", params={"population": "Berkshire"})
    assert a.json() != b.json()


@pytest.mark.asyncio
async def test_ctcf_genotype_deterministic() -> None:
    """Same population returns the same distribution."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        first = await client.get("/api/ctcf/genotype", params={"population": "Berkshire"})
        second = await client.get("/api/ctcf/genotype", params={"population": "Berkshire"})
    assert first.json() == second.json()
