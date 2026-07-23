/** Track descriptor — config for a single genomic track lane. */

import type { BedKind } from '../api/types';

export type TrackId =
  | 'hic' | 'rna_seq' | 'h3k4me3' | 'h3k27ac'
  | 'ab' | 'is' | 'tad' | 'pei' | 'loop' | 'sv' | 'gene';

export interface TrackSpec {
  id: TrackId;
  kind: 'hic' | 'bigwig' | 'bedGraph' | 'is' | 'tadBar' | 'pei' | 'sv' | 'gene';
  title: string;
  trackName?: string;
  bedKind?: BedKind;
  defaultHeight: number;
}

export const TRACK_CATALOG: Record<TrackId, TrackSpec> = {
  hic:     { id: 'hic',     kind: 'hic',      title: 'Hi-C matrix',                defaultHeight: 480 },
  rna_seq: { id: 'rna_seq', kind: 'bigwig',   title: 'RNA-seq',     trackName: 'rna_seq',  defaultHeight: 180 },
  h3k4me3: { id: 'h3k4me3', kind: 'bigwig',   title: 'H3K4me3',     trackName: 'h3k4me3',  defaultHeight: 180 },
  h3k27ac: { id: 'h3k27ac', kind: 'bigwig',   title: 'H3K27ac',     trackName: 'h3k27ac',  defaultHeight: 180 },
  ab:      { id: 'ab',      kind: 'bedGraph',  title: 'AB index',    bedKind: 'ab',        defaultHeight: 150 },
  is:      { id: 'is',      kind: 'is',        title: 'Insulation',  bedKind: 'is',        defaultHeight: 150 },
  tad:     { id: 'tad',     kind: 'tadBar',    title: 'TAD boundary', bedKind: 'tad',      defaultHeight: 120 },
  pei:     { id: 'pei',     kind: 'pei',       title: 'PEI anchors', bedKind: 'pei',       defaultHeight: 180 },
  /** Special: Hi-C lane (320 px) + SVG loop overlay + gene. */
  loop:    { id: 'loop',    kind: 'hic',       title: 'Hi-C + loops',                 defaultHeight: 320 },
  sv:      { id: 'sv',      kind: 'sv',        title: 'Structural variants',           defaultHeight: 120 },
  gene:    { id: 'gene',    kind: 'gene',      title: 'Gene model',   bedKind: 'gene',  defaultHeight: 120 },
};

export interface SubTab {
  id: TrackId;
  group: 'sequencing' | 'structure' | 'gene';
  label: string;
  aux: TrackId[];
}

/**
 * Sub-tab descriptors for the Tracks route.
 * Each entry defines the main track + its fixed auxiliary lanes.
 */
export const SUB_TABS: SubTab[] = [
  // Sequencing
  { id: 'rna_seq', group: 'sequencing', label: 'RNA-seq',  aux: ['tad', 'gene'] },
  { id: 'h3k4me3', group: 'sequencing', label: 'H3K4me3',  aux: ['tad', 'gene'] },
  { id: 'h3k27ac', group: 'sequencing', label: 'H3K27ac',  aux: ['tad', 'gene'] },
  // Structure
  { id: 'ab',      group: 'structure',  label: 'AB Index', aux: ['tad', 'gene'] },
  { id: 'is',      group: 'structure',  label: 'IS',       aux: ['tad', 'gene'] },
  { id: 'tad',     group: 'structure',  label: 'TAD',      aux: ['gene'] },
  { id: 'pei',     group: 'structure',  label: 'PEI',      aux: ['tad', 'gene'] },
  { id: 'loop',    group: 'structure',  label: 'Loops',    aux: ['gene'] },
  { id: 'sv',      group: 'structure',  label: 'SV',       aux: ['tad', 'gene'] },
  // Gene
  { id: 'gene',    group: 'gene',       label: 'Gene',     aux: [] },
];

/** Group labels for the sub-tab bar. */
export const GROUP_LABELS: Record<SubTab['group'], string> = {
  sequencing: 'Sequencing',
  structure: 'Structure',
  gene: 'Annotation',
};
