/**
 * GenomeBrowserView —— 参考站点详细页风格的 Hi-C 一体化基因组浏览器视图。
 *
 * 职责：把 Hi-C 接触矩阵 + 全部勾选轨道按勾选顺序垂直堆叠成"一张图"
 * （共享同一 viewport 坐标系）：
 *
 *   Hi-C contact map (480px)
 *   TAD boundary      （配套，参考图顺序）
 *   Loops             （CTCF loop 弧线 overlay）
 *   PC1               （第一主成分信号）
 *   Gene model        （基因注释）
 *   AB index / Insulation / RNA-seq / H3K4me3 / H3K27ac …（信号轨道，Plotly lane）
 *
 * 工具栏（HicToolbar）由父级渲染在**本组件外部、图表卡片外的独立一行**，
 * 全部开关状态通过 `hicOptions` 受控下发；本组件只负责矩阵 + 轨道堆叠。
 *
 * 轨道显隐由 `tracks` 驱动（即详情页左侧面板的轨道勾选）：勾选集按传入
 * 顺序（= URL `?types=` 顺序 = 左侧勾选顺序）渲染，Hi-C 热图始终在顶。
 * 空数组 / 未传时只渲染 Hi-C 热图。
 *
 * 锁定区域联动：点击锁定 Hi-C 后，`TrackBinIndicator` 在**每条轨道 lane
 * 内**按 bp 比例高亮选定 bin 列；十字细线只在 Hi-C 热图内（见 CrosshairLayer）。
 */

import { useEffect, useRef, useState } from 'react';
import type { JSX } from 'react';

import type { HicNormalization } from '../../../api/client';
import { CTCFLoops } from '../../overlay/CTCFLoops';
import { formatBp } from '../../../genomics/coords';
import { useCursor } from '../../../store/cursor';
import { usePanelViewport } from '../../../hooks/usePanelViewport';
import { BedGraphLane } from './BedGraphLane';
import { BigwigStacked } from './BigwigStackedLane';
import { GeneLane } from './GeneLane';
import { HiCMatrix } from './HiCMatrix';
import { InsulationLane } from './InsulationLane';
import { Pc1Lane } from './Pc1Lane';
import { PeiLane } from './PeiLane';
import { SvLane } from './SvLane';
import { TadBar } from './TadBar';
import type { TrackId } from './trackSpec';
import { TRACK_CATALOG } from './trackSpec';
import './tracks.css';

/** 参考图 Hi-C 热图高度（px）。 */
const HIC_HEIGHT = 480;
/** 参考图 TAD 边界条高度（px）。 */
const TAD_HEIGHT = 44;
/** 参考图 Loops 弧线 overlay 高度（px）。 */
const LOOPS_HEIGHT = 56;
/** 参考图 PC1 信号高度（px）。 */
const PC1_HEIGHT = 140;
/** 参考图 Gene 注释高度（px）。 */
const GENE_HEIGHT = 120;
/** lane 左标签 gutter 宽度（与 lane.css 的 --label-gutter-width 一致）。 */
const LABEL_GUTTER = 120;
/** Hi-C lane 内 colormap 条的估算宽度（px），用于 SVG 对齐热图内容列。 */
const COLORMAP_BAR = 32;

/** 完整受控的 Hi-C 视觉选项（工具栏状态由父级持有并下发）。 */
export interface HicViewOptions {
  colorMap?: 'rdbu' | 'viridis' | 'ref' | 'reds';
  onColorMapChange?: (colorMap: 'rdbu' | 'viridis' | 'ref' | 'reds') => void;
  hideColorBar?: boolean;
  /** Triangle Mode：只显示上三角。 */
  triangle?: boolean;
  /** 色阶模式：auto=API vmin/vmax，full=固定 [0, 矩阵最大值]。 */
  colorMode?: 'auto' | 'full';
  /** 数据归一化。 */
  normalization?: HicNormalization;
  /** 锁定分辨率（缩放不自动变粗 bin）。 */
  lockResolution?: boolean;
  /** 手动色阶上界缩放（1.0=全上界）。 */
  vmaxScale?: number;
}

interface GenomeBrowserViewProps {
  sampleId: string;
  /** 勾选轨道 id 集合（按传入顺序 = 堆叠顺序）。缺省/空数组 → 只渲染 Hi-C 热图。 */
  tracks?: readonly TrackId[];
  /** 各轨道标题（默认英文，可由 i18n 覆盖）。 */
  labels?: {
    tad?: string;
    loops?: string;
    pc1?: string;
    gene?: string;
  };
  /** Compare 面板：显示顶部坐标标尺。 */
  showRuler?: boolean;
  /** Hi-C 视觉选项（工具栏状态由父级持有并受控下发）。 */
  hicOptions?: HicViewOptions;
}

