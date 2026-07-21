export interface RouteSpec {
  id: string;
  path: string;
  label: string; // button text
  icon: string; // emoji or short text, optional
  description: string; // short description
  primaryTrack: string; // which renderer is the focus
}

export const ROUTES: RouteSpec[] = [
  {
    id: 'hic',
    path: '/hic',
    label: 'Hi-C',
    icon: '',
    description: 'Contact matrix (double sample)',
    primaryTrack: 'hic',
  },
  {
    id: 'differential-hic',
    path: '/differential-hic',
    label: 'Differential Hi-C',
    icon: '',
    description: 'log2(A/B) split heatmap',
    primaryTrack: 'differentialHic',
  },
  {
    id: 'ab-index',
    path: '/ab-index',
    label: 'AB Index',
    icon: '',
    description: 'A/B compartment bar',
    primaryTrack: 'bedGraph',
  },
  {
    id: 'insulation-score',
    path: '/insulation-score',
    label: 'Insulation Score',
    icon: '',
    description: 'TAD boundary strength',
    primaryTrack: 'is',
  },
  {
    id: 'tad',
    path: '/tad',
    label: 'TAD',
    icon: '',
    description: 'Topologically associating domains',
    primaryTrack: 'tadBar',
  },
  {
    id: 'pei',
    path: '/pei',
    label: 'PEI Anchors',
    icon: '',
    description: 'Promoter-enhancer interactions',
    primaryTrack: 'pei',
  },
  {
    id: 'ctcf-loops',
    path: '/ctcf-loops',
    label: 'CTCF Loops',
    icon: '',
    description: 'CTCF-CTCF chromatin loops',
    primaryTrack: 'ctcfLoop',
  },
  {
    id: 'rna-seq',
    path: '/rna-seq',
    label: 'RNA-seq',
    icon: '',
    description: 'Gene expression bigwig',
    primaryTrack: 'bigwig',
  },
  {
    id: 'h3k4me3',
    path: '/h3k4me3',
    label: 'H3K4me3',
    icon: '',
    description: 'Active promoter ChIP-seq',
    primaryTrack: 'bigwig',
  },
  {
    id: 'h3k27ac',
    path: '/h3k27ac',
    label: 'H3K27ac',
    icon: '',
    description: 'Active enhancer ChIP-seq',
    primaryTrack: 'bigwig',
  },
  {
    id: 'sv',
    path: '/sv',
    label: 'SV',
    icon: '',
    description: 'Structural variants',
    primaryTrack: 'sv',
  },
  {
    id: 'gene',
    path: '/gene',
    label: 'Gene Annotation',
    icon: '',
    description: 'Gene model + exons',
    primaryTrack: 'gene',
  },
  {
    id: '3d',
    path: '/3d',
    label: '3D Structure',
    icon: '',
    description: 'Chromatin 3D ribbon',
    primaryTrack: 'threeD',
  },
];