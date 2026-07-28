/**
 * Log2Heatmap — 差异 Hi-C 的 log2(HiC_A / HiC_B) 热图组件。
 *
 * 架构位置：
 * - models/differential/ 私有组件：负责拉数 + 状态机，不直接画热图
 * - 真正的 WebGL 渲染委托给 `render-kit/hic/HiCMatrix2D`（不知道是 differential）
 * - colormap 委托给 `render-kit/hic/ColormapBar`
 *
 * 职责：
 * - 监听 viewport/sampleA/sampleB 任一变化时重新拉取差分矩阵
 * - 用 AbortController 取消过期请求，避免"区间快速拖动"导致旧请求覆盖新结果
 * - 维护 loading/error 状态并透传给 HiCMatrix2D（render-kit 会据此显示 placeholder）
 *
 * 注意：
 * - 这里没用 react-query 而是 useEffect + useState：因为差异矩阵请求参数组合较多，
 *   且我们不希望进入 react-query 的全局缓存——单次 viewer 生命周期内即可
 * - vmin/vmax 默认 ±1 是 symmetric log2 约定；后端如果返回更小范围会自动收紧
 */
import { useEffect, useRef, useState } from 'react';
import type { JSX } from 'react';

import {
  fetchDifferentialHic,
  type HicMatrixResponse,
} from '../../../api/client';
import { useD3Zoom } from '../../../hooks/useD3Zoom';
import { useViewport } from '../../../store/viewport';
import { ColormapBar } from '../../render-kit/hic/ColormapBar';
import { HiCMatrix2D } from '../../render-kit/hic/HiCMatrix2D';
import './differential.css';

// 与 hic viewer 的主热图保持相近高度，避免 differential 视觉上突兀
const LOG2_HEATMAP_HEIGHT = 420;

interface Log2HeatmapProps {
  /** 对照组样本 A（通常 = active sample） */
  sampleA: string;
  /** 对照组样本 B */
  sampleB: string;
}

/**
 * Differential Hi-C log2 heatmap — 顶部水平 colormap bar + 下方 WebGL 热图。
 * 颜色采用白中心发散（rdbu），正值偏红、负值偏蓝、零附近接近白色。
 */
export function Log2Heatmap({ sampleA, sampleB }: Log2HeatmapProps): JSX.Element {
  const zoomRef = useRef<HTMLDivElement>(null);
  useD3Zoom(zoomRef);
  const viewport = useViewport();
  const [matrix, setMatrix] = useState<HicMatrixResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  // 任意一个依赖变化都重新拉；clean-up 时 abort 掉上一次未完成的请求
  useEffect(() => {
    const ctrl = new AbortController();
    setLoading(true);
    setError(null);
    fetchDifferentialHic(
      sampleA,
      sampleB,
      viewport.chr,
      viewport.start,
      viewport.end,
      viewport.bin,
    )
      .then((res) => {
        // 关键：即便 promise resolve 了，也要确认这次请求没被 abort，
        // 否则会用旧数据覆盖新一次 effect 产生的更新
        if (!ctrl.signal.aborted) setMatrix(res);
      })
      .catch((e: Error) => {
        if (!ctrl.signal.aborted) setError(e);
      })
      .finally(() => {
        if (!ctrl.signal.aborted) setLoading(false);
      });
    return () => ctrl.abort();
  }, [sampleA, sampleB, viewport.chr, viewport.start, viewport.end, viewport.bin]);

  return (
    <div className="diff-heatmap-wrapper">
      {/* vmin/vmax 在数据未就绪时给对称 ±1，避免 colormap bar 在 loading 阶段闪烁 */}
      <ColormapBar
        vmin={matrix?.vmin ?? -1}
        vmax={matrix?.vmax ?? 1}
        mode="differential"
        colorMap="rdbu"
        horizontal
      />
      <div className="diff-heatmap-container" ref={zoomRef}>
        <HiCMatrix2D
          sampleA={sampleA}
          sampleB={sampleB}
          variant="differential"
          data={matrix ?? undefined}
          loading={loading}
          error={error}
          bin={viewport.bin}
          height={LOG2_HEATMAP_HEIGHT}
        />
      </div>
    </div>
  );
}