/**
 * 区间输入控件 — **两段式**：`[chr:label] [start] – [end] [Go]`。
 *
 * 职责：解析用户输入的 `start` 和 `end`，与 viewport 双向同步，合法提交
 * 写回 `useViewport` 全局状态。
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
 */
import { useEffect, useState } from 'react';
import type { JSX } from 'react';

import { useViewport } from '../../store/viewport';
import './nav.css';

/** 匹配允许千位逗号的正整数。 */
const INT_RE = /^\d+(?:,\d+)*$/;

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
  const chr = useViewport((state) => state.chr);
  const start = useViewport((state) => state.start);
  const end = useViewport((state) => state.end);

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
    useViewport.setState({
      start: nextStart,
      end: nextEnd,
    });
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLInputElement>): void => {
    if (event.key === 'Enter') onSubmit();
  };

  return (
    <div className="region-input">
      <span className="region-input__chr" aria-hidden="true">{chr}:</span>
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
    </div>
  );
}