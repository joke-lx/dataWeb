/**
 * CrosshairLayer — 全局十字光标覆盖层。
 *
 * 架构位置：
 * - components/overlay/：跨 viewer 的覆盖层组件（不依赖任何 model 业务）
 * - 挂在 Hi-C 区块（`[data-crosshair-host]` 宿主）内，z-index 在所有 lane 之上
 *
 * 职责：
 * - 订阅 cursor store（鼠标位置 x/y + 基因组 bp + bin 区间 + Hi-C 强度 + track）
 * - 渲染十字准线：
 *   - 竖直细线贯穿整个宿主容器（Hi-C + 全部轨道），实现"轨道同步此区域"；
 *   - 横向细线只在热图高度内跟随鼠标（形成十字）；
 * - 渲染选定区域说明（tooltip）：chr:binStart–binEnd、bin 索引、Hi-C 交互强度
 *
 * 设计取舍：
 * - 完全 controlled by store：没有内部 state，也没有自己的事件监听
 * - cursor 为 null 时直接返回 null（而不是渲染空 div），避免抢鼠标事件
 * - 像素位置 x / y 由上层 mouse handler 写入 store；这里只负责画出来
 */
import type { JSX } from 'react';

import { formatBp } from '../../genomics/coords';
import { useCursor } from '../../store/cursor';
import { usePanelViewport } from '../../hooks/usePanelViewport';
import './crosshair.css';

interface CrosshairLayerProps {
  /** 归属的 crosshair 宿主标识（`data-crosshair-id`）。Compare 工作区多面板时
      每个面板传自己的 sample id，仅当 cursor 由本宿主产生才渲染十字线；
      单样本页缺省（undefined）→ 与无标识宿主（null）匹配，行为不变。 */
  hostId?: string;
}

/**
 * 全局十字光标覆盖层。
 * 必须挂在比 lane 更高的 z-index；cursor 为 null 时不渲染（避免无谓遮挡）。
 */
export function CrosshairLayer({ hostId }: CrosshairLayerProps): JSX.Element | null {
  const chr = usePanelViewport((state) => state.chr);
  const x = useCursor((state) => state.x);
  const y = useCursor((state) => state.y);
  const bp = useCursor((state) => state.bp);
  const binStart = useCursor((state) => state.binStart);
  const binEnd = useCursor((state) => state.binEnd);
  const binIndex = useCursor((state) => state.binIndex);
  const value = useCursor((state) => state.value);
  const locked = useCursor((state) => state.locked);
  const track = useCursor((state) => state.track);
  const cursorHostId = useCursor((state) => state.hostId);

  // 鼠标尚未进入任何 lane 时不渲染——避免一个"幽灵十字"挡住其它 layer。
  if (x === null || bp === null) return null;
  // 多面板隔离：cursor 不是本宿主产生的不渲染（另一面板的十字线不过界）。
  if ((cursorHostId ?? null) !== (hostId ?? null)) return null;

  // 区域说明：优先展示 bin 区间；无 bin 信息时退化为单个 bp。
  const regionText =
    binStart !== null && binEnd !== null
      ? `${chr}:${formatBp(binStart)}–${formatBp(binEnd)}`
      : `${chr}:${formatBp(bp)}`;
  const valueText = value !== null ? value.toFixed(3) : '—';

  return (
    <div className="crosshair-layer">
      {/* 竖直细线：只在 Hi-C 热图内（与横线组成十字），不跨越其他画布 */}
      <div className="crosshair-vline" style={{ left: `${x}px` }} />
      {/* 横向细线：只在热图高度内跟随鼠标，与竖线组成十字 */}
      {y !== null && <div className="crosshair-hline" style={{ top: `${y}px` }} />}
      {/* 选定区域说明（跟随鼠标，防溢出翻转） */}
      <div
        className="crosshair-tooltip"
        style={{
          left: `${x + 12}px`,
          top: `${(y ?? 0) + 12}px`,
        }}
      >
        <div className="crosshair-tooltip__region">{regionText}</div>
        <div className="crosshair-tooltip__row">
          <span>bin #{binIndex ?? '—'}</span>
          <span className="crosshair-tooltip__value">Hi-C {valueText}</span>
        </div>
        {locked && <div className="crosshair-tooltip__lock">已锁定 · 点击解锁</div>}
        {track && <div className="crosshair-tooltip__track">{track}</div>}
      </div>
    </div>
  );
}
