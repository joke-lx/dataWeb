/**
 * ChrRuler —— 染色体坐标刻度条（参考图 Hi-C 热图下方的坐标轴）。
 *
 * 职责：在 Hi-C 热图正下方渲染一条基因组坐标轴——自适应选取 1/2/5×10^n
 * 的"好看"步长，把当前视口（chr + start/end）映射成刻度线与 bp/kb/Mb 标签。
 *
 * 为什么存在：Hi-C 热图本身没有 x 轴刻度（WebGL canvas 不负责 DOM 轴），
 * 参考站点对比视图里热图下方有染色体刻度条，这里用轻量 DOM 实现，与 lane
 * 体系（label gutter + content）对齐，保证和 TAD/PC1 等轨道同一坐标系。
 *
 * 视口来源：`usePanelViewport` —— Compare 面板内跟面板视口，普通页面回退
 * 全局视口。
 */
import type { JSX } from 'react';

import { usePanelViewport } from '../../../hooks/usePanelViewport';
import '../../render-kit/lane.css';
import './tracks.css';

const RULER_HEIGHT = 28;

interface ChrRulerProps {
  /** 覆盖 lane 像素高度。 */
  height?: number;
}

/** 把任意正数规整到 1/2/5×10^n 的"好看"步长。 */
function niceStep(raw: number): number {
  if (raw <= 0) return 1;
  const exp = Math.floor(Math.log10(raw));
  const base = 10 ** exp;
  const ratio = raw / base;
  let multiplier = 1;
  if (ratio > 5) multiplier = 10;
  else if (ratio > 2) multiplier = 5;
  else if (ratio > 1) multiplier = 2;
  return multiplier * base;
}

/** 按步长量级格式化 bp 标签（Mb / kb / bp）。 */
function formatBp(pos: number, step: number): string {
  if (step >= 1e6) {
    return `${Math.round((pos / 1e6) * 10) / 10} Mb`;
  }
  if (step >= 1e3) {
    return `${Math.round((pos / 1e3) * 10) / 10} kb`;
  }
  return `${Math.round(pos)} bp`;
}

/**
 * 染色体坐标刻度条。
 */
export function ChrRuler({ height = RULER_HEIGHT }: ChrRulerProps): JSX.Element {
  const viewport = usePanelViewport();
  const widthBp = Math.max(1, viewport.end - viewport.start);

  // 目标 6~10 条刻度 → 步长 = 视口宽 / 8 再规整。
  const step = niceStep(widthBp / 8);
  const firstTick = Math.ceil(viewport.start / step) * step;

  const ticks: { pos: number; pct: number }[] = [];
  for (let pos = firstTick; pos <= viewport.end; pos += step) {
    const pct = ((pos - viewport.start) / widthBp) * 100;
    if (pct < -2 || pct > 102) continue;
    ticks.push({ pos, pct });
  }

  return (
    <div className="lane" style={{ height: `${height}px` }}>
      <div className="lane-label">
        <span className="lane-title">{viewport.chr}</span>
      </div>
      <div className="lane-content" data-kind="chrRuler">
        <div className="chr-ruler">
          {/* 顶部基准线 */}
          <span className="chr-ruler__baseline" aria-hidden="true" />
          {ticks.map((tick) => {
            // 首尾标签整体向内收，避免被 lane 边缘裁剪成半截。
            const edgeClass =
              tick.pct < 8
                ? ' chr-ruler__tick--edge-left'
                : tick.pct > 92
                  ? ' chr-ruler__tick--edge-right'
                  : '';
            return (
              <span
                key={tick.pos}
                className={'chr-ruler__tick' + edgeClass}
                style={{ left: `${tick.pct}%` }}
              >
                <span className="chr-ruler__mark" aria-hidden="true" />
                <span className="chr-ruler__label">{formatBp(tick.pos, step)}</span>
              </span>
            );
          })}
        </div>
      </div>
    </div>
  );
}