/**
 * 轨道内锁定区域指示：点击锁定后，在**本条轨道 lane 的内容列**内按 bp
 * 比例高亮选定 bin（与 Hi-C 热图方块同基准：hicLeft/hicWidth 由父组件
 * 实测 .hic-matrix canvas 位置传入，保证与 Hi-C 高亮带像素级对齐）。
 */
function TrackBinIndicator({
  contentWidth,
  hicLeft,
  hicWidth,
}: {
  contentWidth: number;
  hicLeft: number;
  hicWidth: number;
}): JSX.Element | null {
  const locked = useCursor((state) => state.locked);
  const binStart = useCursor((state) => state.binStart);
  const binEnd = useCursor((state) => state.binEnd);
  const viewport = usePanelViewport();

  if (!locked || binStart === null || binEnd === null) return null;
  const viewportWidth = viewport.end - viewport.start;
  if (viewportWidth <= 0) return null;
  // 基准列：优先 Hi-C 热图方块（实测），未就绪时回退 gutter + 全宽
  const base = hicWidth > 0 ? hicLeft : LABEL_GUTTER;
  const width = hicWidth > 0 ? hicWidth : contentWidth;
  if (width <= 0) return null;

  const x0 = base + ((binStart - viewport.start) / viewportWidth) * width;
  const x1 = base + ((binEnd - viewport.start) / viewportWidth) * width;
  return (
    <div
      className="gbv-track-bin-indicator"
      style={{ left: `${x0}px`, width: `${Math.max(1, x1 - x0)}` }}
    />
  );
}

/**
 * 参考站点详细页式的一体化 Hi-C 视图。
 *
 * @param sampleId 当前样本 id（同时驱动 Hi-C 与全部轨道 lane）
 * @param tracks 勾选的轨道 id 列表（有序 = 堆叠顺序）；Hi-C 热图始终显示
 * @param labels 轨道标题覆盖（缺省英文：TAD boundary / Loops / PC1 / Gene model）
 * @param hicOptions 受控视觉选项（工具栏在父级）
 */
