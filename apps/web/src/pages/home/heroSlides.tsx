/**
 * 首页轮播的 3 张 SVG 插画。
 *
 * 职责：纯装饰性的基因组可视化风格插画，供 HeroCarousel 轮播展示。
 * 全部手写内联 SVG（无外部图片/无依赖），配色走 design token 的 CSS 变量，
 * 因此会随主题自动变化。`aria-hidden` 声明为装饰性内容。
 */

import type { JSX } from 'react';

/** 单张轮播卡片的配置。 */
export interface HeroSlideDef {
  id: string;
  titleKey: string;
  descKey: string;
  Svg: () => JSX.Element;
}

/** Hi-C 三角接触热图插画。 */
function HiCHeatmap(): JSX.Element {
  return (
    <svg viewBox="0 0 520 300" role="img" aria-label="Hi-C contact map illustration">
      <defs>
        <linearGradient id="hicGrad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="var(--color-accent)" />
          <stop offset="0.5" stopColor="var(--color-accent-soft)" />
          <stop offset="1" stopColor="var(--color-b-compartment)" />
        </linearGradient>
      </defs>
      <rect x="30" y="30" width="240" height="240" rx="6" fill="var(--color-surface-1)" />
      {/* 三角热图：沿对角线的色块由深到浅 */}
      {Array.from({ length: 12 }).map((_, i) => (
        <rect
          key={i}
          x={40 + i * 18}
          y={40 + i * 18}
          width={240 - i * 18 - 10}
          height={240 - i * 18 - 10}
          fill={`rgba(77, 110, 140, ${0.85 - i * 0.07})`}
        />
      ))}
      {/* 对角亮点（loop 锚点） */}
      <circle cx="210" cy="60" r="5" fill="var(--color-a-compartment)" />
      <circle cx="260" cy="110" r="5" fill="var(--color-a-compartment)" />
      <rect x="300" y="40" width="190" height="24" rx="4" fill="var(--color-surface-2)" />
      <rect x="300" y="80" width="150" height="18" rx="4" fill="var(--color-surface-2)" />
      <rect x="300" y="120" width="170" height="14" rx="3" fill="var(--color-border)" />
      <rect x="300" y="160" width="120" height="14" rx="3" fill="var(--color-border)" />
    </svg>
  );
}

/** 信号轨道（bigwig 波动 + 基因外显子）插画。 */
function SignalTracks(): JSX.Element {
  const wiggle =
    'M30,180 Q45,120 60,160 T90,150 T120,190 T150,130 T180,170 T210,120 T240,160';
  return (
    <svg viewBox="0 0 520 300" role="img" aria-label="Signal tracks illustration">
      <rect x="30" y="40" width="460" height="60" rx="6" fill="var(--color-surface-1)" />
      <path d={wiggle} fill="none" stroke="var(--color-accent)" strokeWidth="2.5" />
      {/* 面积填充 */}
      <path d={`${wiggle} L240,190 L30,190 Z`} fill="var(--color-accent-soft)" opacity="0.6" />
      <rect x="30" y="120" width="460" height="60" rx="6" fill="var(--color-surface-1)" />
      <path
        d="M30,160 Q60,140 90,155 T150,145 T210,165 T270,150 T330,158 T390,146 T450,162"
        fill="none"
        stroke="var(--color-b-compartment)"
        strokeWidth="2"
      />
      {/* 基因模型：内含子线 + 外显子箭头 */}
      <line x1="60" y1="230" x2="250" y2="230" stroke="var(--color-gene-intron)" strokeWidth="3" />
      <rect x="80" y="222" width="40" height="16" rx="3" fill="var(--color-gene-exon)" />
      <rect x="150" y="222" width="30" height="16" rx="3" fill="var(--color-gene-exon)" />
      <rect x="200" y="222" width="45" height="16" rx="3" fill="var(--color-gene-exon)" />
      <line x1="280" y1="230" x2="460" y2="230" stroke="var(--color-gene-intron)" strokeWidth="3" />
      <rect x="300" y="222" width="50" height="16" rx="3" fill="var(--color-gene-exon)" />
      <rect x="370" y="222" width="35" height="16" rx="3" fill="var(--color-gene-exon)" />
    </svg>
  );
}

/** 3D 染色质（串珠 + 环状 loop）插画。 */
function Chromatin3D(): JSX.Element {
  return (
    <svg viewBox="0 0 520 300" role="img" aria-label="3D chromatin illustration">
      <defs>
        <radialGradient id="chromaGrad" cx="0.35" cy="0.3" r="0.9">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="1" stopColor="var(--color-accent-soft)" />
        </radialGradient>
      </defs>
      <circle cx="260" cy="150" r="120" fill="url(#chromaGrad)" opacity="0.5" />
      {/* 串珠骨架 */}
      <path
        d="M140,190 Q180,120 230,160 T320,140 T400,180"
        fill="none"
        stroke="var(--color-accent)"
        strokeWidth="4"
      />
      {/* 珠 */}
      {[
        [140, 190], [190, 145], [230, 160], [280, 148],
        [320, 140], [360, 165], [400, 180],
      ].map(([cx, cy], i) => (
        <circle key={i} cx={cx} cy={cy} r="12" fill={i % 2 ? 'var(--color-a-compartment)' : 'var(--color-b-compartment)'} />
      ))}
      {/* 增强子弧（loop） */}
      <path d="M230,160 Q260,60 320,140" fill="none" stroke="var(--color-pei-anchor)" strokeWidth="2" strokeDasharray="4 3" />
      <circle cx="260" cy="70" r="5" fill="var(--color-pei-anchor)" />
      <circle cx="190" cy="145" r="4" fill="var(--color-tad-boundary)" />
    </svg>
  );
}

/** 三张轮播卡片配置（顺序即展示顺序）。 */
export const HERO_SLIDES: readonly HeroSlideDef[] = [
  {
    id: 'hic',
    titleKey: 'home.carousel.slide1.title',
    descKey: 'home.carousel.slide1.desc',
    Svg: HiCHeatmap,
  },
  {
    id: 'tracks',
    titleKey: 'home.carousel.slide2.title',
    descKey: 'home.carousel.slide2.desc',
    Svg: SignalTracks,
  },
  {
    id: '3d',
    titleKey: 'home.carousel.slide3.title',
    descKey: 'home.carousel.slide3.desc',
    Svg: Chromatin3D,
  },
];
