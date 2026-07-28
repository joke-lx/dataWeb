/**
 * CTCFLoops — Hi-C lane 上方的 CTCF loop 弧线 overlay。
 *
 * 架构位置：
 * - components/overlay/：跨 viewer 的覆盖层组件
 * - 通常与 HiCMatrix 同位置叠加：在 Hi-C 矩阵上方画 loop 弧 + anchor 端点
 *
 * 职责：
 * - 拉取当前 viewport 内的 CTCF loop 记录（两端 anchor + score）
 * - 用二次贝塞尔曲线在两个 anchor 之间画一条弧
 * - 根据 score 调透明度（0.4~1.0），越强越显眼
 *
 * 关键算法：
 * - `Q ${midX} ${4} ${x2} ${yMax}`：SVG 二次贝塞尔，控制点 (midX, 4) 在顶部 → 弧线从 x1 向上拱起再回到 x2
 * - viewport 范围过滤：x1/x2 越界（<0 或 >width）直接 return null，避免画看不见的弧
 *
 * 注意：
 * - 不在 render-kit：业务数据来自 CTCF 特定端点，不是通用曲线组件
 * - 这里用 fetch + AbortController 而非 react-query：单个 viewer 局部使用，无需全局缓存
 */
import { useEffect, useState } from 'react';

import { bpToPx } from '../../genomics/coords';
import { useViewport } from '../../store/viewport';
import './overlay.css';

interface LoopRecord {
  chrom1: string;
  start1: number;
  end1: number;
  chrom2: string;
  start2: number;
  end2: number;
  /** loop 强度，0~1；用于调透明度 */
  score: number;
}

interface CTCFLoopsProps {
  /** 取哪个 sample 的 loop 数据 */
  sampleId: string;
  /** overlay 高度（像素），用于限制弧的纵向范围 */
  height?: number;
  /** overlay 宽度（像素），与 HiCMatrix 同步——保证 anchor x 坐标精确对齐矩阵 bin */
  width: number;
}

/**
 * CTCF loop 弧覆盖层。
 * 与 HiCMatrix 共享同一 viewport → 弧端点与矩阵的 bin 中心天然对齐。
 */
export function CTCFLoops({
  sampleId,
  height = 60,
  width,
}: CTCFLoopsProps): JSX.Element {
  const viewport = useViewport();
  const [records, setRecords] = useState<LoopRecord[]>([]);

  // 监听 sample/viewport 变化重新拉 loop；abort 防止过期响应覆盖新数据
  useEffect(() => {
    const ctrl = new AbortController();
    fetch(
      `/api/ctcf/loops?sample=${sampleId}&chr=${viewport.chr}&start=${viewport.start}&end=${viewport.end}`,
      { signal: ctrl.signal },
    )
      .then((r) => (r.ok ? r.json() : Promise.reject(r.statusText)))
      .then((j: { records?: LoopRecord[] }) =>
        setRecords(j.records ?? []),
      )
      .catch((e: Error) => {
        // AbortError 是正常取消路径，不污染 console
        if (e.name !== 'AbortError') console.error('ctcf loops', e);
      });
    return () => ctrl.abort();
  }, [sampleId, viewport.chr, viewport.start, viewport.end]);

  // 从 CSS 变量读 loop 弧颜色——让主题切换（light/dark）时弧线颜色也跟着变
  // 兜底 #b8b8b8 用于变量未定义的极端情况（SSR / CSS 未加载完成）
  const arcColor =
    getComputedStyle(document.documentElement)
      .getPropertyValue('--color-loop-arc')
      .trim() || '#b8b8b8';

  return (
    <svg
      className="ctcf-loops-overlay"
      width={width}
      height={height}
      style={{ background: 'var(--color-surface-1)' }}
    >
      {records.map((rec, i) => {
        // 跨染色体的 loop 当前不支持——直接跳过
        if (rec.chrom1 !== viewport.chr) return null;
        const x1 = bpToPx(rec.start1, viewport, width);
        const x2 = bpToPx(rec.start2, viewport, width);
        // viewport 外的弧跳过——既不可见也会拖累后续重排
        if (x1 < 0 || x2 > width || x1 > width || x2 < 0) return null;
        const yMax = height - 4;
        const midX = (x1 + x2) / 2;
        // 二次贝塞尔：起点(x1,yMax) → 控制点(midX, 4) → 终点(x2,yMax)
        // 控制点靠近顶部 → 形成对称"拱形"，符合 loop 视觉约定
        const path = `M ${x1} ${yMax} Q ${midX} ${4} ${x2} ${yMax}`;
        return (
          <g key={i}>
            <path
              d={path}
              stroke={arcColor}
              strokeWidth={1.5}
              fill="none"
              // score 越高透明度越高（0.4~1.0），让强 loop 视觉上更突出
              opacity={0.4 + rec.score * 0.6}
            />
            {/* 两端 anchor 小圆点——让用户知道 loop 起止位置 */}
            <circle cx={x1} cy={yMax} r={3} fill={arcColor} />
            <circle cx={x2} cy={yMax} r={3} fill={arcColor} />
          </g>
        );
      })}
    </svg>
  );
}