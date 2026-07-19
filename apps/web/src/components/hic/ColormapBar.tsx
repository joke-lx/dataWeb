import type { JSX } from 'react';

export type ColormapName = 'rdbu' | 'viridis';

interface ColormapBarProps {
  vmin: number;
  vmax: number;
  colorMap: ColormapName;
  onChange?: (cm: ColormapName) => void;
}

const GRADIENTS: Record<ColormapName, string> = {
  viridis:
    'linear-gradient(to right, #440154, #482878, #3e4989, #31688e, #26828e, #1f9e89, #35b779, #6ece58, #b5de2b, #fde725)',
  rdbu: 'linear-gradient(to right, #2c5fa6, #f7f7f7, #c0392b)',
};

export function ColormapBar({
  vmin,
  vmax,
  colorMap,
  onChange,
}: ColormapBarProps): JSX.Element {
  const gradient = GRADIENTS[colorMap];
  const mid = (vmin + vmax) / 2;
  return (
    <div className="colormap-bar">
      <div
        className="colormap-bar-gradient"
        style={{ background: gradient }}
      />
      <div className="colormap-bar-labels">
        <span>{vmin.toFixed(2)}</span>
        <span>{mid.toFixed(2)}</span>
        <span>{vmax.toFixed(2)}</span>
      </div>
      {onChange && (
        <select
          className="colormap-bar-select"
          value={colorMap}
          onChange={(e) => onChange(e.target.value as ColormapName)}
        >
          <option value="rdbu">RdBu_r</option>
          <option value="viridis">Viridis</option>
        </select>
      )}
    </div>
  );
}