import { useQuery } from '@tanstack/react-query';

import { fetchSamples } from '../api/client';
import type { Sample } from '../api/types';

/**
 * Load the catalog of all samples (for the active species) and cache it via
 * TanStack Query under the same `['samples', 'pig']` key used by `LeftRail`
 * (the only other consumer — currently unmounted but a future re-mount will
 * hit this same cache instead of re-issuing the network request).
 *
 * This hook deliberately does NOT write into the global `samples` store.
 * That store is consumed by Hi-C / 3D / Differential / Loop routes that
 * only need `active`, and forcing a catalog load on those routes would be
 * a hidden side effect. The Tracks route opts in explicitly via this hook.
 */
export function useSampleCatalog(): {
  samples: Sample[] | undefined;
  isLoading: boolean;
  error: Error | null;
} {
  const query = useQuery<Sample[], Error>({
    queryKey: ['samples', 'pig'],
    queryFn: () => fetchSamples('pig'),
    staleTime: 5 * 60_000,
  });

  return {
    samples: query.data,
    isLoading: query.isLoading,
    error: query.error,
  };
}