/**
 * CrosshairLayer — 全局十字光标覆盖层。
 *
 * 架构位置：
 * - components/overlay/：跨 viewer 的覆盖层组件（不依赖任何 model 业务）
 * - 通常挂在 RouteShell 顶部，z-index 在所有 lane 之上
 *
 * 职责：
 * - 订阅 cursor store（鼠标当前所在的像素坐标 x + 对应的 bp + track 名称）
 * - 渲染一根竖直短线 + 顶部 readout（chr:bp + track）
 *
 * 设计取舍：
 * - 完全 controlled by store：没有内部 state，也没有自己的事件监听
 * - cursor 为 null 时直接返回 null（而不是渲染空 div），避免抢鼠标事件
 * - 像素位置 x 由上层 mouse handler 写入 store；这里只负责画出来
 */
import type { JSX } from 'react';

import { formatBp } from '../../genomics/coords';
import { useCursor } from '../../store/cursor';
import { useViewport } from '../../store/viewport';
import './crosshair.css';

/**
 * 全局十字光标覆盖层。
 * 必须挂在比 lane 更高的 z-index；cursor 为 null 时不渲染（避免无谓遮挡）。
 */
export function CrosshairLayer(): JSX.Element | null {
  const chr = useViewport((state) => state.chr);
  const x = useCursor((state) => state.x);
  const bp = useCursor((state) => state.bp);
  const track = useCursor((state) => state.track);

  // 鼠标尚未进入任何 lane 时不渲染——避免一个"幽灵十字"挡住其它 layer
  if (x === null || bp === null) return null;

  return (
    <div className="crosshair-layer">
      {/* 竖直短线：left 直接用像素坐标（store 里已经是 CSS px） */}
      <div className="crosshair-vline" style={{ left: `${x}px` }} />
      <div className="crosshair-readout">
        <span className="crosshair-pos">
          {chr}:{formatBp(bp)}
        </span>
        {/* 只有进入具体 lane 才有 track 名；进入空白区域时只显示坐标 */}
        {track && <span className="crosshair-track">{track}</span>}
      </div>
    </div>
  );
}
