"""Read registered binary BigWig and text-bedGraph signal tracks."""

from __future__ import annotations

import logging
from pathlib import Path
from typing import Literal, Optional, TypedDict

import numpy as np
from numpy.typing import NDArray

from .sample_resolver import DATA_ROOT, get_sample, normalize_chr

BW_MAGIC = b"\x26\xfc\x8f\x88"
logger = logging.getLogger(__name__)

TrackFormat = Literal["bigwig", "text_bedgraph"]
Float32Array = NDArray[np.float32]


class TrackResult(TypedDict):
    """Binned values and their display range."""

    values: Float32Array
    vmin: float
    vmax: float
    format: TrackFormat


def sniff_format(path: Path) -> TrackFormat:
    """Detect a binary BigWig or a text file mislabeled with ``.bw``."""
    with path.open("rb") as handle:
        magic = handle.read(4)
    if magic == BW_MAGIC:
        return "bigwig"
    if magic[:1].isdigit():
        return "text_bedgraph"
    raise ValueError(f"Unknown file format for {path}: magic={magic!r}")


def read_bigwig_track(
    sample_id: str,
    track: str,
    chrom: str,
    start: int,
    end: int,
    n_bins: int,
) -> TrackResult:
    """Read and bin one registry-backed signal track."""
    sample = get_sample(sample_id)
    if sample is None:
        raise FileNotFoundError(f"Sample {sample_id} not in registry")

    relative_path = sample.get("real_files", {}).get(track)
    if relative_path is None:
        raise FileNotFoundError(f"Track {track} not available for {sample_id}")

    path = DATA_ROOT / relative_path
    if not path.is_file():
        raise FileNotFoundError(f"File missing: {path}")

    target_chr = normalize_chr(chrom)
    track_format = sniff_format(path)
    if track_format == "bigwig":
        return _read_binary_bigwig(path, target_chr, start, end, n_bins)
    return _read_text_bedgraph(path, target_chr, start, end, n_bins)


def _resolve_chrom_key(available: object, chrom: str) -> Optional[str]:
    """Match a query chromosome to a name actually present in a file."""
    if available is None:
        return None
    keys = available.keys() if isinstance(available, dict) else list(available)
    if chrom in keys:
        return chrom
    stripped = chrom[3:] if chrom.startswith("chr") else f"chr{chrom}"
    if stripped in keys:
        return stripped
    return None


def _read_binary_bigwig(
    path: Path,
    target_chr: str,
    start: int,
    end: int,
    n_bins: int,
) -> TrackResult:
    """Summarize a binary BigWig directly into the requested output bins."""
    try:
        import pyBigWig
    except ImportError as error:
        raise RuntimeError("pyBigWig is required to read binary BigWig tracks") from error

    bigwig = pyBigWig.open(str(path))
    if bigwig is None:
        raise OSError(f"Unable to open BigWig file: {path}")
    try:
        chrom_key = _resolve_chrom_key(bigwig.chroms(), target_chr)
        if chrom_key is None or start >= bigwig.chroms()[chrom_key]:
            values = np.zeros(n_bins, dtype=np.float32)
        else:
            raw = bigwig.stats(
                chrom_key,
                start,
                end,
                type="mean",
                nBins=n_bins,
                exact=True,
            )
            values = np.nan_to_num(
                np.asarray([0.0 if value is None else value for value in raw]),
                nan=0.0,
                posinf=0.0,
                neginf=0.0,
            ).astype(np.float32)
    finally:
        bigwig.close()
    return _track_result(values, "bigwig")


def _read_text_bedgraph(
    path: Path,
    target_chr: str,
    start: int,
    end: int,
    n_bins: int,
) -> TrackResult:
    """Average text-bedGraph scores by base-pair overlap in uniform bins."""
    weighted_scores = np.zeros(n_bins, dtype=np.float64)
    covered_bases = np.zeros(n_bins, dtype=np.float64)
    region_width = end - start
    seen_chrom = False

    with path.open("r", encoding="utf-8") as handle:
        for line in handle:
            parts = line.rstrip().split("\t")
            if len(parts) < 4:
                continue
            rec_chr = normalize_chr(parts[0])
            if rec_chr != target_chr:
                continue
            seen_chrom = True
            try:
                record_start = int(parts[1])
                record_end = int(parts[2])
                score = float(parts[3])
            except ValueError:
                continue
            overlap_start = max(start, record_start)
            overlap_end = min(end, record_end)
            if overlap_start >= overlap_end:
                continue

            first_bin = min(n_bins - 1, (overlap_start - start) * n_bins // region_width)
            last_bin = min(n_bins - 1, (overlap_end - 1 - start) * n_bins // region_width)
            for bin_index in range(first_bin, last_bin + 1):
                bin_start = start + bin_index * region_width / n_bins
                bin_end = start + (bin_index + 1) * region_width / n_bins
                overlap = min(overlap_end, bin_end) - max(overlap_start, bin_start)
                if overlap > 0:
                    weighted_scores[bin_index] += score * overlap
                    covered_bases[bin_index] += overlap

    if not seen_chrom:
        logger.warning("Chromosome %s not found in %s", target_chr, path)

    values = np.nan_to_num(
        np.divide(
            weighted_scores,
            covered_bases,
            out=np.zeros(n_bins, dtype=np.float64),
            where=covered_bases > 0,
        ),
        nan=0.0,
        posinf=0.0,
        neginf=0.0,
    ).astype(np.float32)
    return _track_result(values, "text_bedgraph")


def _track_result(values: Float32Array, track_format: TrackFormat) -> TrackResult:
    """Build the common reader result for a float32 track."""
    return {
        "values": values,
        "vmin": float(values.min()),
        "vmax": float(values.max()),
        "format": track_format,
    }
