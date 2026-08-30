/**
 * InViewSection — 懒挂载区块门。
 *
 * 职责：让重型可视化（WebGL / Plotly / three.js）只有在接近视口时才真正
 * 挂载，避免单页线性布局里一次性加载所有 viewer 的 chunk。
 *
 * 闩锁语义：一旦进入视口（带 600px 预加载边距），就永久挂载 children，
 * 之后滚动离开也不会卸载 —— 卸载会销毁 WebGL/Plotly 状态并在每次滚回时
 * 重新拉数据。未进入前渲染一个 minHeight 占位，保证锚点位置不跳动。
 *
 * 为什么用 viewport-root IO：`.route-content` 是嵌套滚动容器，但 IO 默认
 * 以视口为根时会自动考虑裁剪祖先，无需手动传 scroll-root。
 */

import { useEffect, useRef, useState, type JSX, type ReactNode } from 'react';

interface InViewSectionProps {
  minHeight: number;
  children: ReactNode;
  className?: string;
}

/**
 * 懒挂载区块。
 *
 * @param props - `minHeight` 占位高度（像素），`children` 实际内容。
 */
export function InViewSection({ minHeight, children, className }: InViewSectionProps): JSX.Element {
  const ref = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setInView(true);
          observer.disconnect();
        }
      },
      { rootMargin: '600px 0px 600px 0px' },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={className}
      aria-busy={!inView}
      style={{ minHeight: inView ? undefined : minHeight }}
    >
      {inView ? (
        children
      ) : (
        <div className="inview-skeleton" style={{ minHeight }} aria-hidden="true" />
      )}
    </div>
  );
}
