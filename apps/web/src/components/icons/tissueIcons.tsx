/**
 * 组织/工具图标 — 共享 SVG 图标模块。
 *
 * 职责：把 Brain / Liver / Muscle 组织图标和 Search / Arrow 通用图标抽到
 * 一处，供 Species 页、Database 结果卡片等多处复用，避免各自重复定义。
 */

import type { JSX } from 'react';

export function BrainIcon(): JSX.Element {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" width="1em" height="1em">
      <path d="M12 4C7 4 4 7 4 11c0 2 .8 3.5 2 4.5V19a1 1 0 001 1h2a1 1 0 001-1v-3" />
      <path d="M12 4c5 0 8 3 8 7 0 2-.8 3.5-2 4.5V19a1 1 0 01-1 1h-2a1 1 0 01-1-1v-3" />
      <path d="M10 14v-2a2 2 0 114 0v2" />
    </svg>
  );
}

export function LiverIcon(): JSX.Element {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" width="1em" height="1em">
      <path d="M12 20c-4-2-7-6-7-10 0-3 2-5 4-5s3 1 3 3c0-2 1-3 3-3s4 2 4 5c0 4-3 8-7 10z" />
      <path d="M12 20V9" />
    </svg>
  );
}

export function MuscleIcon(): JSX.Element {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" width="1em" height="1em">
      <path d="M3 14c0-3 3-5 5-3s2 5 4 7c2 2 5 4 8 3" />
      <path d="M16 5c2-1 5 1 5 4s-2 6-4 7" />
      <path d="M16 5l3 3" />
      <path d="M8 11l3-2" />
    </svg>
  );
}

export function SearchIcon(): JSX.Element {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="1em" height="1em">
      <circle cx="11" cy="11" r="7" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  );
}

export function ArrowIcon(): JSX.Element {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="1em" height="1em">
      <line x1="5" y1="12" x2="19" y2="12" />
      <polyline points="12 5 19 12 12 19" />
    </svg>
  );
}

/** 组织名 → 图标映射（未知组织回退 Brain 风格）。 */
export const TISSUE_ICONS: Record<string, () => JSX.Element> = {
  Brain: BrainIcon,
  Liver: LiverIcon,
  Muscle: MuscleIcon,
};

export function tissueIcon(tissue: string): () => JSX.Element {
  return TISSUE_ICONS[tissue] ?? BrainIcon;
}
