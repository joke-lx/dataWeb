/**
 * 顶部导航栏的 Hi-C bin 选择器（粗细档位）。
 *
 * 职责：把 `BIN_STEPS` 渲染为 `<select>`，change 时调用 `setBin` 写回当前
 * 视口（面板级或全局）。
 * 显示文本是把 bp 换算成 "X kb"（千位本地化）。
 *
 * 为什么是 select 而不是连续 slider：bin 必须是后端 / Hi-C 矩阵支持的离散档位，
 * 连续值会触发大量数据重算；用 select 也避免埋"无效档"问题。
 */

import type { ChangeEvent, JSX } from 'react';

import { usePanelViewport, usePanelViewportStore } from '../../hooks/usePanelViewport';
import { BIN_STEPS } from '../../store/viewport';
import './nav.css';

/**
 * Bin 选择器：直接同步当前视口（面板/全局）的 `bin`。
 * 不在组件内维护任何 props，bin 是真相。
 */
export function ZoomSlider(): JSX.Element {
  const bin = usePanelViewport((state) => state.bin);

  const onChange = (event: ChangeEvent<HTMLSelectElement>): void => {
    usePanelViewportStore().getState().setBin(Number.parseInt(event.target.value, 10));
  };

  return (
    <select
      aria-label="Hi-C bin size"
      className="zoom-slider"
      value={bin}
      onChange={onChange}
    >
      {BIN_STEPS.map((step) => (
        <option key={step} value={step}>
          {/* toLocaleString 处理 en/zh 区域下千位分隔符差异。 */}
          {(step / 1000).toLocaleString()} kb
        </option>
      ))}
    </select>
  );
}
