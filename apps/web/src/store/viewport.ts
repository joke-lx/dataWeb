/**
 * 浏览器当前的"相机"——染色体、可见区间、Hi-C 分箱大小。
 *
 * 职责：所有 viewer 共享的单一 viewport 状态。RegionInput、ZoomSlider、
 * d3-zoom 拖拽都通过该 store 改变位置；viewer 组件读取后决定要拉取哪段
 * bigwig / hic 矩阵。
 *
 * 为什么用 zustand：跨多个兄弟 viewer 共享状态而无需 React Context 嵌套，
 * 同时保留 actions 的命令式调用方式（`useViewport.getState().zoom(...)`）。
 */

import { create } from 'zustand';

/** 浏览器视图的状态：染色体 + 起始/终止碱基 + Hi-C bin 大小。 */
export interface Viewport {
  chr: string;
  start: number;
  end: number;
  bin: number;
}

/** Viewport 存储 + 操作 actions。 */
interface ViewportStore extends Viewport {
  /** 部分更新（常用于从 URL 装载）。 */
  setViewport: (viewport: Partial<Viewport>) => void;
  /**
   * 以 `centerBp` 为中心缩放，factor>1 放大、<1 缩小。
   * 不传 `centerBp` 时按当前 viewport 中点。
   */
  zoom: (factor: number, centerBp?: number) => void;
  /** 整体平移 `deltaBp` 碱基对（不带边界校验之外的负值钳制）。 */
  pan: (deltaBp: number) => void;
  /** 切换到另一条染色体，并重置为 chr 起点 + 1Mb 视图 + 50kb bin。 */
  setChrom: (chr: string) => void;
  /** 单独更新 Hi-C bin 大小（来自 ZoomSlider）。 */
  setBin: (bin: number) => void;
}

/** 初始 viewport：chr1:1-2Mb，50kb bin。 */
const INITIAL: Viewport = {
  chr: 'chr1',
  start: 1_000_000,
  end: 2_000_000,
  bin: 50_000,
};

/** 最小允许宽度（防止 zoom 过度收敛到 0）。 */
export const MIN_VIEWPORT_WIDTH_BP = 1_000;
/** 最大允许宽度（与最长染色体量级一致）。 */
export const MAX_VIEWPORT_WIDTH_BP = 300_000_000;

/**
 * Hi-C bin 候选档位（从粗到细）。
 * 顺序对应 ZoomSlider 渲染顺序——索引 0 最粗。
 */
export const BIN_STEPS = [
  1_000_000,
  250_000,
  100_000,
  50_000,
  25_000,
  10_000,
  5_000,
];

/**
 * viewport store。
 * action 用 `get()` 取当前状态，避免闭包陷阱。
 */
export const useViewport = create<ViewportStore>((set, get) => ({
  ...INITIAL,
  // 浅合并：调用方只传需要改的字段。
  setViewport: (viewport) => set((state) => ({ ...state, ...viewport })),
  zoom: (factor, centerBp) => {
    const { start, end } = get();
    // 默认以当前 viewport 中点为缩放中心；显式传 centerBp 用于 d3-zoom 的鼠标位置。
    const center = centerBp ?? (start + end) / 2;
    const width = end - start;
    // 等比缩放后再夹到 [MIN, MAX] 区间。
    const newWidth = Math.max(
      MIN_VIEWPORT_WIDTH_BP,
      Math.min(MAX_VIEWPORT_WIDTH_BP, width / factor),
    );
    const newStart = Math.max(0, center - newWidth / 2);
    set({ start: newStart, end: newStart + newWidth });
  },
  pan: (deltaBp) => {
    const { start, end } = get();
    const width = end - start;
    // 钳制在 0 处；右端不钳制（让用户能"出界"看到染色体末端）。
    const newStart = Math.max(0, start + deltaBp);
    set({ start: newStart, end: newStart + width });
  },
  // 切换染色体时强制 reset 区间——避免把上一条染色体的 start/end 错误套用。
  setChrom: (chr) =>
    set({ chr, start: 0, end: 1_000_000, bin: 50_000 }),
  setBin: (bin) => set({ bin }),
}));
