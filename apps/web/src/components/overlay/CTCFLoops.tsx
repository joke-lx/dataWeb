import { useEffect, useState } from 'react';

import { bpToPx } from '../../genomics/coords';
import { useViewport } from '../../store/viewport';
import './overlay.css';

interface LoopRecord {
  chrom1: string;
  start1: number;
  end1: number;
  chrom2: string;
  start2: number;
  end2: number;
  score: number;
}

interface CTCFLoopsProps {
  sampleId: string;
  height?: number;
  width: number;
}

export function CTCFLoops({
  sampleId,
  height = 60,
  width,
}: CTCFLoopsProps): JSX.Element {
  const viewport = useViewport();
  const [records, setRecords] = useState<LoopRecord[]>([]);

  useEffect(() => {
    const ctrl = new AbortController();
    fetch(
      `/api/ctcf/loops?sample=${sampleId}&chr=${viewport.chr}&start=${viewport.start}&end=${viewport.end}`,
      { signal: ctrl.signal },
    )
      .then((r) => (r.ok ? r.json() : Promise.reject(r.statusText)))
      .then((j: { records?: LoopRecord[] }) =>
        setRecords(j.records ?? []),
      )
      .catch((e: Error) => {
        if (e.name !== 'AbortError') console.error('ctcf loops', e);
      });
    return () => ctrl.abort();
  }, [sampleId, viewport.chr, viewport.start, viewport.end]);

  const arcColor =
    getComputedStyle(document.documentElement)
      .getPropertyValue('--color-loop-arc')
      .trim() || '#b8b8b8';

  return (
    <svg
      className="ctcf-loops-overlay"
      width={width}
      height={height}
      style={{ background: 'var(--color-surface-1)' }}
    >
      {records.map((rec, i) => {
        if (rec.chrom1 !== viewport.chr) return null;
        const x1 = bpToPx(rec.start1, viewport, width);
        const x2 = bpToPx(rec.start2, viewport, width);
        if (x1 < 0 || x2 > width || x1 > width || x2 < 0) return null;
        const yMax = height - 4;
        const midX = (x1 + x2) / 2;
        const path = `M ${x1} ${yMax} Q ${midX} ${4} ${x2} ${yMax}`;
        return (
          <g key={i}>
            <path
              d={path}
              stroke={arcColor}
              strokeWidth={1.5}
              fill="none"
              opacity={0.4 + rec.score * 0.6}
            />
            <circle cx={x1} cy={yMax} r={3} fill={arcColor} />
            <circle cx={x2} cy={yMax} r={3} fill={arcColor} />
          </g>
        );
      })}
    </svg>
  );
}