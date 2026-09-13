/**
 * 区间输入控件 — **两段式**：`[chr:label] [start] – [end] [Go]`。
 *
 * 职责：解析用户输入的 `start` 和 `end`，与 viewport 双向同步，合法提交
 * 写回当前视口（面板级或全局）。
 *
 * 为什么两段：start/end 拆开输入比单文本框更易改一端，也避免长串数字
 * 挤在一个 input 里。
 *
 * 为什么 `chr` 是只读标签：chr 极少切换，且需要从 species registry 取
 * 列表才能做下拉，超出本控件职责。固定为当前 viewport.chr 的可视前缀，
 * 让用户只关心位置数字。需要切 chr 时另寻 UI（d3-zoom 也会触发 chr 改动）。
 *
 * 输入格式宽松：允许千位逗号（`1,000,000`）。
 * 提交：Enter 键 或 "Go" 按钮（任一 input 聚焦时按 Enter 都生效）。
 * 非法输入（格式错、end <= start）静默忽略。
 *
 * 视口来源：`usePanelViewport` —— Compare 工作区面板（独立视口）内写面板
 * store；普通页面 / 同步开时回退全局 store，行为与旧版一致。
 */
import { useEffect, useState } from 'react';
import type { JSX } from 'react';

import { usePanelViewport, usePanelViewportStore } from '../../hooks/usePanelViewport';
import './nav.css';

/** 匹配允许千位逗号的正整数。 */
const INT_RE = /^\d+(?:,\d+)*$/;

/** mock 染色体列表。 */
const CHROMOSOMES = ['chr1','chr2','chr3','chr4','chr5','chr6','chr7','chr8','chr9','chr10','chrX'];

/** 视口大小选项（bp）。 */
const VIEW_SIZES = [
  { label: '1 Mb', bp: 1_000_000 },
  { label: '5 Mb', bp: 5_000_000 },
  { label: '10 Mb', bp: 10_000_000 },
  { label: '50 Mb', bp: 50_000_000 },
  { label: '100 Mb', bp: 100_000_000 },
];

/** 把 `1234567` 或 `1,234,567` 解析为 number；解析失败返回 NaN。 */
function parseBp(text: string): number {
  if (!INT_RE.test(text)) return Number.NaN;
  return Number.parseInt(text.replace(/,/g, ''), 10);
}

/**
 * 两段式区间输入控件。
 *
 * 屏幕显示：`chr1:[start]  -  [end]  [Go]`
 * 提交：Enter 或 Go 按钮。
 * 非法输入静默忽略。
 */
export function RegionInput(): JSX.Element {
  const store = usePanelViewportStore();
  const chr = usePanelViewport((state) => state.chr);
  const start = usePanelViewport((state) => state.start);
  const end = usePanelViewport((state) => state.end);

  const [startText, setStartText] = useState(`${start}`);
  const [endText, setEndText] = useState(`${end}`);

  // 跟随外部 viewport 变化刷新文本（d3-zoom / RegionInput 自身 都触发）。
  useEffect(() => {
    setStartText(`${Math.round(start)}`);
  }, [start]);
  useEffect(() => {
    setEndText(`${Math.round(end)}`);
  }, [end]);

  const onSubmit = (): void => {
    const nextStart = parseBp(startText);
    const nextEnd = parseBp(endText);
    if (!Number.isFinite(nextStart) || !Number.isFinite(nextEnd)) return;
    if (nextEnd <= nextStart) return;

    // 一次 setState 写入，避免触发额外的中间渲染。
    store.setState({
      start: nextStart,
      end: nextEnd,
    });
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLInputElement>): void => {
    if (event.key === 'Enter') onSubmit();
  };

  const onChrChange = (e: React.ChangeEvent<HTMLSelectElement>): void => {
    store.setState({ chr: e.target.value, start: 0, end: 5_000_000 });
  };
  const onSizeChange = (e: React.ChangeEvent<HTMLSelectElement>): void => {
    const bp = Number(e.target.value);
    const center = (start + end) / 2;
    store.setState({
      start: Math.max(0, Math.round(center - bp / 2)),
      end: Math.round(center + bp / 2),
    });
  };
  const currentSize = end - start;
  const sizeLabel = VIEW_SIZES.find((v) => Math.abs(v.bp - currentSize) < currentSize * 0.15)?.label ?? 'Custom';

  return (
    <div className="region-input">
      <select
        aria-label="Select chromosome"
        className="region-input__chr-select"
        value={CHROMOSOMES.includes(chr) ? chr : 'chr1'}
        onChange={onChrChange}
      >
        {CHROMOSOMES.map((c) => (
          <option key={c} value={c}>{c}</option>
        ))}
      </select>
      <input
        aria-label={`Start position on ${chr}`}
        type="text"
        value={startText}
        onChange={(event) => setStartText(event.target.value)}
        onKeyDown={onKeyDown}
        placeholder="1,000,000"
        className="region-input__start"
      />
      <span className="region-input__sep" aria-hidden="true">–</span>
      <input
        aria-label={`End position on ${chr}`}
        type="text"
        value={endText}
        onChange={(event) => setEndText(event.target.value)}
        onKeyDown={onKeyDown}
        placeholder="2,000,000"
        className="region-input__end"
      />
      <button type="button" onClick={onSubmit}>
        Go
      </button>
      <select
        aria-label="Viewport size"
        className="region-input__size-select"
        value={currentSize}
        onChange={onSizeChange}
      >
        {VIEW_SIZES.map((v) => (
          <option key={v.label} value={v.bp}>{v.label}</option>
        ))}
      </select>
    </div>
  );
}
