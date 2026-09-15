/**
 * Loading — 项目通用加载指示器。
 *
 * 职责：统一"加载中"的视觉表达。所有页面 / 可视化在数据未就绪、chunk 未下载
 * 完成时都应使用本组件，而不是各自拼 `Loading…` 文字或省略号。
 *
 * 用法：
 * ```tsx
 * // 页面数据加载（占位块，居中显示 spinner + 文案）
 * <Loading variant="block" label={t('common.loading')} />
 *
 * // 可视化区域数据未就绪（绝对定位遮罩，盖在已渲染的 lane / 画布之上）
 * <Loading variant="overlay" size="small" />
 *
 * // 路由 chunk 懒加载 fallback（铺满父容器）
 * <Loading variant="full" label="Loading…" />
 * ```
 *
 * 形态说明：
 *  - `overlay`：绝对定位铺满最近定位祖先，覆盖在既有内容之上（数据刷新时
 *    旧图不消失，只加遮罩，避免闪烁）。
 *  - `block`：文档流内居中块，页面数据区首次加载时替换内容。
 *  - `inline`：行内小 spinner，用于菜单 / 列表角落等紧凑位置。
 *  - `full`：铺满父容器（父容器需有高度），用于整页 / 路由 Suspense fallback。
 *
 * 为什么不用 antd Spin：本项目轨道加载需要在 lane 内做 overlay 定位，且 spinner
 * 视觉要与既有 `track-loading`（科研工具克制风格）保持一致；自绘组件零依赖、
 * 可精确定位，主题色仍走 tokens.css 的 `--color-primary` 变量。
 */
import type { JSX } from 'react';
import './Loading.css';

export interface LoadingProps {
  /** 加载文案（建议传 i18n 的 `common.loading`；不传则只显示 spinner）。 */
  label?: string;
  /** spinner 直径：small 14 / default 20 / large 32。 */
  size?: 'small' | 'default' | 'large';
  /** 形态：`overlay` 遮罩 / `block` 占位块 / `inline` 行内 / `full` 铺满容器。 */
  variant?: 'overlay' | 'block' | 'inline' | 'full';
  /** 附加 className（挂到根元素）。 */
  className?: string;
  /** 附加到根元素的 data-* 或 aria 等属性。 */
  [key: string]: unknown;
}

/**
 * 通用加载指示器。
 *
 * @param props 见 {@link LoadingProps}。
 * @returns 渲染 spinner（+ 可选文案）的加载指示元素。
 */
export function Loading({
  label,
  size = 'default',
  variant = 'block',
  className,
  ...rest
}: LoadingProps): JSX.Element {
  const cls = [
    'loading',
    `loading--${variant}`,
    `loading--${size}`,
    className ?? '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div
      className={cls}
      role="status"
      aria-live="polite"
      data-loading="true"
      {...rest}
    >
      <span className="loading-spinner" aria-hidden="true" />
      {label ? <span className="loading-label">{label}</span> : null}
    </div>
  );
}

export default Loading;
