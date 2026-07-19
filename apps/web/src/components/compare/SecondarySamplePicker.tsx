import type { JSX } from 'react';
import { useQuery } from '@tanstack/react-query';

import { fetchSamples } from '../../api/client';
import { useComparison } from '../../store/comparison';
import './compare.css';

/**
 * Dropdown shown in the TopBar when comparison mode is enabled. Lets the user
 * pick sample B (the secondary sample). Hidden entirely when comparison is off
 * so the default single-sample view is uncluttered.
 */
export function SecondarySamplePicker(): JSX.Element | null {
  const enabled = useComparison((s) => s.enabled);
  const secondarySample = useComparison((s) => s.secondarySample);
  const primarySample = useComparison((s) => s.primarySample);
  const setSecondary = useComparison((s) => s.setSecondary);

  const { data: samples = [] } = useQuery({
    queryKey: ['samples', 'pig'],
    queryFn: () => fetchSamples('pig'),
  });

  if (!enabled) return null;

  return (
    <label className="secondary-sample-picker">
      <span className="secondary-sample-picker__label">样本 B</span>
      <select
        className="secondary-sample-picker__select"
        value={secondarySample ?? ''}
        onChange={(e) => setSecondary(e.target.value || null)}
      >
        <option value="">— 选择样本 B —</option>
        {samples
          .filter((s) => s.id !== primarySample)
          .map((s) => (
            <option key={s.id} value={s.id}>
              {s.id} ({s.tissue})
            </option>
          ))}
      </select>
    </label>
  );
}
