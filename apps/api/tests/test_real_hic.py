"""Tests for the real Hi-C matrix reader (mmap submatrix extraction).

Requires the converted cache ``{hic_matrix_root}/npy/Brain_BF3.chr1.20kb.npy``
(produced by ``scripts/convert_hic_matrix.py``) — skipped otherwise via the
``requires_real_data`` marker.
"""

from __future__ import annotations

import struct

import pytest
from httpx import ASGITransport, AsyncClient

from app.main import app
from app.real_data.hic_reader import BIN_SIZE, read_hic_matrix

SAMPLE = "Brain_BF3"
CHROM = "chr1"


def _need_cache() -> None:
    try:
        read_hic_matrix(SAMPLE, CHROM, 0, BIN_SIZE, BIN_SIZE)
    except FileNotFoundError:
        pytest.skip("chr1 npy cache not converted yet")


@pytest.mark.requires_real_data
def test_reader_submatrix_shape_and_scale() -> None:
    """A 1 Mb window at 20 kb bins yields a 50×50 log1p matrix."""
    _need_cache()
    mat, vmin, vmax = read_hic_matrix(SAMPLE, CHROM, 1_000_000, 2_000_000, BIN_SIZE)
    assert mat.shape == (50, 50)
    assert mat.dtype.name == "float32"
    # log1p 值非负;vmin/vmax 契约:min 与 p99。
    assert vmin <= vmax
    assert float(mat.min()) >= 0.0


@pytest.mark.requires_real_data
def test_reader_bin_pooling() -> None:
    """bin=100 kb pools five 20 kb blocks (1 Mb → 10×10)."""
    _need_cache()
    mat, _, _ = read_hic_matrix(SAMPLE, CHROM, 1_000_000, 2_000_000, 100_000)
    assert mat.shape == (10, 10)


@pytest.mark.requires_real_data
def test_reader_bin_below_resolution_clamps() -> None:
    """bin < 20 kb clamps to 20 kb (5 kb request behaves like 20 kb)."""
    _need_cache()
    mat, _, _ = read_hic_matrix(SAMPLE, CHROM, 1_000_000, 2_000_000, 5_000)
    assert mat.shape == (50, 50)


@pytest.mark.requires_real_data
def test_reader_out_of_coverage_returns_empty() -> None:
    """Beyond the file's coverage the reader returns 0×0 (no mock values)."""
    _need_cache()
    mat, vmin, vmax = read_hic_matrix(SAMPLE, CHROM, 300_000_000, 301_000_000, BIN_SIZE)
    assert mat.shape == (0, 0)
    assert vmin == 0.0 and vmax == 1.0


@pytest.mark.requires_real_data
@pytest.mark.asyncio
async def test_hic_endpoint_real_data() -> None:
    """The endpoint serves float32 bytes with the X-Genomics-* contract."""
    _need_cache()
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.get(
            "/api/hic/matrix",
            params={
                "sample": SAMPLE,
                "chr": CHROM,
                "start": 1_000_000,
                "end": 2_000_000,
                "bin": 20_000,
            },
        )
    assert response.status_code == 200
    rows, cols = (int(v) for v in response.headers["X-Genomics-Shape"].split(","))
    assert rows == 50 and cols == 50
    assert response.headers["X-Genomics-Dtype"] == "float32"
    assert len(response.content) == rows * cols * struct.calcsize("<f")
    # 真实 chr1 对角线信号应该明显高于 0(log1p 后)。
    values = struct.unpack(f"<{rows * cols}f", response.content)
    assert max(values) > 1.0
