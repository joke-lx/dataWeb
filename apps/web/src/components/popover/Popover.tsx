import { useCallback, useEffect, useRef, useState, type JSX, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import './Popover.css';

interface PopoverProps {
  /** Element that opens the popover when clicked. */
  trigger: (open: () => void) => ReactNode;
  /** Content rendered into the floating panel. */
  children: (close: () => void) => ReactNode;
  /** Width of the popover panel. */
  width?: number;
  /** Alignment relative to trigger. */
  align?: 'left' | 'right';
  /** Optional className for the popover panel. */
  className?: string;
}

/**
 * Popover — a reusable floating panel anchored to a trigger element.
 *
 * Renders the trigger inline and portals the content into document.body
 * with explicit absolute positioning computed from the trigger's
 * getBoundingClientRect(). This guarantees the popover never participates
 * in the trigger's parent flex / block flow.
 *
 * Closes on outside click or Escape key.
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
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  const open = useCallback(() => {
    if (triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      const scrollY = window.scrollY;
      const scrollX = window.scrollX;
      setPos({
        top: rect.bottom + scrollY + 4,
        left: align === 'right' ? rect.right + scrollX - width : rect.left + scrollX,
      });
    }
    setIsOpen(true);
  }, [align, width]);

  const close = useCallback(() => setIsOpen(false), []);

  useEffect(() => {
    if (!isOpen) return undefined;
    const onClick = (e: MouseEvent) => {
      const target = e.target as Node;
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
