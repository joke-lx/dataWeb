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

export function useD3Zoom(ref: RefObject<HTMLElement | null>): {
  programmaticZoom: (factor: number) => void;
} {
  const zoomViewport = useViewport((state) => state.zoom);
  const previousTransformRef = useRef<ZoomTransform>(zoomIdentity);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    const selection = select(element);
    const zoomBehavior = d3Zoom<HTMLElement, unknown>()
      .scaleExtent([0.5, 200])
      .filter((event) => {
        // Wheel zoom only on Ctrl/Cmd (standard map convention)
        if (event.type === 'wheel') {
          return event.ctrlKey || event.metaKey;
        }
        // Touch zoom: two-finger pinch
        if (event.type === 'touchstart' || event.type === 'touchmove') {
          return (event as TouchEvent).touches.length >= 2;
        }
        // Drag pan: always allowed (left mouse / single touch)
        return !event.ctrlKey && !event.button;
      })
      .on('zoom', (event) => {
        const previous = previousTransformRef.current;
        const current = event.transform;
        const scaleFactor = current.k / previous.k;
        const translatedX = current.x - scaleFactor * previous.x;
        const rect = element.getBoundingClientRect();

        previousTransformRef.current = current;
        if (rect.width <= 0 || scaleFactor <= 0) return;

        const { start, end, chr, bin } = useViewport.getState();
        const viewport = { chr, start, end, bin };
        const width = end - start;
        const newWidth = Math.max(
          MIN_VIEWPORT_WIDTH_BP,
          Math.min(MAX_VIEWPORT_WIDTH_BP, width / scaleFactor),
        );
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
    return () => {
      selection.on('.zoom', null);
    };
  }, [ref]);

  return {
    programmaticZoom: (factor: number) => zoomViewport(factor),
  };
}
