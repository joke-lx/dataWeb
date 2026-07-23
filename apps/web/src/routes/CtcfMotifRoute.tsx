import { useEffect, useState } from 'react';
import type { JSX } from 'react';

import { fetchCtcfGenotype, fetchCtcfMotif } from '../api/client';
import type { CtcfGenotypeResponse, CtcfMotifResponse } from '../api/types';
import { CtcfGenotypePie } from '../components/tracks/CtcfGenotypePie';
import { CtcfMotifLogo } from '../components/tracks/CtcfMotifLogo';
import { useViewport } from '../store/viewport';
import '../components/tracks/tracks.css';
import './route.css';

export function CtcfMotifRoute(): JSX.Element {
  const viewport = useViewport();

  const [motif, setMotif] = useState<CtcfMotifResponse | null>(null);
  const [motifLoading, setMotifLoading] = useState(false);
  const [motifError, setMotifError] = useState<string | null>(null);

  const [geno, setGeno] = useState<CtcfGenotypeResponse | null>(null);
  const [genoLoading, setGenoLoading] = useState(false);
  const [genoError, setGenoError] = useState<string | null>(null);

  useEffect(() => {
    const ctrl = new AbortController();
    setMotifLoading(true);
    setMotifError(null);
    fetchCtcfMotif(viewport.chr, viewport.start, viewport.end, 'default')
      .then((res) => {
        if (!ctrl.signal.aborted) setMotif(res);
      })
      .catch((err: Error) => {
        if (!ctrl.signal.aborted) setMotifError(err.message);
      })
      .finally(() => {
        if (!ctrl.signal.aborted) setMotifLoading(false);
      });
    return () => ctrl.abort();
  }, [viewport.chr, viewport.start, viewport.end]);

  useEffect(() => {
    const ctrl = new AbortController();
    setGenoLoading(true);
    setGenoError(null);
    fetchCtcfGenotype('global')
      .then((res) => {
        if (!ctrl.signal.aborted) setGeno(res);
      })
      .catch((err: Error) => {
        if (!ctrl.signal.aborted) setGenoError(err.message);
      })
      .finally(() => {
        if (!ctrl.signal.aborted) setGenoLoading(false);
      });
    return () => ctrl.abort();
  }, []);

  return (
    <main className="route-page">
      <header className="route-header">
        <h2>CTCF Motif &amp; Genotype</h2>
        <p>
          {viewport.chr}:{viewport.start.toLocaleString()}-{viewport.end.toLocaleString()}
        </p>
      </header>
      <div className="ctcf-motif-content">
        {motifLoading && <div className="ctcf-motif-panel"><p>Loading motif…</p></div>}
        {motifError && <div className="ctcf-motif-panel"><p>Error: {motifError}</p></div>}
        {motif && !motifLoading && !motifError && (
          <CtcfMotifLogo
            matrix={motif.matrix}
            consensus={motif.consensus}
          />
        )}

        {genoLoading && <div className="ctcf-motif-panel"><p>Loading genotype…</p></div>}
        {genoError && <div className="ctcf-motif-panel"><p>Error: {genoError}</p></div>}
        {geno && !genoLoading && !genoError && (
          <CtcfGenotypePie records={geno.records} />
        )}
      </div>
    </main>
  );
}
