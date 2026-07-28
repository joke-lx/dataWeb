/**
 * SamplePicker —— 多样本叠加用的多选 popover。
 *
 * 职责：
 *  - 接收「URL 已提交」的多样本 id 列表作为种子，构建本地 `draft`（草稿态）；
 *  - 点击 chip 仅切换 draft 成员，**不发起任何网络请求**；
 *  - 用户点 Apply 才把 draft 通过 `onApply` 写回 URL（单一 source of truth = URL）。
 *
 * 关键交互：
 *  - Cancel / Esc / 点击外部 → 丢弃 draft，关闭；
 *  - Clear all → 清空 draft（仍需 Apply 才生效）；
 *  - Apply → `onApply(draft)`，由父级写回 URL。
 *
 * 目录：
 *  - 已知 tissue 分组排序：Muscle → Liver → Brain → 其它；
 *  - 未知 / URL 里不存在的 id 仍保留在 draft 里（防止加载短暂窗口内被静默删除）。
 *
 * 架构位置：作为 `<SamplePickerButton />` 的内部细节存在；自身不再被路由直接使用。
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import type { JSX, MouseEvent as ReactMouseEvent, WheelEvent as ReactWheelEvent } from 'react';

import type { Sample } from '../../../api/types';
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
 * 多选样本 popover。带草稿（draft）状态，与"已生效到 URL 的样本集合"
 * 解耦，确保"探索多个样本但不立即污染 URL"。
 *
 * @param sampleIds 当前 URL 中已生效的样本 id（按字典序排序）
 * @param allSamples 完整样本目录；空数组 = 尚未加载完
 * @param onApply 把草稿写回 URL 的回调
 * @param onCancel 关闭并丢弃草稿的回调
 */
export function SamplePicker({
  sampleIds,
  allSamples,
  onApply,
  onCancel,
}: SamplePickerProps): JSX.Element {
  // 从已提交的选择初始化草稿。
  const [draft, setDraft] = useState<string[]>(() => sampleIds);
  const popoverRef = useRef<HTMLDivElement | null>(null);

  // 按 tissue 分组（Muscle → Liver → Brain → 其它在后）。
  // 按 tissue 分组并固定排序顺序（Muscle > Liver > Brain > 其它），
  // 组内再按 sample id 字典序排序——和 SamplePickerButton chip 行展示一致。
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

  // 点击外部 + Escape 关闭。
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

  // 阻止冒泡到外层 d3-zoom，否则在 popover 里滚轮/拖拽会平移基因组视口。
  // 阻止冒泡到外层 d3-zoom，否则在 popover 里滚轮/拖拽会平移基因组视口。
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