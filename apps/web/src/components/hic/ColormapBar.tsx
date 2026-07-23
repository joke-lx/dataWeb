import type { JSX } from 'react';

export type ColormapName = 'rdbu' | 'viridis' | 'ref';

interface ColormapBarProps {
  vmin: number;
  vmax: number;
  colorMap: ColormapName;
  onChange?: (cm: ColormapName) => void;
  mode?: 'standard' | 'differential';
  /** When true, render as a horizontal bar (differential mode above heatmap). */
  horizontal?: boolean;
}

const GRADIENTS: Record<ColormapName, string> = {
  viridis:
    'linear-gradient(to bottom, #fde725, #b5de2b, #6ece58, #35b779, #1f9e89, #26828e, #31688e, #3e4989, #482878, #440154)',
  rdbu: 'linear-gradient(to bottom, #c0392b, #f7f7f7, #2c5fa6)',
  ref: 'linear-gradient(to bottom, #c85e5d, #de923b, #ddb044, #c4c195, #9dc4d0, #7fa6c8, #6b8bb8, #5b7099)',
};

const DIFFERENTIAL_GRADIENT =
  'linear-gradient(to right, #6e5693, #6b5da4, #a9a2ce, #fdf7fe, #f7d2d8, #f0848d, #d51031)';

export function ColormapBar({
  vmin,
  vmax,
  colorMap,
  onChange,
  mode = 'standard',
  horizontal = false,
}: ColormapBarProps): JSX.Element {
  const gradient =
    mode === 'differential' ? DIFFERENTIAL_GRADIENT : GRADIENTS[colorMap];

  if (horizontal) {
    return (
      <div className="diff-colorbar">
        <span className="diff-colorbar-title">Δ Intensity</span>
        <div className="diff-colorbar-row">
          <span className="diff-colorbar-label">{vmin.toFixed(1)}</span>
          <div className="diff-colorbar-gradient">
            <div
              className="diff-colorbar-fill"
              style={{ background: gradient }}
            />
          </div>
          <span className="diff-colorbar-label">{vmax.toFixed(1)}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="colormap-bar">
      <span className="colormap-bar-title">Intensity</span>
      <div className="colormap-bar-gradient-outer">
        <div
          className="colormap-bar-gradient"
          style={{ background: gradient }}
        />
      </div>
      <div className="colormap-bar-labels">
        <span>{vmax.toFixed(1)}</span>
        <span>{vmin.toFixed(1)}</span>
      </div>
      {onChange && mode === 'standard' && (
        <select
          className="colormap-bar-select"
          value={colorMap}
          onChange={(e) => onChange(e.target.value as ColormapName)}
        >
          <option value="ref">Ref</option>
          <option value="rdbu">RdBu_r</option>
          <option value="viridis">Viridis</option>
        </select>
      )}
    </div>
  );
}
