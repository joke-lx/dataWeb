/**
 * 顶部导航栏的基因组区间输入框（`chrN:start-end` 形式）。
 *
 * 职责：解析用户输入的文本、与 viewport 双向同步，并把合法的提交写回
 * `useViewport` 全局状态。
 *
 * 为什么独立组件：让它在 TopNav / RouteShell 任何位置都能复用，并接入
 * 同一个 viewport store；输入格式故意宽松（允许千位逗号）。
 */

import { useEffect, useState } from 'react';
import type { JSX } from 'react';

import { useViewport } from '../../store/viewport';
import './nav.css';

/**
 * 区间输入控件。
 * - 屏幕显示 `chr:start-end` 形式（千位逗号）
 * - 提交：Enter 键 或 "Go" 按钮
 * - 非法输入（格式错、start >= end）静默忽略
 */
export function RegionInput(): JSX.Element {
  const chr = useViewport((state) => state.chr);
  const start = useViewport((state) => state.start);
  const end = useViewport((state) => state.end);
  const [text, setText] = useState(`${chr}:${start}-${end}`);

  // 跟随外部 viewport 变化刷新文本（d3-zoom / RegionInput 自身 都触发）。
  useEffect(() => {
    setText(`${chr}:${Math.round(start)}-${Math.round(end)}`);
  }, [chr, start, end]);

  const onSubmit = (): void => {
    // 允许带千位逗号（如 1,000,000）；end 必须大于 start 才算合法。
    const match = text.match(/^(\S+):(\d+(?:,\d+)*)-(\d+(?:,\d+)*)$/);
    if (!match) return;

    const nextStart = Number.parseInt(match[2].replace(/,/g, ''), 10);
    const nextEnd = Number.parseInt(match[3].replace(/,/g, ''), 10);
    if (nextEnd <= nextStart) return;

    // 一次 setState 写入，避免触发额外的中间渲染。
    useViewport.setState({
      chr: match[1],
      start: nextStart,
      end: nextEnd,
    });
  };

  return (
    <div className="region-input">
      <input
        aria-label="Genomic region"
        type="text"
        value={text}
        onChange={(event) => setText(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter') onSubmit();
        }}
        placeholder="chr1:1,000,000-2,000,000"
      />
      <button type="button" onClick={onSubmit}>
        Go
      </button>
    </div>
  );
}
