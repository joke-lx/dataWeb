/**
 * ModelSourceBadge —— 数据来源标签芯片。
 *
 * 职责：在 viewer 面板（轨道 lane / 3D panel）角落渲染一个小胶囊，
 * 用颜色 + 文案标注当前数据来源：
 *  - `"real"`     → 真实数据（绿点）
 *  - `"ab_proxy"` → Hi-C 派生代理（蓝点，A/B compartment 代理，不是真实表达/表观数据）
 *  - `"mock"` / 未知 / 缺失 → 模拟数据（灰点）
 *
 * 为什么存在：后端每个 /api/derived/* 端点都返回 `source` 字段，UI 需要
 * 让用户一眼区分"正在看真实数据还是降级 mock"。渲染为绝对定位的微小
 * 胶囊，作为 lane-header 或 panel 角标，不干扰主图。
 *
 * 约定：`source` 未定义时渲染 `null`（数据未就绪时不显示任何标签）。
 */
import type { JSX } from 'react';

import { useAppIntl } from '../../i18n';
import './model-source-badge.css';

interface ModelSourceBadgeProps {
  /** 数据来源标记；未定义时不渲染。 */
  source?: string;
}

/** 已知来源 → 翻译 key；未知 / mock / 缺失统一归于 "mock"。 */
function sourceToKey(source: string | undefined): string | null {
  if (!source) return null;
  if (source === 'real') return 'badge.source.real';
  if (source === 'ab_proxy') return 'badge.source.proxy';
  return 'badge.source.mock';
}

/**
 * 数据来源角标。
 *
 * @param source 来自 /api/derived/* 的 source 字段。
 * @returns 小胶囊或 null（source 缺失时）。
 */
export function ModelSourceBadge({
  source,
}: ModelSourceBadgeProps): JSX.Element | null {
  const { t } = useAppIntl();
  const tKey = sourceToKey(source);
  if (!tKey) return null;
  return (
    <span className={`model-source-badge model-source-badge--${source}`}>
      <span className="model-source-badge__dot" aria-hidden="true" />
      {t(tKey)}
    </span>
  );
}