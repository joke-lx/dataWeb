-- dataWeb schema: samples + genomic tracks
-- Based on registry.yaml and BED reader formats

CREATE TABLE IF NOT EXISTS samples (
    id          TEXT PRIMARY KEY,
    tissue      TEXT NOT NULL,
    breed       TEXT NOT NULL,
    sex         TEXT NOT NULL,
    individual  INTEGER NOT NULL,
    dev_stage   TEXT NOT NULL DEFAULT 'adult',
    species     TEXT NOT NULL DEFAULT 'pig',
    assembly    TEXT NOT NULL DEFAULT 'susScr11'
);

CREATE TABLE IF NOT EXISTS tad_regions (
    id          SERIAL PRIMARY KEY,
    sample_id   TEXT NOT NULL REFERENCES samples(id),
    chrom       TEXT NOT NULL,
    start       BIGINT NOT NULL,
    region_end  BIGINT NOT NULL,
    score       REAL,
    filtered    BOOLEAN NOT NULL DEFAULT FALSE,
    UNIQUE(sample_id, chrom, start, region_end, filtered)
);

CREATE TABLE IF NOT EXISTS ab_compartments (
    id          SERIAL PRIMARY KEY,
    sample_id   TEXT NOT NULL REFERENCES samples(id),
    chrom       TEXT NOT NULL,
    start       BIGINT NOT NULL,
    region_end  BIGINT NOT NULL,
    score       REAL NOT NULL,
    UNIQUE(sample_id, chrom, start, region_end)
);

CREATE TABLE IF NOT EXISTS pei_interactions (
    id          SERIAL PRIMARY KEY,
    sample_id   TEXT NOT NULL REFERENCES samples(id),
    chrom       TEXT NOT NULL,
    start       BIGINT NOT NULL,
    region_end  BIGINT NOT NULL,
    gene_id     TEXT NOT NULL,
    distance_kb REAL NOT NULL,
    score       REAL NOT NULL,
    UNIQUE(sample_id, chrom, start, region_end, gene_id)
);

CREATE INDEX IF NOT EXISTS idx_tad_sample ON tad_regions(sample_id);
CREATE INDEX IF NOT EXISTS idx_tad_region ON tad_regions(chrom, start, region_end);
CREATE INDEX IF NOT EXISTS idx_ab_sample ON ab_compartments(sample_id);
CREATE INDEX IF NOT EXISTS idx_ab_region ON ab_compartments(chrom, start, region_end);
CREATE INDEX IF NOT EXISTS idx_pei_sample ON pei_interactions(sample_id);
CREATE INDEX IF NOT EXISTS idx_pei_region ON pei_interactions(chrom, start, region_end);
