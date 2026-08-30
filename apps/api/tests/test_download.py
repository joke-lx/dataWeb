"""Tests for the download endpoint (files list + byte-range streaming).

Covers the contract the frontend chunked downloader depends on: 206 with
correct Content-Range/Content-Length, determinism, cross-block slices,
416 for unsatisfiable ranges, 404 for unknown sample/file, and HEAD.
"""

import hashlib

import pytest
from httpx import ASGITransport, AsyncClient

from app.main import app

BASE = "http://test"


async def _client():
    transport = ASGITransport(app=app)
    return AsyncClient(transport=transport, base_url=BASE)


@pytest.mark.asyncio
async def test_files_list_shape() -> None:
    async with await _client() as client:
        r = await client.get("/api/download/files", params={"sample": "Brain_BF3"})
    assert r.status_code == 200
    files = r.json()
    assert len(files) == 9
    assert {"file", "format", "size_bytes", "description"} <= set(files[0].keys())
    hic = next(f for f in files if f["file"] == "hic_matrix.bin")
    assert hic["size_bytes"] > 3_000_000_000  # ~3 GiB, exercises chunked path


@pytest.mark.asyncio
async def test_unknown_sample_404() -> None:
    async with await _client() as client:
        r = await client.get("/api/download/files", params={"sample": "Nope"})
    assert r.status_code == 404


@pytest.mark.asyncio
async def test_full_get_headers() -> None:
    async with await _client() as client:
        r = await client.get(
            "/api/download/file",
            params={"sample": "Brain_BF3", "file": "ab.bedgraph"},
        )
    assert r.status_code == 200
    assert r.headers["accept-ranges"] == "bytes"
    assert r.headers["content-length"] == str(len(r.content))
    assert "attachment" in r.headers["content-disposition"]


@pytest.mark.asyncio
async def test_range_206() -> None:
    async with await _client() as client:
        r = await client.get(
            "/api/download/file",
            params={"sample": "Brain_BF3", "file": "ab.bedgraph"},
            headers={"Range": "bytes=0-99"},
        )
    assert r.status_code == 206
    assert len(r.content) == 100
    assert r.headers["content-range"].startswith("bytes 0-99/")
    assert r.headers["content-length"] == "100"


@pytest.mark.asyncio
async def test_range_deterministic() -> None:
    params = {"sample": "Brain_BF3", "file": "ab.bedgraph"}
    async with await _client() as client:
        a = await client.get(
            "/api/download/file", params=params, headers={"Range": "bytes=500-599"}
        )
        b = await client.get(
            "/api/download/file", params=params, headers={"Range": "bytes=500-599"}
        )
    assert a.content == b.content
    assert hashlib.sha256(a.content).hexdigest() == hashlib.sha256(b.content).hexdigest()


@pytest.mark.asyncio
async def test_range_is_prefix_of_small_file() -> None:
    params = {"sample": "Brain_BF3", "file": "sv.vcf"}
    async with await _client() as client:
        full = await client.get("/api/download/file", params=params)
        head = await client.get(
            "/api/download/file", params=params, headers={"Range": "bytes=0-199"}
        )
    assert head.status_code == 206
    assert full.content[:200] == head.content


@pytest.mark.asyncio
async def test_range_spans_block_boundary() -> None:
    # 4090..4100 crosses the 4096-byte synthetic block boundary.
    params = {"sample": "Brain_BF3", "file": "ab.bedgraph"}
    async with await _client() as client:
        r = await client.get(
            "/api/download/file", params=params, headers={"Range": "bytes=4090-4100"}
        )
    assert r.status_code == 206
    assert len(r.content) == 11


@pytest.mark.asyncio
async def test_unsatisfiable_range_416() -> None:
    async with await _client() as client:
        r = await client.get(
            "/api/download/file",
            params={"sample": "Brain_BF3", "file": "sv.vcf"},
            headers={"Range": "bytes=99999999999-"},
        )
    assert r.status_code == 416
    assert r.headers["content-range"].startswith("bytes */")


@pytest.mark.asyncio
async def test_unknown_file_404() -> None:
    async with await _client() as client:
        r = await client.get(
            "/api/download/file",
            params={"sample": "Brain_BF3", "file": "nope.bin"},
        )
    assert r.status_code == 404


@pytest.mark.asyncio
async def test_head_returns_full_length() -> None:
    params = {"sample": "Brain_BF3", "file": "rna_seq.bw"}
    async with await _client() as client:
        head = await client.head("/api/download/file", params=params)
        size = await client.get(
            "/api/download/files", params={"sample": "Brain_BF3"}
        )
    assert head.status_code == 200
    listed = next(f for f in size.json() if f["file"] == "rna_seq.bw")
    assert head.headers["content-length"] == str(listed["size_bytes"])
