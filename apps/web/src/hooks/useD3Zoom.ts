/**
 * 把 d3-zoom 绑定到任意容器元素的 hook，并把缩放/平移同步到 viewport store。
 *
 * 职责：把"鼠标事件"翻译成"碱基对位移"。compute 增量时拆出 d3 transform 的
 * 平移 + 缩放分量，反推回 viewport 的 start/end。
 *
 * 为什么存在：centralize UI 控件（RegionInput / ZoomSlider）、d3-zoom 拖拽、
 * 程序化 zoom 都共享同一份 viewport store，可避免竞态。
 */

import { useEffect, useRef } from 'react';
import type { RefObject } from 'react';
import { select } from 'd3-selection';
import { zoom as d3Zoom, zoomIdentity } from 'd3-zoom';
import type { ZoomTransform } from 'd3-zoom';

import { pxToBp } from '../genomics/coords';
import {
  MAX_VIEWPORT_WIDTH_BP,
  MIN_VIEWPORT_WIDTH_BP,
  useViewport,
} from '../store/viewport';

/**
 * 绑定 d3-zoom 到某个容器。
 * 返回 `programmaticZoom` 用于 button / keyboard 触发的缩放（绕过 d3 自身的 transform）。
 */
export function useD3Zoom(ref: RefObject<HTMLElement | null>): {
  programmaticZoom: (factor: number) => void;
} {
  const zoomViewport = useViewport((state) => state.zoom);
  // 记录上一帧 transform；用于本次事件计算增量（平移 + 缩放分量）。
  const previousTransformRef = useRef<ZoomTransform>(zoomIdentity);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    const selection = select(element);
    const zoomBehavior = d3Zoom<HTMLElement, unknown>()
      .scaleExtent([0.5, 200])
      .filter((event) => {
        // 忽略标记了 data-ui-overlay 的元素上的事件——保证 picker / 控件上的
        // 滚轮/拖拽不会"穿透"到 genome 区域。
        const target = event.target as Element | null;
        if (target && typeof target.closest === 'function' && target.closest('[data-ui-overlay]')) {
          return false;
        }
        // 滚轮缩放：直接接受、不要求 Ctrl/Cmd（避免与浏览器缩放冲突，但保留 wheel 平移）。
        if (event.type === 'wheel') return true;
        // 触摸缩放：双指 pinch 才触发。
        if (event.type === 'touchstart' || event.type === 'touchmove') {
          return (event as TouchEvent).touches.length >= 2;
        }
        // 拖拽平移：左键 / 单指都允许。
        return !event.ctrlKey && !event.button;
      })
      .on('zoom', (event) => {
        const previous = previousTransformRef.current;
        const current = event.transform;
        // 缩放因子 = current.k / previous.k；d3 在平移中也混入 x/y，所以 x 分量
        // 必须除以 scaleFactor 得到纯平移。
        const scaleFactor = current.k / previous.k;
        const translatedX = current.x - scaleFactor * previous.x;
        const rect = element.getBoundingClientRect();

        previousTransformRef.current = current;
        // 容器宽度为 0（隐藏）时跳过；scaleFactor<=0 视为异常 transform。
        if (rect.width <= 0 || scaleFactor <= 0) return;

        const { start, end, chr, bin } = useViewport.getState();
        const viewport = { chr, start, end, bin };
        const width = end - start;
        const newWidth = Math.max(
          MIN_VIEWPORT_WIDTH_BP,
          Math.min(MAX_VIEWPORT_WIDTH_BP, width / scaleFactor),
        );
        // 把像素位移换算成碱基对位移：因为缩放后坐标系变，先除 scaleFactor 回
        // "缩放前" 的 px 空间，再做 px→bp 的线性映射。
        const translatedStart = pxToBp(
          -translatedX / scaleFactor,
          viewport,
          rect.width,
        );
        const newStart = Math.max(0, translatedStart);

        useViewport.setState({
          start: newStart,
          end: newStart + newWidth,
        });
      });

    selection.call(zoomBehavior);
    // 卸载时务必清除，否则 component 切换后旧 element 上的回调会持续触发。
    return () => {
      selection.on('.zoom', null);
    };
  }, [ref]);

  return {
    // 程序化缩放：直接走 viewport store action，与 d3 的 transform 解耦。
    programmaticZoom: (factor: number) => zoomViewport(factor),
  };
}
