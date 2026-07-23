import type { JSX } from 'react';

import type { Sample } from '../../api/types';
import { SamplePickerButton } from './SamplePickerButton';

interface TrackSampleHeaderProps {
  /** Track title shown on the left of the header. */
  title: string;
  /** Currently selected sample ids (URL canonical, sorted). */
  sampleIds: string[];
  /** Replace the selection with `next` (single source of truth = URL). */
  onSampleChange: (next: string[]) => void;
  /** Full sample catalog. Empty array means catalog hasn't loaded yet. */
  allSamples: Sample[];
  /** Show a skeleton chip when true (catalog hasn't loaded yet). */
  isCatalogLoading: boolean;
}

/**
 * Track-bound header for bigwig tracks that supports the multi-sample
 * overlay. Sits as a sibling of the Lane inside `.route-content` so the
 * chip row gets the full content width — no 120 px lane-gutter squeeze.
 *
 * Visual structure (left → right):
 *   [title] ─── [selected sample chips × N] ─── [+ Add sample]
 */
export function TrackSampleHeader({
  title,
  sampleIds,
  onSampleChange,
  allSamples,
  isCatalogLoading,
}: TrackSampleHeaderProps): JSX.Element {
  return (
    <div className="track-sample-header" data-ui-overlay="track-sample-header">
      <span className="track-sample-header__title">{title}</span>
      <SamplePickerButton
        sampleIds={sampleIds}
        onChange={onSampleChange}
        allSamples={allSamples}
        isCatalogLoading={isCatalogLoading}
      />
    </div>
  );
}