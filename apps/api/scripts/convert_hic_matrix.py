"""Convert raw Hi-C matrix TSVs into float32 ``.npy`` caches for mmap access.

Input files follow the naming convention::

    {sample}.{chrom}.{chrom}.BP.20000.fill.mat.quantile

Each file is a TSV square matrix; every row is::

    chromId \\t binStart \\t binEnd \\t N contact values

where ``N`` equals the number of rows (dense square matrix, 20 kb bins,
quantile-normalised values). The whole-genome TSV set is far too large to
parse per request (chr1 alone is ~1.8 GB of text), so we convert each
chromosome once into a plain (uncompressed) ``.npy`` float32 file that
``numpy.load(mmap_mode='r')`` can slice in O(1).

Usage::

    uv run python scripts/convert_hic_matrix.py --sample Brain_BF3 --chrs 1
    uv run python scripts/convert_hic_matrix.py --sample Brain_BF3        # all present

Notes
-----
* Truncated source files (interrupted copies) still form self-consistent
  squares — they simply cover fewer bins. We do NOT validate against the
  reference chromosome length; coverage is taken from the file itself.
* Rows must be contiguous 20 kb bins starting at 0 (validated).
"""

from __future__ import annotations

import argparse
import re
import sys
import time
from pathlib import Path

import numpy as np

BIN_SIZE = 20_000
TSV_PATTERN = re.compile(
    r"^(?P<sample>[^.]+)\.(?P<chrom>\d+)\.(?P<chrom2>\d+)\.BP\.(?P<res>\d+)\.fill\.mat\.quantile$"
)


def find_tsvs(root: Path, sample: str) -> dict[str, Path]:
    """Map chromosome number -> TSV path for ``sample`` under ``root``."""
    found: dict[str, Path] = {}
    for path in sorted(root.glob("*.quantile")):
        match = TSV_PATTERN.match(path.name)
        if match and match.group("sample") == sample:
            found[match.group("chrom")] = path
    return found


def convert_one(tsv_path: Path, out_path: Path) -> tuple[int, int]:
    """Convert one TSV to ``.npy``; returns ``(n_rows, n_cols)``."""
    started = time.time()
    matrix: np.ndarray | None = None
    n_rows = 0
    n_cols = 0

    with open(tsv_path, "r", encoding="utf-8") as handle:
        for lineno, line in enumerate(handle):
            if not line.strip():
                continue
            fields = line.rstrip("\n").split("\t")
            if lineno == 0:
                n_cols = len(fields) - 3  # chr, start, end prefix
                if n_cols <= 0:
                    raise ValueError(f"{tsv_path.name}: no value columns")
                matrix = np.empty((n_cols, n_cols), dtype=np.float32)
            elif len(fields) != n_cols + 3:
                raise ValueError(
                    f"{tsv_path.name}:{lineno}: expected {n_cols + 3} fields, got {len(fields)}"
                )
            assert matrix is not None
            if n_rows >= matrix.shape[0]:
                raise ValueError(
                    f"{tsv_path.name}: more rows ({lineno + 1}) than value columns ({n_cols})"
                )
            # 校验前缀:chromosome id 一致 + bin 坐标线性连续(0, 20k, 40k, ...)。
            bin_start = int(fields[1])
            if bin_start != n_rows * BIN_SIZE:
                raise ValueError(
                    f"{tsv_path.name}:{lineno}: bin start {bin_start} breaks "
                    f"linear 20 kb grid at row {n_rows}"
                )
            matrix[n_rows] = np.asarray(fields[3:], dtype=np.float32)
            n_rows += 1
            if n_rows % 1000 == 0:
                elapsed = time.time() - started
                print(
                    f"  {tsv_path.name}: {n_rows}/{n_cols} rows "
                    f"({elapsed:.0f}s)",
                    flush=True,
                )

    assert matrix is not None
    if n_rows != n_cols:
        # 行少于列 = 方阵不完整;截掉多余列保持方阵(以文件覆盖为准)。
        print(
            f"  {tsv_path.name}: WARNING rows({n_rows}) != cols({n_cols}); "
            f"truncating to square {n_rows}x{n_rows}",
            flush=True,
        )
        matrix = matrix[:n_rows, :n_rows]

    out_path.parent.mkdir(parents=True, exist_ok=True)
    np.save(out_path, matrix)
    print(
        f"  {tsv_path.name} -> {out_path.name}: {n_rows}x{n_rows} float32 "
        f"({matrix.nbytes / 1e6:.0f} MB) in {time.time() - started:.0f}s",
        flush=True,
    )
    return n_rows, n_cols


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--root",
        type=Path,
        default=Path(r"D:\qq\数据库\3"),
        help="Directory holding the .quantile TSVs",
    )
    parser.add_argument("--sample", default="Brain_BF3", help="Sample id prefix")
    parser.add_argument(
        "--chrs",
        nargs="*",
        default=None,
        help="Chromosome numbers to convert (default: all found)",
    )
    parser.add_argument(
        "--out",
        type=Path,
        default=None,
        help="Output dir (default: <root>/npy)",
    )
    args = parser.parse_args()

    tsvs = find_tsvs(args.root, args.sample)
    if not tsvs:
        print(f"No TSVs for {args.sample} under {args.root}", file=sys.stderr)
        return 1
    selected = (
        {c: p for c, p in tsvs.items() if c in set(args.chrs)}
        if args.chrs
        else tsvs
    )
    out_dir = args.out or (args.root / "npy")

    print(f"Converting {len(selected)} chromosome(s) for {args.sample}:")
    failed = 0
    for chrom, path in sorted(selected.items(), key=lambda kv: int(kv[0])):
        out_path = out_dir / f"{args.sample}.chr{chrom}.{BIN_SIZE // 1000}kb.npy"
        try:
            convert_one(path, out_path)
        except (ValueError, OSError) as error:
            print(f"  FAILED {path.name}: {error}", file=sys.stderr)
            failed += 1
    print(f"Done. Output dir: {out_dir}")
    return 1 if failed else 0


if __name__ == "__main__":
    raise SystemExit(main())
