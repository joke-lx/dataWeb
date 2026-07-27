export type RouteCategory = 'main' | 'trigger';

export interface RouteSpec {
  id: string;
  path: string;
  label: string;
  description: string;
  category: RouteCategory;
}

export const ROUTES: RouteSpec[] = [
  { id: 'home', path: '/', label: 'Home', description: 'Atlas landing page', category: 'main' },
  { id: 'sample', path: '/sample/:id', label: 'Sample', description: 'Single-sample views', category: 'main' },
  { id: 'compare', path: '/compare/:a/:b', label: 'Compare', description: 'Compare two samples', category: 'main' },
];

/**
 * Old URLs → new sample-first / compare-first URL targets.
 * Used by ``App.tsx`` to emit ``<Navigate replace>`` routes so
 * bookmarks and external links continue to work.
 */
export const LEGACY_REDIRECTS: Record<string, string> = {
  '/differential-hic': '/compare/Brain_BF3/Liver_BF3',
  '/ab-index': '/sample/Brain_BF3?type=ab',
  '/insulation-score': '/sample/Brain_BF3?type=is',
  '/tad': '/sample/Brain_BF3?type=tad',
  '/pei': '/sample/Brain_BF3?type=pei',
  '/ctcf-loops': '/sample/Brain_BF3?type=loop',
  '/rna-seq': '/sample/Brain_BF3?type=rna_seq',
  '/h3k4me3': '/sample/Brain_BF3?type=h3k4me3',
  '/h3k27ac': '/sample/Brain_BF3?type=h3k27ac',
  '/sv': '/sample/Brain_BF3?type=sv',
  '/gene': '/sample/Brain_BF3?type=gene',
  '/hic': '/sample/Brain_BF3',
  '/tracks': '/sample/Brain_BF3?tab=tracks',
  '/3d': '/sample/Brain_BF3?tab=3d',
  '/ctcf-motif': '/sample/Brain_BF3?tab=ctcfMotif',
  '/differential': '/compare/Brain_BF3/Liver_BF3',
};
