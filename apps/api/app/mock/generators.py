"""Deterministic mock generators for Hi-C, bigwig and bed-style tracks.

Every generator derives a seed from
``sha256(f"{sample_id}|{chr}|{start}|{end}|{bin}|{track}")`` so the same
request always yields the same bytes. The shape of each response matches the
real backend contract (see ``docx/plan/architecture.md`` §2).
"""

from __future__ import annotations

import hashlib

import numpy as np


def seed_rng(*parts: object) -> np.random.Generator:
    """Return a ``numpy.random.Generator`` keyed by a sha256 of ``parts``."""
    payload = "|".join(str(p) for p in parts)
    digest = hashlib.sha256(payload.encode("utf-8")).hexdigest()[:16]
    return np.random.default_rng(int(digest, 16))


# ---------------------------------------------------------------------------
# Hi-C contact matrix
# ---------------------------------------------------------------------------

# Vectorised diagonal band fallback for large n to avoid O(n^2) Python loops.
_DIAG_BAND_N_MAX = 400


def hic_matrix(
    sample_id: str,
    chrom: str,
    start: int,
    end: int,
    bin_bp: int,
) -> tuple[np.ndarray, float, float]:
    """Generate a synthetic Hi-C contact matrix.

    Components (per the plan):
      1. Diagonal warm band: ``exp(-distance / 50kb) * 100``
      2. TAD block-diagonal stripes every ~200kb
      3. Sparse loop pixels (~50 random anchor pairs, each a 5x5 bright spot)
      4. AB compartment signal: alternating row/col blocks every ~5Mb

    Returns ``(mat, vmin, vmax)`` where ``vmin`` is the matrix minimum and
    ``vmax`` is the 99th percentile (used as the client colour-map upper bound).
    """
    n = (end - start) // bin_bp
    if n <= 0:
        empty = np.zeros((0, 0), dtype=np.float32)
        return empty, 0.0, 0.0

    rng = seed_rng(sample_id, chrom, start, end, bin_bp, "hic")
    mat = np.zeros((n, n), dtype=np.float32)

    # 1. Diagonal warm band -------------------------------------------------
    if n > _DIAG_BAND_N_MAX:
        idx = np.arange(n, dtype=np.int64)
        dist = np.abs(np.subtract.outer(idx, idx)) * bin_bp
        diag = (np.exp(-dist / 50_000.0) * 100.0).astype(np.float32)
        mat += diag
        del dist, diag
    else:
        for i in range(n):
            for j in range(n):
                d = abs(i - j) * bin_bp
                mat[i, j] += np.exp(-d / 50_000) * 100

    # 2. TAD block-diagonal stripes every ~200kb ---------------------------
    tad_period_bins = max(1, 200_000 // bin_bp)
    for tad_start in range(0, n, tad_period_bins):
        tad_end = min(tad_start + tad_period_bins, n)
        mat[tad_start:tad_end, tad_start:tad_end] *= 2.5

    # 3. Sparse loop pixels (~50 random anchor pairs, 5x5 bright spots) -----
    for _ in range(50):
        a, b = rng.integers(0, n, size=2)
        if abs(int(a) - int(b)) > 10:
            for di in range(-2, 3):
                for dj in range(-2, 3):
                    ai = int(a) + di
                    bj = int(b) + dj
                    if 0 <= ai < n and 0 <= bj < n:
                        mat[ai, bj] += 30

    # 4. AB compartment signal: alternating row/col blocks every ~5Mb ------
    ab_period_bins = max(1, 5_000_000 // bin_bp)
    for block_start in range(0, n, ab_period_bins):
        block_end = min(block_start + ab_period_bins, n)
        sign = 1.0 if (block_start // ab_period_bins) % 2 == 0 else -1.0
        mat[block_start:block_end, :] += sign * 5
        mat[:, block_start:block_end] += sign * 5

    # Apply log1p so the client sees log-scaled contact counts.
    mat = np.log1p(np.maximum(mat, 0))

    vmin = float(mat.min())
    vmax = float(np.percentile(mat, 99))
    return mat, vmin, vmax


# ---------------------------------------------------------------------------
# bigwig signal
# ---------------------------------------------------------------------------


def bigwig_track(
    sample_id: str,
    chrom: str,
    start: int,
    end: int,
    n_bins: int,
    track_name: str,
) -> np.ndarray:
    """Generate a synthetic 1D bigwig track (RNA-seq / ChIP-seq style)."""
    if n_bins <= 0:
        return np.zeros(0, dtype=np.float32)

    rng = seed_rng(sample_id, chrom, start, end, n_bins, track_name)
    x = np.linspace(0.0, 8.0 * np.pi, n_bins)
    base = 5.0 + 3.0 * np.sin(x) + 2.0 * np.cos(x * 1.7)

    peaks = np.zeros(n_bins, dtype=np.float32)
    n_peaks = max(5, n_bins // 200)
    idx = np.arange(n_bins)
    for _ in range(n_peaks):
        center = int(rng.integers(0, n_bins))
        sigma = max(20, int(rng.integers(50, 200)))
        amplitude = float(rng.uniform(2, 12))
        peaks += amplitude * np.exp(-0.5 * ((idx - center) / sigma) ** 2)

    arr = (base + peaks).astype(np.float32)
    return np.maximum(arr, 0)


# ---------------------------------------------------------------------------
# bed-style tracks (AB / TAD / PEI / gene)
# ---------------------------------------------------------------------------


def bed_records(
    sample_id: str,
    chrom: str,
    start: int,
    end: int,
    track_name: str,
    kind: str,
) -> list[dict]:
    """Generate bed-style records.

    ``kind`` selects the recipe:
      * ``"ab"``  — AB index bedGraph (signed score)
      * ``"tad"`` — TAD boundary intervals
      * ``"pei"`` — PEI anchors with linked gene metadata
      * ``"gene"``— gene model (5 genes × 5–10 exons)
    """
    rng = seed_rng(sample_id, chrom, start, end, 0, track_name)
    width = end - start
    if width <= 0:
        return []

    if kind == "ab":
        n_bins = max(1, min(100, width // 50_000))
        bin_size = max(1, width // n_bins)
        records: list[dict] = []
        for i in range(n_bins):
            x = i / max(1, n_bins - 1)
            score = float(3.0 * np.sin(x * 6.0 * np.pi) + rng.normal(0, 0.5))
            records.append(
                {
                    "chrom": chrom,
                    "start": start + i * bin_size,
                    "end": start + (i + 1) * bin_size,
                    "score": score,
                }
            )
        return records

    if kind == "tad":
        n_tads = int(rng.integers(20, 50))
        records = []
        cursor = start
        for i in range(n_tads):
            tad_len = int(rng.integers(50_000, 2_000_000))
            tad_end = min(cursor + tad_len, end)
            if tad_end > cursor:
                records.append(
                    {
                        "chrom": chrom,
                        "start": cursor,
                        "end": tad_end,
                        "score": float(i),
                    }
                )
            cursor = tad_end + int(rng.integers(0, 50_000))
            if cursor >= end:
                break
        return records

    if kind == "pei":
        mock_genes = [
            "ENSSSCG00000004008",
            "ENSSSCG00000038931",
            "ENSSSCG00000047845",
            "ENSSSCG00000030155",
            "ENSSSCG00000027726",
        ]
        n_pei = 30
        records = []
        for _ in range(n_pei):
            pei_start = int(rng.integers(start, end))
            pei_end = pei_start + int(rng.integers(5_000, 30_000))
            if pei_end > end:
                pei_end = end
            dist_kb = int(rng.integers(10, 1000))
            p_val = float(np.exp(-rng.uniform(2, 20)))
            gene = mock_genes[int(rng.integers(0, len(mock_genes)))]
            records.append(
                {
                    "chrom": chrom,
                    "start": pei_start,
                    "end": pei_end,
                    "gene_id": gene,
                    "distance_kb": dist_kb,
                    "p_value": p_val,
                    "score": float(-np.log10(max(p_val, 1e-16))),
                }
            )
        return records

    if kind == "gene":
        gene_names = [
            "MOCK_GENE_A",
            "MOCK_GENE_B",
            "MOCK_GENE_C",
            "MOCK_GENE_D",
            "MOCK_GENE_E",
        ]
        records = []
        n_genes = 5
        gene_spacing = width // (n_genes + 1)
        for g in range(n_genes):
            gene_start = start + (g + 1) * gene_spacing - 50_000
            gene_end = gene_start + int(rng.integers(30_000, 100_000))
            strand = "+" if g % 2 == 0 else "-"
            n_exons = int(rng.integers(5, 10))
            exon_len = max(1, (gene_end - gene_start) // n_exons)
            for e in range(n_exons):
                exon_start = gene_start + e * exon_len
                exon_end = exon_start + exon_len
                records.append(
                    {
                        "chrom": chrom,
                        "start": exon_start,
                        "end": exon_end,
                        "gene_name": gene_names[g],
                        "exon_index": e,
                        "strand": strand,
                        "is_exon": True,
                    }
                )
        return records

    if kind == "is":
        return insulation_score(sample_id, chrom, start, end, n_bins=100)

    return []


# ---------------------------------------------------------------------------
# Differential Hi-C (log2 ratio between two samples)
# ---------------------------------------------------------------------------


def differential_hic(
    sample_a: str,
    sample_b: str,
    chrom: str,
    start: int,
    end: int,
    bin_bp: int,
) -> tuple[np.ndarray, float, float]:
    """Compute log2((A + ε) / (B + ε)) between two Hi-C samples.

    Returns ``(mat, vmin, vmax)`` where ``vmin``/``vmax`` are the symmetric
    ±99th-percentile clip values used as the colour-map range.
    """
    mat_a, _, _ = hic_matrix(sample_a, chrom, start, end, bin_bp)
    mat_b, _, _ = hic_matrix(sample_b, chrom, start, end, bin_bp)

    # Inject per-sample multiplicative noise so the two matrices differ even
    # when the deterministic hic_matrix skeleton happens to coincide (e.g.
    # very small grids). The noise is bounded so the log2 ratio stays in a
    # realistic range.
    rng_a = seed_rng(sample_a, chrom, start, end, bin_bp, "hic_diff_a")
    rng_b = seed_rng(sample_b, chrom, start, end, bin_bp, "hic_diff_b")
    eps = 0.1
    shape = mat_a.shape
    mat_a = mat_a + eps + np.maximum(rng_a.normal(1.0, 0.3, size=shape), 0.05).astype(np.float32)
    mat_b = mat_b + eps + np.maximum(rng_b.normal(1.0, 0.3, size=shape), 0.05).astype(np.float32)
    diff = np.log2(mat_a / mat_b).astype(np.float32)
    if diff.size == 0:
        return diff, 0.0, 0.0
    abs_max = float(np.percentile(np.abs(diff), 99))
    if abs_max == 0.0:
        # Fall back to a tiny symmetric range so headers remain valid floats.
        abs_max = 1.0
    return diff, -abs_max, abs_max


# ---------------------------------------------------------------------------
# Insulation score (bedGraph-style)
# ---------------------------------------------------------------------------


def insulation_score(
    sample_id: str,
    chrom: str,
    start: int,
    end: int,
    n_bins: int,
) -> list[dict]:
    """Return an insulation-score bedGraph for the requested region.

    The signal oscillates around 0 in roughly ``[-1.5, +1.5]`` with local
    minima at TAD-boundary positions (~every 200 kb / ~10 bins).
    """
    if n_bins <= 0 or end <= start:
        return []
    rng = seed_rng(sample_id, chrom, start, end, n_bins, "is")
    width = end - start
    bin_size = width // n_bins
    records: list[dict] = []
    for i in range(n_bins):
        x = i / max(1, n_bins - 1)
        # Base oscillating signal in roughly [-0.5, 0.5]
        score = -0.5 * np.cos(x * 12 * np.pi)
        # TAD-boundary dips every ~10 bins, narrow falloff.
        for j in range(0, n_bins, 10):
            d = abs(i - j)
            if d < 3:
                score -= (3 - d) * 0.4
        score += float(rng.normal(0, 0.05))
        records.append(
            {
                "chrom": chrom,
                "start": start + i * bin_size,
                "end": start + (i + 1) * bin_size,
                "score": float(score),
            }
        )
    return records


# ---------------------------------------------------------------------------
# CTCF loops (bedpe-style)
# ---------------------------------------------------------------------------


def ctcf_loops(
    sample_id: str,
    chrom: str,
    start: int,
    end: int,
) -> list[dict]:
    """Return ~30 CTCF-loop bedpe records in the requested region."""
    if end <= start:
        return []
    rng = seed_rng(sample_id, chrom, start, end, 0, "ctcf_loops")
    n_loops = 30
    loops: list[dict] = []
    for _ in range(n_loops):
        a = int(rng.integers(start, end))
        b = int(rng.integers(start, end))
        if abs(a - b) < 50_000:
            continue
        if a > b:
            a, b = b, a
        loops.append(
            {
                "chrom1": chrom,
                "start1": a,
                "end1": a + 5_000,
                "chrom2": chrom,
                "start2": b,
                "end2": b + 5_000,
                "score": float(rng.uniform(0.3, 1.0)),
            }
        )
    loops.sort(key=lambda r: r["start1"])
    return loops


# ---------------------------------------------------------------------------
# Structural variant records
# ---------------------------------------------------------------------------


# ---------------------------------------------------------------------------
# CTCF motif PWM (position weight matrix)
# ---------------------------------------------------------------------------


def ctcf_motif_matrix(
    sample_id: str,
    chrom: str,
    start: int,
    end: int,
) -> dict:
    """Generate a synthetic CTCF motif PWM for the requested region.

    Returns a ``dict`` with:
      * ``"matrix"`` — list of 19 columns × 4 rows (A/C/G/T log-odds),
        centred on a synthetic CTCF core motif site within the region.
      * ``"consensus"`` — the consensus base at each column.
      * ``"anchor_pos"`` — the genomic coordinate of the motif centre.

    The core motif is modelled after the canonical CCCTC-binding factor
    (JASPAR MA0139.1-like): 19 bp with a GC-rich centre.
    """
    width = end - start
    if width <= 0:
        return {"matrix": [], "consensus": "", "anchor_pos": 0}

    rng = seed_rng(sample_id, chrom, start, end, 0, "ctcf_motif")
    # Place a pseudo-random anchor in the region
    anchor = int(rng.integers(start + 100, max(start + 100, end - 100)))
    half = 9  # 19 bp → ±9 around anchor
    n_cols = 19

    # Canonical seed: PWM columns (A,C,G,T) loosely based on MA0139.1
    # Each column is a distribution that sums roughly to 0 in log2 space
    raw = [
        #      A      C      G      T
        [0.10,  0.30,  0.40,  0.20],  # 1
        [0.15,  0.35,  0.35,  0.15],  # 2
        [0.08,  0.45,  0.40,  0.07],  # 3
        [0.05,  0.50,  0.40,  0.05],  # 4  — C rich
        [0.05,  0.45,  0.45,  0.05],  # 5
        [0.20,  0.30,  0.30,  0.20],  # 6
        [0.25,  0.25,  0.25,  0.25],  # 7  — uniform
        [0.10,  0.40,  0.40,  0.10],  # 8
        [0.05,  0.55,  0.35,  0.05],  # 9  — C peak
        [0.05,  0.40,  0.50,  0.05],  # 10 — G peak (core)
        [0.05,  0.35,  0.55,  0.05],  # 11 — G peak
        [0.10,  0.40,  0.40,  0.10],  # 12
        [0.25,  0.25,  0.25,  0.25],  # 13 — uniform
        [0.20,  0.30,  0.30,  0.20],  # 14
        [0.07,  0.40,  0.45,  0.08],  # 15
        [0.05,  0.45,  0.45,  0.05],  # 16
        [0.10,  0.40,  0.40,  0.10],  # 17
        [0.15,  0.35,  0.35,  0.15],  # 18
        [0.20,  0.30,  0.30,  0.20],  # 19
    ]

    # Convert to log-odds ratio: log2(p / 0.25)
    log_matrix: list[list[float]] = []
    for col in raw:
        log_col = [round(float(np.log2(max(p, 1e-10) / 0.25)), 4) for p in col]
        log_matrix.append(log_col)

    # Add per-sample noise so different samples give slightly different logos
    rng = seed_rng(sample_id, chrom, start, end, 0, "ctcf_motif_noise")
    noise_scale = 0.05
    for col in log_matrix:
        for i in range(4):
            col[i] = round(col[i] + float(rng.normal(0, noise_scale)), 4)

    # Transpose to (4 × 19) — rows A,C,G,T; columns positions
    pwm: list[list[float]] = [
        [round(col[0], 4) for col in log_matrix],  # A
        [round(col[1], 4) for col in log_matrix],  # C
        [round(col[2], 4) for col in log_matrix],  # G
        [round(col[3], 4) for col in log_matrix],  # T
    ]

    bases = ["A", "C", "G", "T"]
    consensus = "".join(
        bases[max(range(4), key=lambda i: log_matrix[col_idx][i])]
        for col_idx in range(n_cols)
    )

    return {
        "matrix": pwm,
        "consensus": consensus,
        "anchor_pos": anchor,
    }


# ---------------------------------------------------------------------------
# CTCF genotype distribution (3 mock SNPs)
# ---------------------------------------------------------------------------


def ctcf_genotype_distribution(population: str = "global") -> dict:
    """Return a synthetic genotype distribution at CTCF anchor SNP sites.

    ``population`` acts as a seed key so different populations yield
    different distributions.
    """
    snps = [
        {"snp_id": "rs1323_CTCF", "chrom": "chr1", "pos": 1_050_000},
        {"snp_id": "rs9876_CTCF", "chrom": "chr1", "pos": 1_250_000},
        {"snp_id": "rs5543_CTCF", "chrom": "chr1", "pos": 1_420_000},
    ]
    rng = seed_rng(population, "ctcf_genotype")
    records: list[dict] = []
    for snp in snps:
        ref_hom = round(float(rng.uniform(0.3, 0.7)), 4)
        alt_hom = round(float(rng.uniform(0.05, 0.25)), 4)
        het = round(float(1.0 - ref_hom - alt_hom), 4)
        # Clamp rounding errors
        total = ref_hom + alt_hom + het
        if abs(total - 1.0) > 0.01:
            ref_hom = round(ref_hom / total, 4)
            het = round(het / total, 4)
            alt_hom = round(1.0 - ref_hom - het, 4)
        records.append({
            **snp,
            "ref_allele": "C" if snp["snp_id"] == "rs1323_CTCF" else "G",
            "alt_allele": "T" if snp["snp_id"] == "rs1323_CTCF" else "A",
            "distribution": {
                "ref_hom": ref_hom,
                "het": het,
                "alt_hom": alt_hom,
            },
        })
    return {"records": records}


def sv_records(
    sample_id: str,
    chrom: str,
    start: int,
    end: int,
) -> list[dict]:
    """Return ~10 SV records mixing DEL / DUP / INV / TRA kinds."""
    if end <= start + 10_000:
        return []
    rng = seed_rng(sample_id, chrom, start, end, 0, "sv")
    kinds = ["DEL", "DUP", "INV", "TRA"]
    n_sv = 10
    svs: list[dict] = []
    for _ in range(n_sv):
        kind = kinds[int(rng.integers(0, len(kinds)))]
        pos = int(rng.integers(start, max(start + 1, end - 10_000)))
        length = int(rng.integers(100, 10_000))
        svs.append(
            {
                "chrom": chrom,
                "start": pos,
                "end": pos + length,
                "kind": kind,
                "score": float(rng.uniform(0.5, 1.0)),
            }
        )
    svs.sort(key=lambda r: r["start"])
    return svs