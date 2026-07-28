/**
 * RouteShell — 跨 viewer 路由的通用布局模板。
 *
 * 架构位置：被 `routes/<name>/index.tsx` 用来包裹 `<ModelFactory />`，
 * 提供统一的「页面标题 + 副标题 + 操作区 + region breadcrumb + 可选
 * toolbar + 内容区」骨架。
 *
 * 为什么存在：在 ModelFactory 重构前，每个 viewer 路由各自实现 header、
 * 间距、面包屑等，导致视觉与交互不一致。RouteShell 把这部分提取为
 * 单一来源（见 dataweb-work-flow ref3），新增路由时直接复用即可。
 *
 * 数据来源：默认 region breadcrumb 从 `useViewport` 读取当前区间；调用方
 * 也可以通过 `breadcrumb` prop 覆盖。
 */
import type { JSX, ReactNode } from 'react';

import { useAppIntl } from '../../i18n';
import { useViewport } from '../../store/viewport';
import './route.css';

/**
 * RouteShell 的 props。
 *
 * @property title       主页面标题（渲染为 h2）
 * @property subtitle    标题下方的副标题/描述（可选）
 * @property actions     显示在 header 右侧的操作按钮组（可选）
 * @property toolbar     标题下方的控件行（可选；如 lane 高度、track 选择器等）
 * @property breadcrumb  region 面包屑覆盖值；不传则从 viewport 推导
 * @property children    路由主体内容（通常是 `<ModelFactory type="..." />`）
 */
interface RouteShellProps {
  /** 主页面标题 (h2). */
  title: string;
  /** 可选：标题下方的副标题/描述. */
  subtitle?: string;
  /** 可选：显示在页面 header 右侧的操作按钮. */
  actions?: ReactNode;
  /** 可选：工具栏（页面 header 下方的控件行）. */
  toolbar?: ReactNode;
  /** Region breadcrumb 覆盖值（缺省从 viewport 推导）. */
  breadcrumb?: string;
  children: ReactNode;
}

/**
 * RouteShell — 所有 viewer 路由的通用布局模板。
 *
 * 提供标准的 `.route-page` > `.route-header` + `.route-content`
 * 框架，具有一致的 padding、排版和响应式行为。
 *
 * 用法:
 * ```tsx
 * <RouteShell title={t('hic.viewer.title')} subtitle={desc} actions={<ShareBtn />}>
 *   <HicModel />
 * </RouteShell>
 * ```
 */
export function RouteShell({
  title,
  subtitle,
  actions,
  toolbar,
  breadcrumb,
  children,
}: RouteShellProps): JSX.Element {
  const { t } = useAppIntl();
  const viewport = useViewport();

  // breadcrumb 优先用调用方传入的；否则从 viewport 实时拼出 chr:start-end。
  // 用 toLocaleString 给数字加千分位，避免「chr1:1000000-2000000」这种长串。
  const region =
    breadcrumb ??
    `${viewport.chr}:${viewport.start.toLocaleString()}-${viewport.end.toLocaleString()}`;

  return (
    <main className="route-page">
      <header className="route-header">
        <div className="route-header__row">
          <div>
            <h2>{title}</h2>
            {subtitle && <p className="route-header__subtitle">{subtitle}</p>}
          </div>
          {actions && (
            <div className="route-header__actions">{actions}</div>
          )}
        </div>
        <div className="route-header__region">
          <span className="route-header__region-text">{region}</span>
          <span className="route-header__bin">{t('stage.binLabel', { bin: viewport.bin.toLocaleString() })}</span>
        </div>
      </header>
      {toolbar && <div className="route-toolbar">{toolbar}</div>}
      <div className="route-content">{children}</div>
    </main>
  );
}
