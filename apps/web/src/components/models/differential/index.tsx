import type { JSX } from 'react';

import { useActiveSample } from '../../../hooks/useActiveSample';
import { useSamples } from '../../../store/samples';
import { GeneLane } from './GeneLane';
import { Log2Heatmap } from './Log2Heatmap';

export function DifferentialModel(): JSX.Element {
  const activeId = useActiveSample();
  const samples = useSamples((s) => s.samples);
  const sampleA = activeId ?? 'Brain_BF3';
  // Pick first sample from different tissue as B
  const sampleB = samples.find((s) => s.id !== sampleA)?.id ?? 'Liver_BF3';

  return (
    <>
      <Log2Heatmap sampleA={sampleA} sampleB={sampleB} />
      <GeneLane sampleId={sampleA} />
    </>
  );
}

export default DifferentialModel;