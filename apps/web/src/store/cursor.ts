/**
 * 鼠标十字准星（crosshair）的全局光标位置。
 *
 * 职责：在多个 viewer（Hi-C + tracks + gene lane）之间共享鼠标在屏幕坐标
 * 与基因组坐标上的位置，由 mover 拖拽层 / 任意一个 track 写入，消费者
 * 通常是 CrosshairLayer。
 *
 * 为什么不在组件内部 useState：viewer 之间是兄弟关系，鼠标位置需要广播
 * 到所有轨道，而 zustand store 的"多生产者 + 多消费者"特性正合适。
 */

import { create } from 'zustand';

/** 当前光标可以归属的轨道类型。null 表示不在轨道上方。 */
export type CursorTrack =
  | 'bigwig'
  | 'ab'
  | 'tad'
  | 'pei'
  | 'gene'
  | 'is'
  | 'sv'
  | 'hic';

/** 光标 store：包含屏幕 px、基因 bp、以及所属轨道。 */
interface CursorStore {
  /** 屏幕坐标系下的 x 像素（相对于 viewer 容器）。 */
  x: number | null;
  /** 当前 x 像素对应的基因组绝对坐标（bp）。 */
  bp: number | null;
  /** 鼠标所在轨道；move-out 时置 null。 */
  track: CursorTrack | null;
  /** 一次性更新三个字段。 */
  setCursor: (
    x: number | null,
    bp: number | null,
    track: CursorTrack | null,
  ) => void;
}

/**
 * 全局 cursor store。
 * 默认所有字段为 null（"无光标"）。
 */
export const useCursor = create<CursorStore>((set) => ({
  x: null,
  bp: null,
  track: null,
  setCursor: (x, bp, track) => set({ x, bp, track }),
}));
