import type { JSX } from 'react';

export type ColormapName = 'rdbu' | 'viridis';

interface ColormapBarProps {
  vmin: number;
  vmax: number;
  colorMap: ColormapName;
  onChange?: (cm: ColormapName) => void;
  mode?: 'standard' | 'differential';
}

const GRADIENTS: Record<ColormapName, string> = {
  viridis:
    'linear-gradient(to right, #440154, #482878, #3e4989, #31688e, #26828e, #1f9e89, #35b779, #6ece58, #b5de2b, #fde725)',
  rdbu: 'linear-gradient(to right, #2c5fa6, #f7f7f7, #c0392b)',
};

const DIFFERENTIAL_GRADIENT =
  'linear-gradient(to right, #3b4cc0, #6b8cd9, #f7f7f7, #f5a04e, #cd3431)';

export function ColormapBar({
  vmin,
  vmax,
  colorMap,
  onChange,
  mode = 'standard',
}: ColormapBarProps): JSX.Element {
  const gradient =
    mode === 'differential' ? DIFFERENTIAL_GRADIENT : GRADIENTS[colorMap];
  const mid = (vmin + vmax) / 2;
  return (
    <div className="colormap-bar">
      <div
        className="colormap-bar-gradient"
        style={{ background: gradient }}
      />
      <div className="colormap-bar-labels">
        <span>{vmin.toFixed(2)}</span>
        <span>
          {mode === 'differential' ? 'Δ ' : ''}
          {mid.toFixed(2)}
        </span>
        <span>{vmax.toFixed(2)}</span>
      </div>
      {onChange && mode === 'standard' && (
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