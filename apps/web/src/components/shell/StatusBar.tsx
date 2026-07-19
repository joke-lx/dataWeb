import type { JSX } from 'react';
import { formatBp } from '../../genomics/coords';
import { useViewport } from '../../store/viewport';

export function StatusBar(): JSX.Element {
  const chr = useViewport((state) => state.chr);
  const start = useViewport((state) => state.start);
  const end = useViewport((state) => state.end);

  return (
    <footer className="statusbar">
      <div className="statusbar__region">
        {chr}:{formatBp(start)}-{formatBp(end)}
      </div>
      <div className="statusbar__source">data source: mock</div>
    </footer>
  );
}