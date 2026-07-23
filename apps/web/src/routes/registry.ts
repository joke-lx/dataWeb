export type RouteCategory = 'main' | 'trigger';

export interface RouteSpec {
  id: string;
  path: string;
  label: string;
  description: string;
  category: RouteCategory;
}

export const ROUTES: RouteSpec[] = [
  {
    id: 'hic',
    path: '/hic',
    label: 'Hi-C',
    description: 'Contact matrix (single sample)',
    category: 'main',
  },
  {
    id: 'differential',
    path: '/differential',
    label: 'Δ Hi-C',
    description: 'log2(A/B) split heatmap',
    category: 'main',
  },
  {
    id: 'tracks',
    path: '/tracks',
    label: 'Tracks',
    description: 'Multi-omics track views',
    category: 'main',
  },
  {
    id: '3d',
    path: '/3d',
    label: '3D',
    description: 'Chromatin 3D ribbon',
    category: 'main',
  },
  {
    id: 'ctcf-motif',
    path: '/ctcf-motif',
    label: 'CTCF Motif',
    description: 'Motif logo + genotype distribution',
    category: 'trigger',
  },
];

/**
 * Old 13-route URLs → new URL targets.
 * Used by ``App.tsx`` to emit ``<Navigate replace>`` routes so
 * bookmarks and external links continue to work.
 */
export const LEGACY_REDIRECTS: Record<string, string> = {
  '/differential-hic': '/differential',
  '/ab-index': '/tracks?type=ab',
  '/insulation-score': '/tracks?type=is',
  '/tad': '/tracks?type=tad',
  '/pei': '/tracks?type=pei',
  '/ctcf-loops': '/tracks?type=loop',
  '/rna-seq': '/tracks?type=rna_seq',
  '/h3k4me3': '/tracks?type=h3k4me3',
  '/h3k27ac': '/tracks?type=h3k27ac',
  '/sv': '/tracks?type=sv',
  '/gene': '/tracks?type=gene',
  // '/hic' and '/3d' are unchanged — no redirect needed.
};
