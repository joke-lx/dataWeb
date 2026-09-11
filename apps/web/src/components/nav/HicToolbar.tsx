/**
 * HicToolbar —— Hi-C 接触图的「快速调整工具栏」（对应参考 3D Genome Browser 2.0）。
 *
 * 一行图标按钮，全部为受控组件：视觉开关由父级持有状态并通过 props 传入，
 * 本组件只负责渲染 + 派发变更。缩放类操作（zoom in / out / reset）直接命令式
 * 调用当前面板的 viewport store（同步关时为面板独立 store，同步开/普通页回退全局）。
 *
 * 图标一律使用内联单色 SVG（stroke=currentColor），不依赖原生 emoji / 系统字体
 * 字形——跨平台渲染一致，且按钮激活态（蓝底白字）下图标自动反色。
 */
import type { JSX, ReactNode } from 'react';

import type { HicNormalization } from '../../api/client';
import { usePanelViewportStore } from '../../hooks/usePanelViewport';
import './hic-toolbar.css';

/** 单次缩放步长（zoom in 放大 1.5×，zoom out 缩小到 1/1.5）。 */
const ZOOM_STEP = 1.5;

interface HicToolbarProps {
  /** Triangle Mode：只显示上三角。 */
  triangle: boolean;
  onTriangleChange: (value: boolean) => void;
  /** 色阶 Auto：true=API vmin/vmax；false=固定 [0, 矩阵最大值]。 */
  autoColor: boolean;
  onAutoColorChange: (value: boolean) => void;
  /** 锁定分辨率：true=固定用户选的 bin，缩放不自动变粗。 */
  lockResolution: boolean;
  onLockResolutionChange: (value: boolean) => void;
  /** 数据归一化方式。 */
  normalization: HicNormalization;
  onNormalizationChange: (value: HicNormalization) => void;
  /** 导出当前矩阵为 PNG。 */
  onExportPng: () => void;
  /** 导出当前矩阵为 SVG。 */
  onExportSvg: () => void;
  /** 进入全屏（Hi-C 视图容器）。 */
  onFullscreen: () => void;
  /** 手动色阶上界缩放（1.0=Auto 全上界，0.1=压到 10%）。 */
  vmaxScale: number;
  onVmaxScaleChange: (value: number) => void;
  /** 行尾右侧附加内容（如 Export PDF 按钮），自动靠右对齐。 */
  actions?: ReactNode;
}

/* ── 内联单色 SVG 图标（16×16，stroke/fill = currentColor）────────────── */

function LockIcon(): JSX.Element {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <rect x="3.5" y="7" width="9" height="6.5" rx="1" fill="currentColor" />
      <path
        d="M5.5 7V5a2.5 2.5 0 0 1 5 0v2"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
    </svg>
  );
}

function TriangleIcon(): JSX.Element {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden="true">
      <path d="M8 3 L13.5 12 H2.5 Z" fill="currentColor" />
    </svg>
  );
}

function FullscreenIcon(): JSX.Element {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path
        d="M2.5 5V2.5H5M11 2.5H13.5V5M13.5 11V13.5H11M5 13.5H2.5V11"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** 单个图标按钮的统一 props。 */
interface ToolButtonProps {
  title: string;
  onClick: () => void;
  active?: boolean;
  children: ReactNode;
}

function ToolButton({ title, onClick, active, children }: ToolButtonProps): JSX.Element {
  return (
    <button
      type="button"
      className={'hic-toolbar__btn' + (active ? ' is-active' : '')}
      title={title}
      aria-label={title}
      aria-pressed={active}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

/**
 * 快速调整工具栏。缩放按钮直接操作当前面板 viewport；其余开关受控。
 */
export function HicToolbar({
  triangle,
  onTriangleChange,
  autoColor,
  onAutoColorChange,
  lockResolution,
  onLockResolutionChange,
  normalization,
  onNormalizationChange,
  onExportPng,
  onExportSvg,
  onFullscreen,
  vmaxScale,
  onVmaxScaleChange,
  actions,
}: HicToolbarProps): JSX.Element {
  const viewportStore = usePanelViewportStore();

  return (
    <div className="hic-toolbar" role="toolbar" aria-label="Hi-C quick adjust">
      {/* 缩放 */}
      <ToolButton title="Zoom in" onClick={() => viewportStore.getState().zoom(ZOOM_STEP)}>
        +
      </ToolButton>
      <ToolButton title="Zoom out" onClick={() => viewportStore.getState().zoom(1 / ZOOM_STEP)}>
        −
      </ToolButton>
      <ToolButton title="Reset view" onClick={() => viewportStore.getState().reset()}>
        ⟲
      </ToolButton>

      <span className="hic-toolbar__sep" aria-hidden="true" />

      {/* 分辨率 / 色阶开关 */}
      <ToolButton
        title={
          lockResolution
            ? 'Resolution locked: zooming out keeps the current bin (no auto coarsening). Click to unlock.'
            : 'Lock resolution: fix the current bin so zooming out never switches to a coarser bin. Off = auto coarsens wide views.'
        }
        active={lockResolution}
        onClick={() => onLockResolutionChange(!lockResolution)}
      >
        <LockIcon />
      </ToolButton>
      <ToolButton
        title={autoColor ? 'Auto color range on' : 'Auto color range off (full scale)'}
        active={autoColor}
        onClick={() => onAutoColorChange(!autoColor)}
      >
        Auto
      </ToolButton>
      <ToolButton
        title={triangle ? 'Triangle mode on' : 'Triangle mode off'}
        active={triangle}
        onClick={() => onTriangleChange(!triangle)}
      >
        <TriangleIcon />
      </ToolButton>

      <span className="hic-toolbar__sep" aria-hidden="true" />

      {/* 手动色阶上界滑杆（对应参考图 b 的 1044.0 滑杆） */}
      <label className="hic-toolbar__slider-wrap" title="Color scale upper bound">
        <input
          type="range"
          min={0.1}
          max={1}
          step={0.05}
          value={vmaxScale}
          onChange={(event) => onVmaxScaleChange(Number.parseFloat(event.target.value))}
        />
        <span className="hic-toolbar__slider-value">
          {Math.round(vmaxScale * 100)}%
        </span>
      </label>

      <span className="hic-toolbar__sep" aria-hidden="true" />

      {/* 归一化 */}
      <label className="hic-toolbar__select-wrap">
        <span className="hic-toolbar__select-label">Norm</span>
        <select
          aria-label="Data normalization"
          className="hic-toolbar__select"
          value={normalization}
          onChange={(event) =>
            onNormalizationChange(event.target.value as HicNormalization)
          }
        >
          <option value="log2">Log2</option>
          <option value="raw">Raw</option>
          <option value="ice">ICE</option>
        </select>
      </label>

      <span className="hic-toolbar__sep" aria-hidden="true" />

      {/* 导出 + 全屏 */}
      <ToolButton title="Export plot as PNG" onClick={onExportPng}>
        PNG
      </ToolButton>
      <ToolButton title="Export plot as SVG" onClick={onExportSvg}>
        SVG
      </ToolButton>
      <ToolButton title="Fullscreen view" onClick={onFullscreen}>
        <FullscreenIcon />
      </ToolButton>

      {/* 行尾右侧插槽（Export PDF 等），margin-left:auto 顶到最右 */}
      {actions && <div className="hic-toolbar__actions">{actions}</div>}
    </div>
  );
}

export default HicToolbar;
