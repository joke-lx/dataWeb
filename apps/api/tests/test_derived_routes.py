"""Tests for the derived-signal routes (/api/derived/*).

These tests monkeypatch ``app.routes.derived._load_real_matrix`` so they run
deterministically without any real Hi-C data on disk:

* real-path tests inject a synthetic matrix and assert the strategy output
  is serialised with the expected JSON shape + ``source: "real"``;
* fallback tests inject ``(None, False)`` and assert the mock generator is
  used (``source: "mock"``), so the UI never breaks without data.
"""

from __future__ import annotations

from typing import Any

import numpy as np
import pytest
from httpx import ASGITransport, AsyncClient

from app.main import app
from app.routes import derived as derived_routes


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _fake_real_mat() -> np.ndarray:
    """A small Hi-C-like matrix: strong diagonal, one low-insulation block."""
    n = 40
    rng = np.random.default_rng(0)
    mat = rng.uniform(0.5, 2.0, size=(n, n)).astype(np.float32)
    mat = (mat + mat.T) / 2
    dist = np.abs(np.subtract.outer(np.arange(n), np.arange(n))).astype(np.float32)
    mat *= np.exp(-dist * 0.06)
    mat += np.eye(n, dtype=np.float32) * 5
    mat[18:24, 18:24] = np.log1p(0.01)  # low-insulation block ~bin 21
    return np.log1p(mat)


@pytest.fixture
def real_matrix_fixture(monkeypatch: pytest.MonkeyPatch) -> None:
    """Force derived routes to 'see' a real matrix (source=real)."""

    def fake_load(sample: str, chrom: str, start: int, end: int, bin_bp: int) -> tuple[Any, bool]:
        del sample, chrom, start, end, bin_bp
        return _fake_real_mat(), True

    monkeypatch.setattr(derived_routes, "_load_real_matrix", fake_load)


@pytest.fixture
def mock_fallback_fixture(monkeypatch: pytest.MonkeyPatch) -> None:
    """Force derived routes into the mock fallback path."""

    def fake_load(sample: str, chrom: str, start: int, end: int, bin_bp: int) -> tuple[Any, bool]:
        del sample, chrom, start, end, bin_bp
        return None, False

    monkeypatch.setattr(derived_routes, "_load_real_matrix", fake_load)


async def _client() -> AsyncClient:
    transport = ASGITransport(app=app)
    return AsyncClient(transport=transport, base_url="http://test")


# ---------------------------------------------------------------------------
# Real path — source=real + strategy output serialised
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_tad_boundary_real_returns_records(real_matrix_fixture) -> None:
    async with await _client() as client:
        r = await client.get(
            "/api/derived/tad_boundary",
            params={"sample": "Brain_BF3", "chr": "chr1", "start": 0, "end": 800_000, "bin": 20_000},
        )
    assert r.status_code == 200
    payload = r.json()
    assert payload["source"] == "real"
    assert isinstance(payload["records"], list)
    assert len(payload["records"]) >= 1
    record = payload["records"][0]
    assert record["chrom"] == "chr1"
    assert record["start"] >= 0 and record["end"] > record["start"]


@pytest.mark.asyncio
async def test_insulation_real_returns_scores(real_matrix_fixture) -> None:
    async with await _client() as client:
        r = await client.get(
            "/api/derived/insulation",
            params={"sample": "Brain_BF3", "chr": "chr1", "start": 0, "end": 800_000, "bin": 20_000, "n_bins": 40},
        )
    assert r.status_code == 200
    payload = r.json()
    assert payload["source"] == "real"
    assert len(payload["records"]) == 40
    assert all("score" in rec for rec in payload["records"])


@pytest.mark.asyncio
async def test_ab_real_returns_scores(real_matrix_fixture) -> None:
    async with await _client() as client:
        r = await client.get(
            "/api/derived/ab",
            params={"sample": "Brain_BF3", "chr": "chr1", "start": 0, "end": 800_000, "bin": 20_000, "n_bins": 20},
        )
    assert r.status_code == 200
    payload = r.json()
    assert payload["source"] == "real"
    assert len(payload["records"]) == 20


@pytest.mark.asyncio
async def test_differential_real_returns_float32(real_matrix_fixture) -> None:
    async with await _client() as client:
        r = await client.get(
            "/api/derived/differential",
            params={"sample_a": "Brain_BF3", "sample_b": "Liver_BF3", "chr": "chr1", "start": 0, "end": 800_000, "bin": 20_000},
        )
    assert r.status_code == 200
    assert r.headers["X-Genomics-Dtype"] == "float32"
    rows, cols = (int(v) for v in r.headers["X-Genomics-Shape"].split(","))
    assert rows == cols == 40
    assert len(r.content) == rows * cols * 4  # float32


# ---------------------------------------------------------------------------
# Fallback path — source=mock, UI never breaks
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_tad_boundary_mock_fallback(mock_fallback_fixture) -> None:
    async with await _client() as client:
        r = await client.get(
            "/api/derived/tad_boundary",
            params={"sample": "Brain_BF3", "chr": "chr1", "start": 0, "end": 800_000, "bin": 20_000},
        )
    assert r.status_code == 200
    payload = r.json()
    assert payload["source"] == "mock"
    assert isinstance(payload["records"], list)


@pytest.mark.asyncio
async def test_insulation_mock_fallback(mock_fallback_fixture) -> None:
    async with await _client() as client:
        r = await client.get(
            "/api/derived/insulation",
            params={"sample": "Brain_BF3", "chr": "chr1", "start": 0, "end": 800_000, "bin": 20_000},
        )
    assert r.status_code == 200
    assert r.json()["source"] == "mock"


@pytest.mark.asyncio
async def test_ab_mock_fallback(mock_fallback_fixture) -> None:
    async with await _client() as client:
        r = await client.get(
            "/api/derived/ab",
            params={"sample": "Brain_BF3", "chr": "chr1", "start": 0, "end": 800_000, "bin": 20_000},
        )
    assert r.status_code == 200
    assert r.json()["source"] == "mock"


@pytest.mark.asyncio
async def test_differential_mock_fallback(mock_fallback_fixture) -> None:
    async with await _client() as client:
        r = await client.get(
            "/api/derived/differential",
            params={"sample_a": "Brain_BF3", "sample_b": "Liver_BF3", "chr": "chr1", "start": 0, "end": 800_000, "bin": 20_000},
        )
    assert r.status_code == 200
    assert r.headers["X-Genomics-Dtype"] == "float32"
