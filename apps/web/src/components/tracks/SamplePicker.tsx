import { useEffect, useMemo, useRef, useState } from 'react';
import type { JSX, MouseEvent as ReactMouseEvent, WheelEvent as ReactWheelEvent } from 'react';

import type { Sample } from '../../api/types';
import { colorForTissue } from './sampleColors';

interface SamplePickerProps {
  /** Currently committed (URL) selection, sorted. Used to seed the draft. */
  sampleIds: string[];
  /** Full catalog. Empty array means catalog hasn't loaded yet. */
  allSamples: Sample[];
  /** Apply the draft → URL. */
  onApply: (next: string[]) => void;
  /** Cancel the draft without touching URL. */
  onCancel: () => void;
}

/**
 * Multi-select popover for sample overlay. Opens with a draft initialized
 * to the current `sampleIds`; clicking a chip toggles its membership in
 * the draft (no network requests fire until Apply).
 *
 * Footer:
 *   - Cancel: discard draft
 *   - Clear:  empty the draft (still requires Apply to commit)
 *   - Apply:  write the draft back through `onApply`
 *
 * Keyboard:
 *   - Escape closes the popover (treated as Cancel)
 *   - Click outside also closes (treated as Cancel)
 *
 * Catalog edge cases:
 *   - If `allSamples` is empty (still loading), the body shows a small
 *     hint and disables the chips.
 *   - Unknown ids from the URL survive in the draft so deep-links aren't
 *     silently purged during the brief loading window.
 */
export function SamplePicker({
  sampleIds,
  allSamples,
  onApply,
  onCancel,
}: SamplePickerProps): JSX.Element {
  // Seed draft from committed selection.
  const [draft, setDraft] = useState<string[]>(() => sampleIds);
  const popoverRef = useRef<HTMLDivElement | null>(null);

  // Group by tissue (Muscle → Liver → Brain → Unknown at the end).
  const grouped = useMemo<Array<[string, Sample[]]>>(() => {
    const order: string[] = [];
    const map = new Map<string, Sample[]>();
    (allSamples ?? []).forEach((s) => {
      const arr = map.get(s.tissue) ?? [];
      arr.push(s);
      map.set(s.tissue, arr);
      if (!order.includes(s.tissue)) order.push(s.tissue);
    });
    const entries: Array<[string, Sample[]]> = order.map((tissue) => [
      tissue,
      (map.get(tissue) ?? []).slice().sort((a, b) => a.id.localeCompare(b.id)),
    ]);
    const rank = (name: string): number => {
      if (name === 'Muscle') return 0;
      if (name === 'Liver') return 1;
      if (name === 'Brain') return 2;
      return 3;
    };
    return entries.sort((a, b) => rank(a[0]) - rank(b[0]));
  }, [allSamples]);

  // Click-outside + Escape close.
  useEffect(() => {
    const onDown = (e: MouseEvent): void => {
      const el = popoverRef.current;
      if (!el) return;
      if (e.target instanceof Node && !el.contains(e.target)) {
        onCancel();
      }
    };
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onCancel();
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [onCancel]);

  const toggle = (id: string): void => {
    setDraft((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id].sort(),
    );
  };

  // Stop wheel/mousedown from reaching d3-zoom attached to `.app-shell__main`.
  const stopD3 = (e: ReactMouseEvent | ReactWheelEvent): void => {
    e.stopPropagation();
  };

  const isCatalogLoading = allSamples.length === 0;

  return (
    <div
      className="sample-picker"
      ref={popoverRef}
      data-ui-overlay="sample-picker"
      onWheelCapture={stopD3}
      onMouseDownCapture={stopD3}
    >
      <div className="sample-picker__body">
        {isCatalogLoading ? (
          <div className="sample-picker__hint">Loading samples…</div>
        ) : grouped.length === 0 ? (
          <div className="sample-picker__hint">No samples available</div>
        ) : (
          grouped.map(([tissue, samples]) => (
            <div key={tissue} className="sample-picker__group">
              <span className="subtab-group-label">{tissue}</span>
              <div className="sample-picker__chips">
                {samples.map((s) => {
                  const c = colorForTissue(s.tissue);
                  const active = draft.includes(s.id);
                  return (
                    <button
                      key={s.id}
                      type="button"
                      className={
                        'subtab-chip' + (active ? ' subtab-chip--active' : '')
                      }
                      style={active ? { borderLeftColor: c.line, borderLeftWidth: 3 } : undefined}
                      onClick={() => toggle(s.id)}
                      title={`${s.tissue} · ${s.breed} · ${s.sex}`}
                    >
                      <span
                        className="sample-chip__swatch"
                        style={{ background: c.line }}
                      />
                      <span>{s.id}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))
        )}
      </div>
      <div className="sample-picker__footer">
        <button
          type="button"
          className="sample-picker__btn sample-picker__btn--ghost"
          onClick={() => setDraft([])}
          disabled={draft.length === 0}
        >
          Clear all
        </button>
        <div className="sample-picker__footer-spacer" />
        <button
          type="button"
          className="sample-picker__btn sample-picker__btn--ghost"
          onClick={onCancel}
        >
          Cancel
        </button>
        <button
          type="button"
          className="sample-picker__btn sample-picker__btn--primary"
          onClick={() => onApply(draft)}
        >
          Apply ({draft.length})
        </button>
      </div>
    </div>
  );
}