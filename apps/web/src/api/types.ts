export interface Species {
  id: string;
  assembly: string;
  chromosomes: { name: string; length: number }[];
}

export interface Sample {
  id: string;
  species: string;
  tissue: string;
  breed: string;
  sex: string;
  individual: number;
  dev_stage: string;
}

interface IntervalRecord {
  chrom: string;
  start: number;
  end: number;
}

export interface BedGraphRecord extends IntervalRecord {
  score: number;
}

export interface TadRecord extends IntervalRecord {
  score: number;
}

export interface PeiRecord extends IntervalRecord {
  gene_id: string;
  distance_kb: number;
  score: number;
}

export interface GeneRecord extends IntervalRecord {
  gene_name: string;
  exon_index: number;
  strand: string;
  is_exon: boolean;
}

export type BedKind = 'ab' | 'tad' | 'pei' | 'gene' | 'is';

export interface BedRecordByKind {
  ab: BedGraphRecord;
  tad: TadRecord;
  pei: PeiRecord;
  gene: GeneRecord;
  is: BedGraphRecord;
}

/** CTCF motif PWM returned by ``/api/ctcf/motif``. */
export interface CtcfMotifResponse {
  matrix: number[][];
  consensus: string;
  anchor_pos: number;
}

/** Single SNP entry in the ``/api/ctcf/genotype`` response. */
export interface CtcfGenotypeRecord {
  snp_id: string;
  chrom: string;
  pos: number;
  ref_allele: string;
  alt_allele: string;
  distribution: {
    ref_hom: number;
    het: number;
    alt_hom: number;
  };
}

export interface CtcfGenotypeResponse {
  records: CtcfGenotypeRecord[];
}
