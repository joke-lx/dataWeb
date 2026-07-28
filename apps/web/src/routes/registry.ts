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
 * Old URL targets — kept as empty for now. The catch-all `*` route in
 * ``App.tsx`` redirects anything unmapped to ``/`` so the user lands
 * on the home page and navigates through the proper hierarchy.
 *
 * Do NOT add per-sample hardcoded redirects here (e.g. ``/hic -> /sample/Brain_BF3``).
 * Those are engineering anti-patterns: they pin a specific sample, defeat
 * the sample-first navigation, and silently misroute if a sample is removed
 * or renamed. Real legacy URLs would be cross-sample, generic
 * (e.g. ``/hic -> /species/pig``), and even those should be added only
 * with explicit user intent — never as placeholders.
 */
export const LEGACY_REDIRECTS: Record<string, string> = {};
