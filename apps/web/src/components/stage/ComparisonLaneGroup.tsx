import type { JSX } from 'react';

import { useComparison } from '../../store/comparison';
import { Lane } from './Lane';
import './comparison.css';

interface ComparisonLaneGroupProps {
  /** Height of each Hi-C matrix row, in pixels. */
  height?: number;
}

/**
 * Stacks two Hi-C matrices (sample A on top, sample B below) sharing the same
 * viewport. Both lanes subscribe to `useViewport`, so d3-zoom pan/zoom keeps
 * them in lock-step automatically. Rendered only while comparison mode is
 * enabled with a primary sample selected. Sample B's matrix appears once a
 * secondary sample is picked.
 */
export function ComparisonLaneGroup({
  height = 360,
}: ComparisonLaneGroupProps): JSX.Element | null {
  const enabled = useComparison((s) => s.enabled);
  const primarySample = useComparison((s) => s.primarySample);
  const secondarySample = useComparison((s) => s.secondarySample);

  if (!enabled || !primarySample) return null;

  return (
    <section className="comparison-hic-group">
      <Lane
        kind="hic"
        title="Hi-C matrix (A)"
        sampleId={primarySample}
        height={height}
      />
      {secondarySample && (
        <>
          <div className="comparison-hic-seam" aria-hidden="true" />
          <Lane
            kind="hic"
            title="Hi-C matrix (B)"
            sampleId={secondarySample}
            height={height}
          />
        </>
      )}
    </section>
  );
}
