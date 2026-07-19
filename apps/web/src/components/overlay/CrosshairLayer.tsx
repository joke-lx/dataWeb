import type { JSX } from 'react';

import { formatBp } from '../../genomics/coords';
import { useCursor } from '../../store/cursor';
import { useViewport } from '../../store/viewport';
import './crosshair.css';

export function CrosshairLayer(): JSX.Element | null {
  const chr = useViewport((state) => state.chr);
  const x = useCursor((state) => state.x);
  const bp = useCursor((state) => state.bp);
  const track = useCursor((state) => state.track);

  if (x === null || bp === null) return null;

  return (
    <div className="crosshair-layer">
      <div className="crosshair-vline" style={{ left: `${x}px` }} />
      <div className="crosshair-readout">
        <span className="crosshair-pos">
          {chr}:{formatBp(bp)}
        </span>
        {track && <span className="crosshair-track">{track}</span>}
      </div>
    </div>
  );
}
