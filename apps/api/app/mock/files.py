"""Deterministic synthetic file catalog for the download endpoint.

Every sample exposes a fixed set of "downloadable files" whose sizes and
contents are derived from ``sha256(sample|file)`` — no disk, fully
deterministic, so the same Range request always yields the same bytes.

Sizes are chosen to exercise both download paths on the frontend:

* ``hic_matrix.bin`` (~3 GiB) — the chunked path (> 100 MB)
* ``*.bw`` (~90–150 MB) — also chunked
* small text tracks (bedgraph / bed / vcf) — direct path

Content is generated in 4096-byte blocks: block ``i`` is
``sha256(f"{sample}|{file}|{i}").digest()`` (32 bytes) repeated 128×.
A range is assembled by slicing the overlapping blocks, so any sub-range is
``O(blocks_touched)`` — never materialise the whole file.
"""

from __future__ import annotations

import hashlib
from collections.abc import Iterator

from .samples import find_sample

# 4096-byte block = 32-byte digest × 128 repeats.
_BLOCK_SIZE = 4096
_DIGEST_BYTES = 32
_DIGESTS_PER_BLOCK = _BLOCK_SIZE // _DIGEST_BYTES  # 128

# Target sizes (bytes). The .bin is ~3 GiB so the frontend chunked downloader
# has a realistic workload; small tracks stay on the direct path.
_BASE_SIZES: dict[str, int] = {
    "hic_matrix.bin": 3_221_225_472,  # ~3.0 GiB
    "rna_seq.bw": 148_000_000,
    "h3k4me3.bw": 96_000_000,
    "h3k27ac.bw": 91_000_000,
    "ab.bedgraph": 18_400_000,
    "is.bedgraph": 18_100_000,
    "tad.bed": 4_200_000,
    "pei.bed": 3_600_000,
    "sv.vcf": 1_800_000,
}

_FORMATS: dict[str, str] = {
    "hic_matrix.bin": "hic",
    "rna_seq.bw": "bigwig",
    "h3k4me3.bw": "bigwig",
    "h3k27ac.bw": "bigwig",
    "ab.bedgraph": "bedgraph",
    "is.bedgraph": "bedgraph",
    "tad.bed": "bed",
    "pei.bed": "bed",
    "sv.vcf": "vcf",
}

_DESCRIPTIONS: dict[str, str] = {
    "hic_matrix.bin": "Raw Hi-C contact matrix (float32, row-major)",
    "rna_seq.bw": "RNA-seq coverage bigWig",
    "h3k4me3.bw": "H3K4me3 ChIP-seq bigWig",
    "h3k27ac.bw": "H3K27ac ChIP-seq bigWig",
    "ab.bedgraph": "A/B compartment index bedGraph",
    "is.bedgraph": "Insulation score bedGraph",
    "tad.bed": "Topologically associating domains (BED)",
    "pei.bed": "Promoter–enhancer interactions (BED)",
    "sv.vcf": "Structural variants (VCF)",
}


def _seeded_size(sample_id: str, filename: str) -> int:
    """Derive a deterministic size from a sha256 of ``sample|file``.

    The size jitters ±15% around the base so different samples differ, while
    staying deterministic for the same ``(sample, file)`` pair.
    """
    base = _BASE_SIZES[filename]
    digest = hashlib.sha256(f"{sample_id}|{filename}".encode("utf-8")).hexdigest()
    jitter = int(digest[:4], 16) / 0xFFFF  # 0..1
    factor = 0.85 + 0.30 * jitter  # 0.85..1.15
    return int(base * factor)


def sample_files(sample_id: str) -> list[dict]:
    """Return the file catalog for ``sample_id``.

    Unknown sample → ``[]`` (the route turns that into 404).
    """
    if find_sample(sample_id) is None:
        return []
    return [
        {
            "file": name,
            "format": _FORMATS[name],
            "size_bytes": _seeded_size(sample_id, name),
            "description": _DESCRIPTIONS[name],
        }
        for name in _BASE_SIZES
    ]


def file_size(sample_id: str, filename: str) -> int | None:
    """Size of ``filename`` for ``sample_id``; ``None`` when unknown."""
    if find_sample(sample_id) is None or filename not in _BASE_SIZES:
        return None
    return _seeded_size(sample_id, filename)


def _block_bytes(sample_id: str, filename: str, block_index: int) -> bytes:
    """32-byte digest repeated to fill one 4096-byte block."""
    digest = hashlib.sha256(f"{sample_id}|{filename}|{block_index}".encode("utf-8")).digest()
    return digest * _DIGESTS_PER_BLOCK


def iter_file_bytes(
    sample_id: str,
    filename: str,
    offset: int,
    length: int,
) -> Iterator[bytes]:
    """Yield ``length`` bytes of ``filename`` starting at ``offset``.

    Lazily slices the overlapping 4096-byte blocks; never materialises more
    than one block in memory at a time.
    """
    if length <= 0:
        return
    end = offset + length
    first_block = offset // _BLOCK_SIZE
    last_block = (end - 1) // _BLOCK_SIZE
    for block_index in range(first_block, last_block + 1):
        block = _block_bytes(sample_id, filename, block_index)
        block_start = block_index * _BLOCK_SIZE
        # 切片到本块与请求区间的交集。
        lo = max(offset, block_start) - block_start
        hi = min(end, block_start + _BLOCK_SIZE) - block_start
        yield block[lo:hi]
