/**
 * 浮层 Panel（Popover）通用组件。
 *
 * 职责：把触发元素（trigger）inline 渲染，把内容（children）portal 到
 * `document.body` 并用绝对定位贴合触发器。用于 sample picker、compare
 * picker 等"点按钮展开菜单"场景。
 *
 * 为什么 portal：避免菜单被父容器的 overflow / z-index / transform 影响——
 * 浏览器对 portal 之后的位置计算完全跟随 viewport 坐标。
 *
 * 为什么 trigger / children 用 render prop：让上层完全控制元素形态
 *（按钮 / 链接 / 任意），并把 open / close 透传给渲染函数。
 */

import { useCallback, useEffect, useRef, useState, type JSX, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import './Popover.css';

/** Popover 组件 props。 */
interface PopoverProps {
  /** 触发元素渲染函数——把 `open` 透传给 onClick 即可。 */
  trigger: (open: () => void) => ReactNode;
  /** 面板内容渲染函数——可用 `close` 关闭 popover。 */
  children: (close: () => void) => ReactNode;
  /** 面板宽度（px）。 */
  width?: number;
  /** 相对触发器的对齐：左对齐 / 右对齐（默认右对齐）。 */
  align?: 'left' | 'right';
  /** 面板自定义 className（可附加业务样式）。 */
  className?: string;
}

/**
 * Popover 浮层。
 *
 * 1. render 触发器 inline、自带 ref 用于定位；
 * 2. isOpen 为 true 时 portal 到 body，根据 trigger 的 `getBoundingClientRect`
 *    + window.scroll 偏移算出绝对位置；
 * 3. 监听 document `mousedown` 与 `keydown`，触发 close 条件：
 *     - 点击在面板 / 触发器之外；
 *     - Esc 键。
 */
export function Popover({
  trigger,
  children,
  width = 320,
  align = 'right',
  className,
}: PopoverProps): JSX.Element {
  const [isOpen, setIsOpen] = useState(false);
  const triggerRef = useRef<HTMLElement | null>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  // 面板位置（绝对坐标，含 scroll 偏移）。null 表示尚未打开。
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  const open = useCallback(() => {
    if (triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      // 必须显式加 scroll 偏移：portal 之后元素脱离原 stacking context，
      // 不能再依赖 `position: fixed`（fixed 在某些 iframe / external widgets 中会失准）。
      const scrollY = window.scrollY;
      const scrollX = window.scrollX;
      setPos({
        top: rect.bottom + scrollY + 4,
        // 右对齐：让面板的右边与 trigger 右边对齐；左对齐：让面板与 trigger 左对齐。
        left: align === 'right' ? rect.right + scrollX - width : rect.left + scrollX,
      });
    }
    setIsOpen(true);
  }, [align, width]);

  const close = useCallback(() => setIsOpen(false), []);

  useEffect(() => {
    // 仅在打开时挂事件；关闭后立即摘除，避免污染全局。
    if (!isOpen) return undefined;
    const onClick = (e: MouseEvent) => {
      const target = e.target as Node;
      // 命中 trigger 或 panel 内部：由它们自己的 click 决定是否关闭。
      if (popoverRef.current?.contains(target)) return;
      if (triggerRef.current?.contains(target)) return;
      setIsOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [isOpen]);

  const panelClass = className ? `popover-panel ${className}` : 'popover-panel';

  return (
    <>
      <span ref={triggerRef} className="popover-trigger">
        {trigger(open)}
      </span>
      {isOpen && pos && createPortal(
        <div
          ref={popoverRef}
          role="dialog"
          className={panelClass}
          style={{
            position: 'absolute',
            top: pos.top,
            left: pos.left,
            width,
            zIndex: 1000,
          }}
        >
          {children(close)}
        </div>,
        document.body,
      )}
    </>
  );
}
