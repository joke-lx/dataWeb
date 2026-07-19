"""End-to-end tests for the mock data routes (Task B)."""

from __future__ import annotations

import numpy as np
import pytest
from httpx import ASGITransport, AsyncClient

from app.main import app


@pytest.mark.asyncio
async def test_species_endpoint_returns_pig_assembly() -> None:
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.get("/api/species")
    assert response.status_code == 200
    payload = response.json()
    assert isinstance(payload, list)
    assert len(payload) == 1
    pig = payload[0]
    assert pig["id"] == "pig"
    assert pig["assembly"] == "susScr11"
    assert isinstance(pig["chromosomes"], list)
    assert pig["chromosomes"][0]["name"] == "chr1"


@pytest.mark.asyncio
async def test_samples_endpoint_returns_six_pig_samples() -> None:
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.get("/api/species/pig/samples")
    assert response.status_code == 200
    payload = response.json()
    assert isinstance(payload, list)
    assert len(payload) == 6
    ids = {s["id"] for s in payload}
    assert {"Brain_BF3", "Liver_BF3", "Muscle_TM3"}.issubset(ids)
    # All returned samples belong to the requested species.
    assert {s["species"] for s in payload} == {"pig"}


@pytest.mark.asyncio
async def test_hic_matrix_returns_float32_binary_with_headers() -> None:
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.get(
            "/api/hic/matrix",
            params={
                "sample": "Brain_BF3",
                "chr": "chr1",
                "start": 1_000_000,
                "end": 2_000_000,
                "bin": 100_000,
            },
        )
    assert response.status_code == 200
    assert response.headers["X-Genomics-Dtype"] == "float32"
    shape_header = response.headers["X-Genomics-Shape"]
    rows, cols = (int(x) for x in shape_header.split(","))
    # 1Mb region at 100kb bin -> 10x10 grid
    assert rows == 10
    assert cols == 10
    # Verify body decodes to a 10x10 float32 matrix.
    body = response.content
    assert len(body) == rows * cols * 4  # 4 bytes per float32
    arr = np.frombuffer(body, dtype=np.float32).reshape((rows, cols))
    assert arr.shape == (10, 10)
    assert np.isfinite(arr).all()
    # log1p output is non-negative and should have some non-zero entries.
    assert arr.min() >= 0.0
    assert arr.max() > 0.0
    # vmin/vmax headers are parseable floats.
    assert float(response.headers["X-Genomics-Vmin"]) == float(arr.min())
    assert float(response.headers["X-Genomics-Vmax"]) <= float(arr.max())


@pytest.mark.asyncio
async def test_hic_matrix_large_region_uses_vectorised_band() -> None:
    """A region wide enough to push n past the 400-bin threshold."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.get(
            "/api/hic/matrix",
            params={
                "sample": "Liver_BF3",
                "chr": "chr2",
                "start": 0,
                "end": 50_000_000,
                "bin": 100_000,
            },
        )
    assert response.status_code == 200
    rows, cols = (int(x) for x in response.headers["X-Genomics-Shape"].split(","))
    assert rows == cols == 500
    arr = np.frombuffer(response.content, dtype=np.float32).reshape((rows, cols))
    # Diagonal warm band should make the main diagonal the brightest row.
    diag = np.diag(arr)
    off_diag = arr.copy()
    np.fill_diagonal(off_diag, 0.0)
    assert diag.mean() > off_diag.mean()


@pytest.mark.asyncio
async def test_bigwig_returns_one_dim_float32() -> None:
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.get(
            "/api/bigwig/values",
            params={
                "sample": "Brain_BF3",
                "track": "rna_seq",
                "chr": "chr1",
                "start": 1_000_000,
                "end": 2_000_000,
                "bins": 500,
            },
        )
    assert response.status_code == 200
    assert response.headers["X-Genomics-Dtype"] == "float32"
    shape_header = response.headers["X-Genomics-Shape"]
    assert "," not in shape_header
    n = int(shape_header)
    assert n == 500
    arr = np.frombuffer(response.content, dtype=np.float32)
    assert arr.shape == (500,)
    assert np.isfinite(arr).all()
    # Generator applies np.maximum(..., 0) so all values are non-negative.
    assert arr.min() >= 0.0
    # The sin/cos base plus peaks should produce a varied signal.
    assert arr.max() > arr.min()


@pytest.mark.asyncio
@pytest.mark.parametrize("kind", ["ab", "tad", "pei", "gene"])
async def test_bed_overlap_returns_records_for_each_kind(kind: str) -> None:
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.get(
            "/api/bed/overlap",
            params={
                "sample": "Brain_BF3",
                "track": "default",
                "chr": "chr1",
                "start": 1_000_000,
                "end": 2_000_000,
                "kind": kind,
            },
        )
    assert response.status_code == 200
    payload = response.json()
    assert "records" in payload
    records = payload["records"]
    assert isinstance(records, list)
    assert len(records) > 0
    first = records[0]
    assert first["chrom"] == "chr1"
    assert first["start"] >= 1_000_000
    assert first["end"] <= 2_000_000
    assert first["end"] > first["start"]


@pytest.mark.asyncio
async def test_bed_overlap_rejects_unknown_kind() -> None:
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.get(
            "/api/bed/overlap",
            params={
                "sample": "Brain_BF3",
                "track": "default",
                "chr": "chr1",
                "start": 1_000_000,
                "end": 2_000_000,
                "kind": "nonsense",
            },
        )
    assert response.status_code == 400


@pytest.mark.asyncio
async def test_mock_endpoints_are_deterministic() -> None:
    """Two consecutive requests with the same parameters return identical bytes."""
    params = {
        "sample": "Muscle_BM4",
        "chr": "chr3",
        "start": 500_000,
        "end": 1_500_000,
        "bin": 50_000,
    }
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        first = await client.get("/api/hic/matrix", params=params)
        second = await client.get("/api/hic/matrix", params=params)
    assert first.content == second.content