export function GenomeBrowserView({
  sampleId,
  tracks,
  labels,
  showRuler = false,
  hicOptions,
}: GenomeBrowserViewProps): JSX.Element {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewport = usePanelViewport();
  // SVG overlay 宽度：容器宽 - 左 gutter - colormap 条；下限 280 防极窄窗口。
  const [plotWidth, setPlotWidth] = useState<number>(800);
  // 轨道内容列宽（容器宽 - 左 gutter）：供 TrackBinIndicator 按 bp 比例定位。
  const [trackContentWidth, setTrackContentWidth] = useState<number>(0);
  // Hi-C 热图方块（canvas）相对容器的位置：TrackBinIndicator 与 Hi-C 高亮带
  // 共用此基准，实现"锁定区域上下对齐"。
  const [hicCanvasBox, setHicCanvasBox] = useState<{
    left: number;
    width: number;
  }>({ left: LABEL_GUTTER, width: 0 });

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const measure = () => {
      setPlotWidth(Math.max(280, el.clientWidth - LABEL_GUTTER - COLORMAP_BAR));
      setTrackContentWidth(Math.max(0, el.clientWidth - LABEL_GUTTER));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);

    // 实测 Hi-C 热图方块位置（canvas 在容器内居中，render 后才定尺寸；
    // 用 RAF 轮询等 canvas 出现，再观察 canvas 尺寸变化）。
    let rafId = 0;
    const measureHic = () => {
      const canvas = el.querySelector<HTMLCanvasElement>('.hic-matrix canvas');
      if (!canvas) {
        rafId = requestAnimationFrame(measureHic);
        return;
      }
      const containerRect = el.getBoundingClientRect();
      const cr = canvas.getBoundingClientRect();
      setHicCanvasBox({
        left: cr.left - containerRect.left,
        width: Math.max(1, cr.width),
      });
      hicRo.observe(canvas);
    };
    const hicRo = new ResizeObserver(measureHic);
    rafId = requestAnimationFrame(measureHic);
    return () => {
      cancelAnimationFrame(rafId);
      hicRo.disconnect();
      ro.disconnect();
    };
  }, []);

  // ── 轨道悬浮说明（imperative DOM 更新，零 React 重渲染）────────
  const stackRef = useRef<HTMLDivElement>(null);
  const tipRef = useRef<HTMLDivElement>(null);
  const tipTitleRef = useRef<HTMLDivElement>(null);
  const tipRegionRef = useRef<HTMLDivElement>(null);
  const tipRowRef = useRef<HTMLDivElement>(null);
  /** 当前 tip 内容指纹（title|binIndex），同内容不重复写 DOM。 */
  const tipKeyRef = useRef('');

  const onTrackMove = (event: React.MouseEvent, title: string) => {
    const tip = tipRef.current;
    const stackEl = stackRef.current;
    if (!tip) return;
    const el = event.currentTarget as HTMLElement;
    const rect = el.getBoundingClientRect();
    const stackRect = stackEl?.getBoundingClientRect();
    const localX = event.clientX - rect.left;
    // 内容列从左标签 gutter（120px）开始，按 bp 比例映射
    const contentX = localX - LABEL_GUTTER;
    const vw = viewport.end - viewport.start;
    if (contentX < 0 || trackContentWidth <= 0 || vw <= 0 || viewport.bin <= 0) {
      tip.style.opacity = '0';
      tip.style.visibility = 'hidden';
      return;
    }
    const ratio = Math.min(1, Math.max(0, contentX / trackContentWidth));
    const binIndex = Math.floor((ratio * vw) / viewport.bin);
    const binStart = viewport.start + binIndex * viewport.bin;
    // 位置：跟随鼠标，直写 transform（合成器层，不重排/重绘）
    const x = event.clientX - (stackRect?.left ?? rect.left) + 12;
    const y = event.clientY - (stackRect?.top ?? rect.top) + 12;
    tip.style.transform = 'translate(' + x + 'px, ' + y + 'px)';
    // 内容：仅 title / binIndex 变化时更新
    const key = title + '|' + binIndex;
    if (key !== tipKeyRef.current) {
      tipKeyRef.current = key;
      if (tipTitleRef.current) tipTitleRef.current.textContent = title;
      if (tipRegionRef.current) {
        tipRegionRef.current.textContent =
          viewport.chr + ':' + formatBp(binStart) + '–' + formatBp(binStart + viewport.bin);
      }
      if (tipRowRef.current) tipRowRef.current.textContent = 'bin #' + binIndex;
    }
    tip.style.visibility = 'visible';
    tip.style.opacity = '1';
  };
  const onTrackLeave = () => {
    const tip = tipRef.current;
    if (tip) {
      tip.style.opacity = '0';
      tip.style.visibility = 'hidden';
    }
  };

  const tadTitle = labels?.tad ?? 'TAD boundary';
  const loopsTitle = labels?.loops ?? 'Loops';
  const pc1Title = labels?.pc1 ?? 'PC1';
  const geneTitle = labels?.gene ?? 'Gene model';

  // 工具栏受控值（带默认）
  const triangle = hicOptions?.triangle ?? false;
  const colorMode = hicOptions?.colorMode ?? 'auto';
  const normalization = hicOptions?.normalization ?? 'log2';
  const lockResolution = hicOptions?.lockResolution ?? false;
  const vmaxScale = hicOptions?.vmaxScale ?? 1;

  // 是否渲染某条轨道：tracks 未传视为全部（旧行为）；否则以集合为准。
  const enabled = tracks ?? ([] as TrackId[]);

  /**
   * 按 TRACK_CATALOG.kind 把一条轨道分派到对应 lane 组件。
   * 配套轨道用参考图紧凑高度；信号轨道（Plotly lane）用目录默认高度。
   */
  const renderTrack = (id: TrackId): JSX.Element | null => {
    const spec = TRACK_CATALOG[id];
    switch (spec.kind) {
      case 'tadBar':
        return <TadBar sampleId={sampleId} height={TAD_HEIGHT} title={tadTitle} />;
      case 'hic':
        // loop：Hi-C + CTCF loop 弧线 overlay（参考图 Loops lane）。
        if (id === 'loop') {
          return (
            <div
              className="gbv-lane gbv-lane--loops"
              style={{
                height: `${LOOPS_HEIGHT}px`,
                display: 'flex',
                alignItems: 'stretch',
              }}
            >
              <div
                className="gbv-lane__label"
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'flex-end',
                  justifyContent: 'center',
                  gap: 2,
                  padding: 'var(--space-2)',
                  overflow: 'hidden',
                  textAlign: 'right',
                  fontSize: 'var(--font-size-small)',
                  width: LABEL_GUTTER,
                  flex: '0 0 auto',
                  borderRight: 'var(--track-separator) solid var(--color-border)',
                  background: 'var(--color-surface-1)',
                }}
              >
                <span className="lane-sample">{sampleId}</span>
              </div>
              <div className="gbv-lane__content" style={{ position: 'relative' }}>
                <span
                  style={{
                    position: 'absolute',
                    top: 2,
                    left: '50%',
                    transform: 'translateX(-50%)',
                    fontSize: 'var(--font-size-small)',
                    color: 'var(--color-text-secondary)',
                    pointerEvents: 'none',
                    zIndex: 1,
                    fontWeight: 500,
                  }}
                >
                  {loopsTitle}
                </span>
                <CTCFLoops sampleId={sampleId} height={LOOPS_HEIGHT} width={plotWidth} />
              </div>
            </div>
          );
        }
        return null;
      case 'pc1':
        return <Pc1Lane sampleId={sampleId} title={pc1Title} height={PC1_HEIGHT} />;
      case 'gene':
        return <GeneLane sampleId={sampleId} height={GENE_HEIGHT} title={geneTitle} />;
      case 'bedGraph':
        return (
          <BedGraphLane
            sampleId={sampleId}
            trackName={spec.trackName ?? id}
            title={spec.title}
            height={spec.defaultHeight}
          />
        );
      case 'is':
        return (
          <InsulationLane
            sampleId={sampleId}
            trackName={spec.trackName ?? id}
            title={spec.title}
            height={spec.defaultHeight}
          />
        );
      case 'bigwig':
        // 单样本渲染：bigwig / Hi-C 派生 activity 代理都由 BigwigStacked 处理。
        return (
          <BigwigStacked
            sampleIds={[sampleId]}
            trackName={spec.trackName ?? 'rna_seq'}
            title={spec.title}
            groupLabel={spec.title}
            height={spec.defaultHeight}
          />
        );
      case 'pei':
        return (
          <PeiLane
            sampleId={sampleId}
            trackName={spec.trackName ?? id}
            title={spec.title}
            height={spec.defaultHeight}
          />
        );
      case 'sv':
        return <SvLane sampleId={sampleId} title={spec.title} height={spec.defaultHeight} />;
      default:
        return null;
    }
  };

  return (
    <div className="genome-browser-view" ref={containerRef}>
      {showRuler && (
        <div className="gbv-ruler">
          <span className="gbv-ruler__label">{sampleId}</span>
          <span className="gbv-ruler__tick">{formatBp(viewport.start)}</span>
          <span className="gbv-ruler__tick">{formatBp((viewport.start + viewport.end) / 2)}</span>
          <span className="gbv-ruler__tick">{formatBp(viewport.end)}</span>
        </div>
      )}
      <HiCMatrix
        sampleId={sampleId}
        height={HIC_HEIGHT}
        colorMap={hicOptions?.colorMap}
        onColorMapChange={hicOptions?.onColorMapChange}
        hideColorBar={hicOptions?.hideColorBar}
        triangle={triangle}
        colorMode={colorMode}
        normalization={normalization}
        lockResolution={lockResolution}
        vmaxScale={vmaxScale}
      />
      {/* 轨道堆叠区：全部勾选轨道按顺序排列（data-section 供左侧锚点滚动/显隐）。 */}
      {enabled.length > 0 && (
        <div className="gbv-tracks-stack" data-section="tracks" ref={stackRef}>
          {enabled.map((id) => (
            <div
              key={id}
              className="gbv-track-item"
              onMouseMove={(event) =>
                onTrackMove(event, id === 'loop' ? loopsTitle : (TRACK_CATALOG[id]?.title ?? id))
              }
              onMouseLeave={onTrackLeave}
            >
              {renderTrack(id)}
              {/* 锁定区域在每条轨道内的 bin 高亮列（轨道自身联动，不跨画布） */}
              <TrackBinIndicator
                contentWidth={trackContentWidth}
                hicLeft={hicCanvasBox.left}
                hicWidth={hicCanvasBox.width}
              />
            </div>
          ))}
          {/* 悬浮说明：常驻 DOM，位置/内容由 ref 直接驱动。 */}
          <div ref={tipRef} className="gbv-track-tip" aria-hidden="true">
            <div className="gbv-track-tip__title" ref={tipTitleRef} />
            <div className="gbv-track-tip__region" ref={tipRegionRef} />
            <div className="gbv-track-tip__row" ref={tipRowRef} />
          </div>
        </div>
      )}
    </div>
  );
}

export default GenomeBrowserView;
