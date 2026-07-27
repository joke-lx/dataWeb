import type { JSX } from 'react';

import { useActiveSample } from '../../../hooks/useActiveSample';
import { GeneLane } from './GeneLane';
import { HiCMatrix } from './HiCMatrix';
import { TadBar } from './TadBar';

export function HicModel(): JSX.Element {
  const sampleId = useActiveSample() ?? 'Brain_BF3';
  return (
    <>
      <HiCMatrix sampleId={sampleId} />
      <TadBar sampleId={sampleId} />
      <GeneLane sampleId={sampleId} />
    </>
  );
}

export default HicModel;