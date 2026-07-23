import { useMemo, useState } from 'react';
import type { JSX, MouseEvent as ReactMouseEvent } from 'react';

import type { Sample } from '../../api/types';
import { colorForTissue } from './sampleColors';
import { SamplePicker } from './SamplePicker';
import './tracks.css';

interface SamplePickerButtonProps {
  /** Currently selected sample ids (URL canonical, sorted). */
  sampleIds: string[];
  /** Replace the selection with `next` (single source of truth = URL). */
  onChange: (next: string[]) => void;
  /** Full sample catalog for grouping + chip labels. May be empty while loading. */
  allSamples: Sample[];
  /** Show a skeleton chip when true (catalog hasn't loaded yet). */
  isCatalogLoading: boolean;
}

/**
 * Header control for the multi-sample overlay:
 * - A `+ Add sample` button opens the `SamplePicker` popover.
 * - Each currently selected sample is rendered as a chip with an × button
 *   that fires `onChange` immediately on click (no draft state, no Apply).
 *
 * The full Picker (multi-select draft + Cancel/Apply) handles the case
 * where the user is exploring many options; the chip-row × handles the
 * fast "remove one" case.
 */
export function SamplePickerButton({
  sampleIds,
  onChange,
  allSamples,
  isCatalogLoading,
}: SamplePickerButtonProps): JSX.Element {
  const [open, setOpen] = useState(false);

  // Resolve selected samples → their tissue → colors for the chip-row swatches.
  const selected = useMemo<Sample[]>(() => {
    return sampleIds
      .map((id) => allSamples.find((s) => s.id === id))
      .filter((s): s is Sample => s !== undefined);
  }, [sampleIds, allSamples]);

  // Stop wheel/mousedown from leaking to the d3-zoom handler attached to
  // `.app-shell__main` (see apps/web/src/hooks/useD3Zoom.ts:23-35).
  // Without this, scrolling the picker would pan/zoom the genome viewport.
  const stopD3 = (e: ReactMouseEvent | WheelEvent): void => {
    e.stopPropagation();
  };

  return (
    <div
      className="sample-picker-row"
      data-ui-overlay="sample-picker"
      onWheelCapture={stopD3}
      onMouseDownCapture={stopD3}
    >
      <div className="sample-picker-chips">
        {isCatalogLoading && sampleIds.length === 0 ? (
          <span className="sample-chip sample-chip--loading">Loading…</span>
        ) : (
          selected.map((s) => {
            const c = colorForTissue(s.tissue);
            return (
              <span
                key={s.id}
                className="sample-chip sample-chip--active"
                style={{ borderLeftColor: c.line }}
                title={`${s.tissue} · ${s.breed} · ${s.sex}`}
              >
                <span className="sample-chip__swatch" style={{ background: c.line }} />
                <span className="sample-chip__id">{s.id}</span>
                <button
                  type="button"
                  className="sample-chip__remove"
                  aria-label={`Remove ${s.id}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    onChange(sampleIds.filter((x) => x !== s.id));
                  }}
                >
                  ×
                </button>
              </span>
            );
          })
        )}
        {sampleIds.length === 0 && !isCatalogLoading && (
          <span className="sample-picker-empty">No samples selected</span>
        )}
      </div>
      <button
        type="button"
        className="sample-picker-trigger"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        {open ? '×' : '+ Add sample'}
      </button>
      {open && (
        <SamplePicker
          sampleIds={sampleIds}
          allSamples={allSamples}
          onApply={(next) => {
            onChange(next);
            setOpen(false);
          }}
          onCancel={() => setOpen(false)}
        />
      )}
    </div>
  );
}