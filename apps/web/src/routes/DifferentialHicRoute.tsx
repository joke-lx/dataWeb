import { useEffect, useState } from 'react';
import type { JSX } from 'react';

import { ColormapBar } from '../components/hic/ColormapBar';
import {
  HiCMatrix2D,
  fetchDifferentialHic,
} from '../components/hic/HiCMatrix2D';
import { Lane } from '../components/stage/Lane';
import { useActiveSample } from '../hooks/useActiveSample';
import { useSamples } from '../store/samples';
import { useViewport } from '../store/viewport';

export function DifferentialHicRoute(): JSX.Element {
  const activeId = useActiveSample();
  const samples = useSamples((s) => s.samples);
  const viewport = useViewport();
  const sampleA = activeId ?? 'Brain_BF3';
  // Pick first sample from different tissue as B
  const sampleB = samples.find((s) => s.id !== sampleA)?.id ?? 'Liver_BF3';

  const [matrix, setMatrix] = useState<Awaited<
    ReturnType<typeof fetchDifferentialHic>
  > | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const ctrl = new AbortController();
    setLoading(true);
    setError(null);
    fetchDifferentialHic(
      sampleA,
      sampleB,
      viewport.chr,
      viewport.start,
      viewport.end,
      viewport.bin,
    )
      .then((res) => {
        if (!ctrl.signal.aborted) setMatrix(res);
      })
      .catch((e: Error) => {
        if (!ctrl.signal.aborted) setError(e);
      })
      .finally(() => {
        if (!ctrl.signal.aborted) setLoading(false);
      });
    return () => ctrl.abort();
  }, [sampleA, sampleB, viewport.chr, viewport.start, viewport.end, viewport.bin]);

  return (
    <main className="route-page">
      <header className="route-header">
        <h2>Differential Hi-C</h2>
        <p>
          log2(<code>{sampleA}</code> / <code>{sampleB}</code>) ·{' '}
          {viewport.chr}:{viewport.start.toLocaleString()}-
          {viewport.end.toLocaleString()}
        </p>
      </header>
      <div className="route-content">
        <div className="diff-hic-pair">
          <HiCMatrix2D
            sampleA={sampleA}
            sampleB={sampleB}
            variant="differential"
            data={matrix ?? undefined}
            loading={loading}
            error={error}
            bin={viewport.bin}
            height={420}
          />
        </div>
        <ColormapBar
          vmin={matrix?.vmin ?? -1}
          vmax={matrix?.vmax ?? 1}
          mode="differential"
          colorMap="rdbu"
        />
        <Lane kind="gene" title="Gene model" trackName="gene" bedKind="gene" sampleId={sampleA} />
      </div>
    </main>
  );
}