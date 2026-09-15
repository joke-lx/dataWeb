/**
 * HicToolbar —— Hi-C 接触图的「快速调整工具栏」（对应参考 3D Genome Browser 2.0）。
 *
 * 独立成行、渲染在图表**外部**（不压在 Hi-C 矩阵上）。全部开关受控：
 * 视觉状态由父级持有并通过 props 传入；本组件只渲染 + 派发变更。
 *
 * 布局（对齐设计稿 quick adjust bar）：
 *   [色阶滑杆 + 数值] [色图 Reds▾] | [⊕ ⊖ ⟲] | [🔒 Auto] | [Triangle Mode 开关]
 *   | [Norm▾] | [PNG SVG ⛶] …… [Export PDF]
 *
 * 图标一律内联单色 SVG（stroke/fill=currentColor），不依赖原生 emoji。
 *
 * 导出 PNG/SVG：父级传入 `getCanvas()` 返回当前 Hi-C WebGL canvas，本组件
 * 用 toDataURL 同步导出（WebGL preserveDrawingBuffer=true，可靠）。
 */
import type { JSX, ReactNode } from 'react';

import type { HicNormalization } from '../../api/client';
import type { ColormapName } from '../render-kit/hic/ColormapBar';
import { usePanelViewportStore } from '../../hooks/usePanelViewport';
import './hic-toolbar.css';

/** 单次缩放步长（zoom in 放大 1.5×，zoom out 缩小到 1/1.5）。 */
const ZOOM_STEP = 1.5;

/** 把 canvas 同步导出为 PNG 并下载。 */
function downloadCanvasPng(canvas: HTMLCanvasElement, filename: string): void {
  const url = canvas.toDataURL('image/png');
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

/** 把 canvas 光栅内容内嵌进一个独立 .svg 文件下载。 */
function downloadCanvasSvg(canvas: HTMLCanvasElement, filename: string): void {
  const dataUrl = canvas.toDataURL('image/png');
  const w = canvas.width;
  const h = canvas.height;
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">` +
    `<image href="${dataUrl}" width="${w}" height="${h}"/>` +
    `</svg>`;
  const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

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
  /** 色图（Reds/ref/Rdbu_r/viridis）。 */
  colorMap: ColormapName;
  onColorMapChange: (cm: ColormapName) => void;
  /** 取当前 Hi-C canvas（用于 PNG/SVG 导出）。 */
  getCanvas: () => HTMLCanvasElement | null;
  /** 导出文件名前缀（如样本 id）。 */
  filenamePrefix: string;
  /** 进入全屏。 */
  onFullscreen: () => void;
  /** 手动色阶上界缩放（1.0=Auto 全上界，0.1=压到 10%）。 */
  vmaxScale: number;
  onVmaxScaleChange: (value: number) => void;
  /** 行尾右侧附加内容（如 Export PDF 按钮）。 */
  actions?: ReactNode;
}

/** 单个图标按钮。 */
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

/* ── 内联单色 SVG 图标（16×16，currentColor）────────────────────────── */

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

function ZoomInIcon(): JSX.Element {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <circle cx="7" cy="7" r="4.5" stroke="currentColor" strokeWidth="1.4" />
      <path d="M10.5 10.5 L13.5 13.5 M7 5v4 M5 7h4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

function ZoomOutIcon(): JSX.Element {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <circle cx="7" cy="7" r="4.5" stroke="currentColor" strokeWidth="1.4" />
      <path d="M10.5 10.5 L13.5 13.5 M5 7h4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

function ResetIcon(): JSX.Element {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path
        d="M2.5 8a5.5 5.5 0 1 1 1.6 3.9 M2.5 8V4.5 M2.5 8H6"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
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

/**
 * 快速调整工具栏（独立一行）。缩放按钮直接操作当前面板 viewport；其余受控。
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
  colorMap,
  onColorMapChange,
  getCanvas,
  filenamePrefix,
  onFullscreen,
  vmaxScale,
  onVmaxScaleChange,
  actions,
}: HicToolbarProps): JSX.Element {
  const viewportStore = usePanelViewportStore();

  const exportPng = () => {
    const canvas = getCanvas();
    if (canvas) downloadCanvasPng(canvas, `${filenamePrefix}_hic.png`);
  };
  const exportSvg = () => {
    const canvas = getCanvas();
    if (canvas) downloadCanvasSvg(canvas, `${filenamePrefix}_hic.svg`);
  };

  return (
    <div className="hic-toolbar" role="toolbar" aria-label="Hi-C quick adjust">
      {/* 色阶滑杆 + 数值（最左，对齐设计稿 b） */}
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
      {/* 色图下拉 */}
      <label className="hic-toolbar__select-wrap">
        <select
          aria-label="Contact map color scheme"
          className="hic-toolbar__select"
          value={colorMap}
          onChange={(event) => onColorMapChange(event.target.value as ColormapName)}
        >
          <option value="reds">Reds</option>
          <option value="ref">Ref</option>
          <option value="rdbu">RdBu_r</option>
          <option value="viridis">Viridis</option>
        </select>
      </label>

      <span className="hic-toolbar__sep" aria-hidden="true" />

      {/* 缩放 */}
      <ToolButton title="Zoom in" onClick={() => viewportStore.getState().zoom(ZOOM_STEP)}>
        <ZoomInIcon />
      </ToolButton>
      <ToolButton title="Zoom out" onClick={() => viewportStore.getState().zoom(1 / ZOOM_STEP)}>
        <ZoomOutIcon />
      </ToolButton>
      <ToolButton title="Reset view" onClick={() => viewportStore.getState().reset()}>
        <ResetIcon />
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

      {/* Triangle Mode 文字开关（对齐设计稿 m） */}
      <label className="hic-toolbar__switch-wrap" title="Triangle Mode">
        <span className="hic-toolbar__switch-label">Triangle Mode</span>
        <button
          type="button"
          role="switch"
          aria-checked={triangle}
          className={'hic-toolbar__switch' + (triangle ? ' is-on' : '')}
          onClick={() => onTriangleChange(!triangle)}
        >
          <span className="hic-toolbar__switch-knob" />
        </button>
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
      <ToolButton title="Export plot as PNG" onClick={exportPng}>
        PNG
      </ToolButton>
      <ToolButton title="Export plot as SVG" onClick={exportSvg}>
        SVG
      </ToolButton>
      <ToolButton title="Fullscreen view" onClick={onFullscreen}>
        <FullscreenIcon />
      </ToolButton>
      <ToolButton title="Hi-C settings" onClick={() => {}}>
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <circle cx="8" cy="8" r="2.2" stroke="currentColor" strokeWidth="1.3"/>
          <path d="M8 1.8v2M8 12.2v2M1.8 8h2M12.2 8h2M3.6 3.6l1.4 1.4M11 11l1.4 1.4M12.4 3.6L11 5M5 11l-1.4 1.4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
        </svg>
      </ToolButton>

      {/* 行尾右侧插槽（Export PDF 等） */}
      {actions && <div className="hic-toolbar__actions">{actions}</div>}
    </div>
  );
}

export default HicToolbar;
