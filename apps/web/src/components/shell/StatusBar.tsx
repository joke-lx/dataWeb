import type { JSX } from 'react';
import { useViewport } from '../../store/viewport';

function formatBp(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}Mb`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}kb`;
  return `${n}bp`;
}

export function StatusBar(): JSX.Element {
  const { chr, start, end } = useViewport((s) => s.viewport);

  return (
    <footer className="statusbar">
      <div className="statusbar__region">
        {chr}:{formatBp(start)}-{formatBp(end)}
      </div>
      <div className="statusbar__source">data source: mock</div>
    </footer>
  );
}