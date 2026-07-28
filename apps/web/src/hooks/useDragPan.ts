/**
 * useDragPan — 水平拖拽移动基因组区域的 hook。
 *
 * 职责：把鼠标水平拖拽翻译成 viewport start/end 偏移。
 * 与 useD3Zoom 的区别：
 *   - 只处理拖拽（不处理滚轮缩放）
 *   - 不绑定 d3-zoom，而是直接监听 pointer 事件 → 更新 viewport store
 *   - 滚轮事件完全不受影响 → 页面可以正常纵向滚动
 *
 * 限流：viewport store 更新限流 100ms，避免拖拽时每个 move 事件都触发
 * 数据重拉导致白闪。
 */
import { useEffect, type RefObject } from 'react';

import { useViewport } from '../store/viewport';

const THROTTLE_MS = 100;

export function useDragPan(ref: RefObject<HTMLElement | null>): void {
  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    let isDragging = false;
    let lastX = 0;
    let pointerId = -1;
    let accumulatedDx = 0;
    let lastCommit = 0;

    const commitViewport = (): void => {
      if (Math.abs(accumulatedDx) < 2) return;

      const rect = el.getBoundingClientRect();
      if (rect.width <= 0) return;

      const { start, end } = useViewport.getState();
      const viewWidth = end - start;
      const bpPerPx = viewWidth / rect.width;
      const deltaBP = -accumulatedDx * bpPerPx;
      accumulatedDx = 0;

      const newStart = Math.max(0, start + deltaBP);
      useViewport.setState({
        start: newStart,
        end: newStart + viewWidth,
      });
    };

    const onPointerDown = (event: PointerEvent) => {
      if (event.button !== 0) return;
      isDragging = true;
      lastX = event.clientX;
      pointerId = event.pointerId;
      accumulatedDx = 0;
      lastCommit = performance.now();
      el.setPointerCapture(event.pointerId);
      el.style.cursor = 'grabbing';
    };

    const onPointerMove = (event: PointerEvent) => {
      if (!isDragging || event.pointerId !== pointerId) return;
      const dx = event.clientX - lastX;
      lastX = event.clientX;

      if (Math.abs(dx) < 2) return;
      accumulatedDx += dx;

      // 限流：每 THROTTLE_MS 才 commit 一次
      if (performance.now() - lastCommit < THROTTLE_MS) return;
      lastCommit = performance.now();
      commitViewport();
    };

    const onPointerUp = (event: PointerEvent) => {
      if (event.pointerId !== pointerId) return;
      // 拖拽结束时 commit 剩余累加量
      commitViewport();
      accumulatedDx = 0;
      isDragging = false;
      if (el.hasPointerCapture(event.pointerId)) {
        el.releasePointerCapture(event.pointerId);
      }
      el.style.cursor = 'grab';
    };

    el.style.cursor = 'grab';
    el.addEventListener('pointerdown', onPointerDown);
    el.addEventListener('pointermove', onPointerMove);
    el.addEventListener('pointerup', onPointerUp);
    el.addEventListener('pointercancel', onPointerUp);

    return () => {
      el.removeEventListener('pointerdown', onPointerDown);
      el.removeEventListener('pointermove', onPointerMove);
      el.removeEventListener('pointerup', onPointerUp);
      el.removeEventListener('pointercancel', onPointerUp);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ref]);
}
