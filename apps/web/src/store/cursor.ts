/**
 * 鼠标十字准星（crosshair）的全局光标位置。
 *
 * 职责：在多个 viewer（Hi-C + tracks + gene lane）之间共享鼠标在屏幕坐标
 * 与基因组坐标上的位置，由 mover 拖拽层 / 任意一个 track 写入，消费者
 * 通常是 CrosshairLayer。
 *
 * 为什么不在组件内部 useState：viewer 之间是兄弟关系，鼠标位置需要广播
 * 到所有轨道，而 zustand store 的"多生产者 + 多消费者"特性正合适。
 *
 * Hi-C 悬浮增强：除屏幕 x / 基因组 bp 外，还记录
 *  - `y`：横线在宿主容器（`[data-crosshair-host]`）内的 y 像素——竖线贯穿
 *    整个 Hi-C 区块，横线只在热图内跟随鼠标；
 *  - `binStart / binEnd / binIndex`：鼠标所在 bin 的基因组区间与列索引
 *    （按视口起点 + bin 大小推算，用于"选定区域说明"）；
 *  - `value`：该 bin 的 Hi-C 交互强度（矩阵 row-major 取值），供 tooltip 展示；
 *  - `binX0 / binX1`：该 bin 在宿主容器内的左右像素（轨道高亮带定位）；
 *  - `locked`：点击锁定标志——锁定后十字线 / 说明 / 高亮带固定不动，
 *    不再跟随鼠标（再次点击或移出后解除）。
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

/** 光标 store：包含屏幕 px、基因 bp、bin 区间说明与所属轨道。 */
interface CursorStore {
  /** 屏幕坐标系下的 x 像素（相对于 crosshair 宿主容器）。 */
  x: number | null;
  /** 屏幕坐标系下的 y 像素（相对于 crosshair 宿主容器，横线位置）。 */
  y: number | null;
  /** 当前 x 像素对应的基因组绝对坐标（bp）。 */
  bp: number | null;
  /** 鼠标所在 bin 的起始 bp（视口起点 + binIndex × bin）。 */
  binStart: number | null;
  /** 鼠标所在 bin 的结束 bp（binStart + bin）。 */
  binEnd: number | null;
  /** 鼠标所在 bin 的列索引（0 基）。 */
  binIndex: number | null;
  /** 鼠标所在 bin 的 Hi-C 交互强度（矩阵 row-major 值）。 */
  value: number | null;
  /** bin 高亮带在宿主容器内的左 / 右像素（贯穿全部轨道）。 */
  binX0: number | null;
  binX1: number | null;
  /** 鼠标所在轨道；move-out 时置 null。 */
  track: CursorTrack | null;
  /** 产生本次光标的 crosshair 宿主标识（`data-crosshair-id`）；Compare 工作区
      多面板时用于隔离各面板的十字线，单样本页（无该属性）为 null。 */
  hostId: string | null;
  /** 点击锁定标志：为 true 时十字线 / 说明 / 高亮带固定（生产者停止更新）。 */
  locked: boolean;
  /** 一次性更新全部字段（任一字段可为 null，表示"无该信息"）。 */
  setCursor: (cursor: {
    x: number | null;
    y?: number | null;
    bp: number | null;
    binStart?: number | null;
    binEnd?: number | null;
    binIndex?: number | null;
    value?: number | null;
    binX0?: number | null;
    binX1?: number | null;
    track: CursorTrack | null;
    hostId?: string | null;
  }) => void;
  /** 锁定当前光标（在热图上点击时调用；生产者停止跟随鼠标更新）。 */
  lock: () => void;
  /** 解除锁定（再次点击时调用；保留当前值，等待下一次移动覆盖）。 */
  unlock: () => void;
  /** 清空光标（move-out / 离开热图时调用）。 */
  clearCursor: () => void;
}

/** 光标未初始化时的默认状态。 */
const EMPTY = {
  x: null,
  y: null,
  bp: null,
  binStart: null,
  binEnd: null,
  binIndex: null,
  value: null,
  binX0: null,
  binX1: null,
  track: null,
  hostId: null,
  locked: false,
} as const;

/**
 * 全局 cursor store。
 * 默认所有字段为 null（"无光标"）。
 */
export const useCursor = create<CursorStore>((set) => ({
  ...EMPTY,
  setCursor: (cursor) =>
    set({
      ...EMPTY,
      ...cursor,
      // 可选字段缺省时为 null。
      y: cursor.y ?? null,
      binStart: cursor.binStart ?? null,
      binEnd: cursor.binEnd ?? null,
      binIndex: cursor.binIndex ?? null,
      value: cursor.value ?? null,
      binX0: cursor.binX0 ?? null,
      binX1: cursor.binX1 ?? null,
      hostId: cursor.hostId ?? null,
    }),
  lock: () => set({ locked: true }),
  unlock: () => set({ locked: false }),
  clearCursor: () => set({ ...EMPTY }),
}));
