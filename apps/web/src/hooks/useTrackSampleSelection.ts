import { useCallback, useMemo } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import { useSearchParams } from 'react-router-dom';

import { useActiveSample } from './useActiveSample';

/**
 * URL-driven selection of sample ids for the multi-sample overlay on the
 * `/tracks` route's bigwig track.
 *
 * Semantics (URL `?samples=`):
 *   - **absent**    → fallback to `[active ?? 'Brain_BF3']` (first render)
 *   - `samples=`   → explicit empty (no samples selected)
 *   - `samples=A,B,C` → canonical sorted list `['A','B','C']`
 *
 * The hook is the *single* source of truth for the picker — no mirror in
 * the global `samples` store. This keeps `active` (used by Hi-C / 3D /
 * Differential) and the overlay selection fully decoupled.
 *
 * `setter` uses the callback form of `setParams` so any sibling keys
 * (`type`, future keys) are preserved across updates.
 */
export function useTrackSampleSelection(): {
  sampleIds: string[];
  hasExplicit: boolean;
  setSampleIds: Dispatch<SetStateAction<string[]>>;
  setSampleIdsRaw: (next: string[]) => void;
} {
  const [params, setParams] = useSearchParams();
  const active = useActiveSample();

  const raw = params.get('samples');
  const hasExplicit = raw !== null;

  const sampleIds = useMemo<string[]>(() => {
    if (raw === null) {
      // Absent — fall back to active sample (default semantics).
      return [active ?? 'Brain_BF3'];
    }
    if (raw === '') {
      // Explicit empty — picker has been opened and Apply was clicked with
      // an empty selection. Don't synthesize a fallback.
      return [];
    }
    return raw
      .split(',')
      .map((s) => s.trim())
      .filter((s) => s.length > 0)
      .sort();
  }, [raw, active]);

  const setSampleIdsRaw = useCallback(
    (next: string[]) => {
      const canonical = Array.from(new Set(next)).sort();
      setParams(
        (prev) => {
          if (canonical.length === 0) {
            // Preserve the empty-but-explicit semantic.
            prev.set('samples', '');
          } else {
            prev.set('samples', canonical.join(','));
          }
          return prev;
        },
        { replace: false },
      );
    },
    [setParams],
  );

  const setSampleIds = useCallback<Dispatch<SetStateAction<string[]>>>(
    (updater) => {
      setSampleIdsRaw(typeof updater === 'function' ? updater(sampleIds) : updater);
    },
    [setSampleIdsRaw, sampleIds],
  );

  return { sampleIds, hasExplicit, setSampleIds, setSampleIdsRaw };
}