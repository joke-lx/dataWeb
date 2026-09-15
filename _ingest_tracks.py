"""Ingest AB / TAD / PEI data files into Postgres.

AB:  01.AB_compartment/<sample>.20kb.AB_Index.txt  -> chrom start end score
TAD: 02.TAD/boundary/<sample>.IS_split.TAD           -> chrom start end
PEI: 03.PEI/<sample>...keepbyFrequency               -> chrom start end gene distance score
"""
import os, glob, psycopg2

DATA_ROOT = r"D:\qq\猪多组学数据\猪多组学数据"
CONN = dict(host="127.0.0.1", port=15432, dbname="dataweb",
            user="dataweb", password="1ee7465aebdb85bceb0101dd04dce346")

def chrom_to_str(c):
    c = c.strip()
    if c.isdigit():
        return f"chr{c}"
    return c

def _conn():
    return psycopg2.connect(**CONN, connect_timeout=30)

def ingest_ab(conn):
    files = glob.glob(os.path.join(DATA_ROOT, "01.AB_compartment", "*.AB_Index.txt"))
    total = 0
    for f in files:
        sample = os.path.basename(f).split(".")[0]
        c = _conn(); c.autocommit = True
        cur = c.cursor()
        cur.execute("SELECT id FROM samples WHERE id=%s", (sample,))
        if not cur.fetchone():
            print(f"  skip AB (no sample): {sample}"); c.close(); continue
        cur.execute("SELECT count(*) FROM ab_compartments WHERE sample_id=%s", (sample,))
        if cur.fetchone()[0] > 0:
            print(f"  AB {sample}: already exists, skip"); c.close(); continue
        rows = []
        with open(f, encoding="utf-8") as fh:
            for line in fh:
                parts = line.rstrip("\n").split("\t")
                if len(parts) < 4: continue
                rows.append((sample, chrom_to_str(parts[0]), int(parts[1]), int(parts[2]), float(parts[3])))
                if len(rows) >= 5000:
                    cur.executemany(
                        "INSERT INTO ab_compartments (sample_id, chrom, start, region_end, score) "
                        "VALUES (%s,%s,%s,%s,%s) ON CONFLICT DO NOTHING", rows)
                    rows.clear()
        if rows:
            cur.executemany(
                "INSERT INTO ab_compartments (sample_id, chrom, start, region_end, score) "
                "VALUES (%s,%s,%s,%s,%s) ON CONFLICT DO NOTHING", rows)
        total += 1
        print(f"  AB {sample}: inserted")
        c.close()
    print(f"AB samples ingested: {total}")

def ingest_tad(conn):
    files = glob.glob(os.path.join(DATA_ROOT, "02.TAD", "boundary", "*.TAD"))
    total = 0
    for f in files:
        sample = os.path.basename(f).split(".IS_split")[0]
        c = _conn(); c.autocommit = True
        cur = c.cursor()
        cur.execute("SELECT id FROM samples WHERE id=%s", (sample,))
        if not cur.fetchone():
            print(f"  skip TAD (no sample): {sample}"); c.close(); continue
        cur.execute("SELECT count(*) FROM tad_regions WHERE sample_id=%s AND filtered=FALSE", (sample,))
        if cur.fetchone()[0] > 0:
            print(f"  TAD {sample}: already exists, skip"); c.close(); continue
        rows = []
        with open(f, encoding="utf-8") as fh:
            for line in fh:
                parts = line.rstrip("\n").split("\t")
                if len(parts) < 3: continue
                rows.append((sample, chrom_to_str(parts[0]), int(parts[1]), int(parts[2])))
        cur.executemany(
            "INSERT INTO tad_regions (sample_id, chrom, start, region_end, filtered) "
            "VALUES (%s,%s,%s,%s,FALSE) ON CONFLICT DO NOTHING", rows)
        total += 1
        print(f"  TAD {sample}: {len(rows)} rows")
        c.close()
    print(f"TAD samples ingested: {total}")

def ingest_pei(conn):
    files = glob.glob(os.path.join(DATA_ROOT, "03.PEI", "*keepbyFrequency"))
    total = 0
    for f in files:
        sample = os.path.basename(f).split(".")[0]
        c = _conn(); c.autocommit = True
        cur = c.cursor()
        cur.execute("SELECT id FROM samples WHERE id=%s", (sample,))
        if not cur.fetchone():
            print(f"  skip PEI (no sample): {sample}"); c.close(); continue
        cur.execute("SELECT count(*) FROM pei_interactions WHERE sample_id=%s", (sample,))
        if cur.fetchone()[0] > 0:
            print(f"  PEI {sample}: already exists, skip"); c.close(); continue
        rows = []
        with open(f, encoding="utf-8") as fh:
            for line in fh:
                parts = line.rstrip("\n").split("\t")
                if len(parts) < 9: continue
                gene_id = parts[3].split(":")[0]
                rows.append((sample, parts[0], int(parts[1]), int(parts[2]),
                             gene_id, float(parts[4]), float(parts[7])))
        cur.executemany(
            "INSERT INTO pei_interactions (sample_id, chrom, start, region_end, gene_id, distance_kb, score) "
            "VALUES (%s,%s,%s,%s,%s,%s,%s) ON CONFLICT DO NOTHING", rows)
        total += 1
        print(f"  PEI {sample}: {len(rows)} rows")
        c.close()
    print(f"PEI samples ingested: {total}")

if __name__ == "__main__":
    conn = psycopg2.connect(**CONN)
    print("Ingesting AB...")
    ingest_ab(conn)
    print("Ingesting TAD...")
    ingest_tad(conn)
    print("Ingesting PEI...")
    ingest_pei(conn)
    conn.close()
    print("Done.")
