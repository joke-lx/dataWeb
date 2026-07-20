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


# ---------------------------------------------------------------------------
# Task J: new mock endpoints (differential, IS, CTCF loops, SV)
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_differential_matrix_is_symmetric_float32() -> None:
    """Differential matrix returns float32 with negative vmin / positive vmax."""
    params = {
        "sample_a": "Brain_BF3",
        "sample_b": "Liver_BF3",
        "chr": "chr1",
        "start": 1_000_000,
        "end": 2_000_000,
        "bin": 100_000,
    }
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.get("/api/differential/matrix", params=params)
    assert response.status_code == 200
    assert response.headers["X-Genomics-Dtype"] == "float32"
    rows, cols = (int(x) for x in response.headers["X-Genomics-Shape"].split(","))
    assert rows == 10
    assert cols == 10
    assert len(response.content) == rows * cols * 4
    arr = np.frombuffer(response.content, dtype=np.float32).reshape((rows, cols))
    assert arr.shape == (10, 10)
    assert np.isfinite(arr).all()
    vmin = float(response.headers["X-Genomics-Vmin"])
    vmax = float(response.headers["X-Genomics-Vmax"])
    assert vmin < 0.0
    assert vmax > 0.0
    # Symmetric clip values
    assert vmin == pytest.approx(-vmax, abs=1e-5)


@pytest.mark.asyncio
async def test_bed_overlap_is_returns_score_in_range() -> None:
    """``kind=is`` returns bedGraph records whose score stays within [-2, 2]."""
    params = {
        "sample": "Brain_BF3",
        "track": "default",
        "chr": "chr1",
        "start": 1_000_000,
        "end": 2_000_000,
        "kind": "is",
    }
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.get("/api/bed/overlap", params=params)
    assert response.status_code == 200
    payload = response.json()
    records = payload["records"]
    assert isinstance(records, list)
    assert len(records) > 0
    for record in records:
        assert record["chrom"] == "chr1"
        assert record["start"] >= 1_000_000
        assert record["end"] <= 2_000_000
        assert record["end"] > record["start"]
        assert -2.0 <= record["score"] <= 2.0


@pytest.mark.asyncio
async def test_ctcf_loops_returns_bedpe_records_ordered_by_start1() -> None:
    """CTCF loop records are bedpe-shaped and sorted by ``start1``."""
    params = {
        "sample": "Brain_BF3",
        "chr": "chr1",
        "start": 1_000_000,
        "end": 2_000_000,
    }
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.get("/api/ctcf/loops", params=params)
    assert response.status_code == 200
    payload = response.json()
    records = payload["records"]
    assert isinstance(records, list)
    assert len(records) > 0
    start1_values = [r["start1"] for r in records]
    assert start1_values == sorted(start1_values)
    for record in records:
        assert record["chrom1"] == "chr1"
        assert record["chrom2"] == "chr1"
        assert record["end1"] > record["start1"]
        assert record["end2"] > record["start2"]
        assert 0.3 <= record["score"] <= 1.0
        # bedpe anchors must respect a minimum 50 kb separation.
        assert abs(record["start2"] - record["start1"]) >= 50_000


@pytest.mark.asyncio
async def test_sv_returns_records_with_known_kinds() -> None:
    """SV records expose a ``kind`` drawn from {DEL, DUP, INV, TRA}."""
    params = {
        "sample": "Brain_BF3",
        "chr": "chr1",
        "start": 1_000_000,
        "end": 2_000_000,
    }
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.get("/api/sv", params=params)
    assert response.status_code == 200
    payload = response.json()
    records = payload["records"]
    assert isinstance(records, list)
    assert len(records) > 0
    valid_kinds = {"DEL", "DUP", "INV", "TRA"}
    for record in records:
        assert record["chrom"] == "chr1"
        assert record["start"] >= 1_000_000
        assert record["end"] <= 2_000_000
        assert record["kind"] in valid_kinds
        assert 0.5 <= record["score"] <= 1.0
    # The generator targets ~10 records.
    assert len(records) == 10


@pytest.mark.asyncio
async def test_new_endpoints_are_deterministic() -> None:
    """Determinism check across all four new endpoints."""
    base_params = {
        "chr": "chr2",
        "start": 500_000,
        "end": 1_500_000,
    }
    transport = ASGITransport(app=app)

    # Differential matrix
    diff_params = {
        **base_params,
        "sample_a": "Brain_BF3",
        "sample_b": "Liver_BF3",
        "bin": 50_000,
    }
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        d1 = await client.get("/api/differential/matrix", params=diff_params)
        d2 = await client.get("/api/differential/matrix", params=diff_params)
    assert d1.content == d2.content

    # IS bedGraph
    is_params = {**base_params, "sample": "Brain_BF3", "track": "default", "kind": "is"}
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        i1 = await client.get("/api/bed/overlap", params=is_params)
        i2 = await client.get("/api/bed/overlap", params=is_params)
    assert i1.json() == i2.json()

    # CTCF loops
    loop_params = {**base_params, "sample": "Brain_BF3"}
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        l1 = await client.get("/api/ctcf/loops", params=loop_params)
        l2 = await client.get("/api/ctcf/loops", params=loop_params)
    assert l1.json() == l2.json()

    # SVs
    sv_params = {**base_params, "sample": "Brain_BF3"}
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        s1 = await client.get("/api/sv", params=sv_params)
        s2 = await client.get("/api/sv", params=sv_params)
    assert s1.json() == s2.json()