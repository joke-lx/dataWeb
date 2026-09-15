/**
 * InViewSection — 懒挂载区块门。
 *
 * 职责：让重型可视化（WebGL / Plotly / three.js）只有在接近视口时才真正
 * 挂载，避免单页线性布局里一次性加载所有 viewer 的 chunk。
 *
 * 闩锁语义：一旦进入可视区（带 600px 预加载边距），就永久挂载 children，
 * 之后滚动离开也不会卸载 —— 卸载会销毁 WebGL/Plotly 状态并在每次滚回时
 * 重新拉数据。未进入前渲染一个 minHeight 占位，保证锚点位置不跳动。
 *
 * root 选择：`.route-content` 是嵌套滚动容器。若以视口为 root，IntersectionObserver
 * 的 rootMargin 预加载会被裁剪祖先（滚动容器）吞掉 —— 实测只有真正滚进
 * 滚动容器可视区的前一个区块能挂载，其后的区块永远停在骨架态。因此这里
 * 把 root 显式设为最近的滚动祖先，rootMargin 基于该容器内容坐标计算，
 * 预加载边距对嵌套滚动同样生效。
 */

import { useEffect, useRef, useState, type JSX, type ReactNode } from 'react';

interface InViewSectionProps {
  minHeight: number;
  children: ReactNode;
  className?: string;
}

/**
 * 向上查找最近的滚动祖先（overflow 为 auto/scroll/overlay 且实际可滚）。
 *
 * @param el 起始元素
 * @returns 滚动祖先元素；找不到返回 null（此时 IO 退回视口 root）
 */
function findScrollableParent(el: Element | null): Element | null {
  let node: Element | null = el?.parentElement ?? null;
  while (node) {
    const style = getComputedStyle(node);
    const overflowY = style.overflowY;
    if (
      /(auto|scroll|overlay)/.test(overflowY) &&
      node.scrollHeight > node.clientHeight + 1
    ) {
      return node;
    }
    node = node.parentElement;
  }
  return null;
}

/**
 * 懒挂载区块。
 *
 * @param props - `minHeight` 占位高度（像素），`children` 实际内容。
 */
export function InViewSection({ minHeight, children, className }: InViewSectionProps): JSX.Element {
  const ref = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(false);
  const mountedRef = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    // root：最近滚动祖先（嵌套滚动容器），没有则退回视口。
    const root = findScrollableParent(el);

    let io: IntersectionObserver | null = null;
    let cleanup: () => void = () => {};
    const mount = () => {
      if (mountedRef.current) return;
      mountedRef.current = true;
      setInView(true);
      cleanup();
    };

    // IO 主路径：进入（含 600px 预加载边距）即永久挂载。
    if (typeof IntersectionObserver !== 'undefined') {
      try {
        io = new IntersectionObserver(
          (entries) => {
            if (entries.some((e) => e.isIntersecting)) mount();
          },
          { root, rootMargin: '600px 0px 600px 0px' },
        );
        io.observe(el);
      } catch {
        io = null;
      }
    }

    // 几何兜底：部分嵌入式 webview / 自动化浏览器里 IntersectionObserver
    // 不派发回调（实测为 null 回调），此时依赖 IO 的懒挂载永不触发，
    // 重型区块（3D/Hi-C）会永远停在骨架占位 → 白屏。
    // 用滚动祖先的 scroll 事件 + getBoundingClientRect 手动检查是否进入可视区。
    const check = () => {
      if (mountedRef.current) return;
      const container = (root as HTMLElement | null) ?? document.documentElement;
      const er = el.getBoundingClientRect();
      const cr = container.getBoundingClientRect();
      if (er.bottom >= cr.top - 600 && er.top <= cr.bottom + 600) mount();
    };
    // scroll 事件不冒泡，但 capture 阶段 window 能捕获自身及所有后代
    // 滚动容器的滚动，因此统一监听 window 即可覆盖「window 滚动」和
    // 「嵌套滚动容器滚动」两种布局。
    window.addEventListener('scroll', check, { passive: true, capture: true });
    window.addEventListener('resize', check);
    // 初始检查：IO 首次回调可能被吞，直接几何判断一次
    check();

    cleanup = () => {
      io?.disconnect();
      window.removeEventListener('scroll', check);
      window.removeEventListener('resize', check);
    };
    return cleanup;
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
