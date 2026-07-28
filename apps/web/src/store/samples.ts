/**
 * 当前样本（active sample）状态。
 *
 * 职责：保存一个全局的 "active sample id"，供 Hi-C / 3D / Differential /
 * Loop 等 viewer 在路由参数缺失时回退使用。
 *
 * 为什么分开存在：sample catalog 走 TanStack Query（带缓存、staleTime），
 * 而 active 是一个轻量的全局指针，写到独立的 zustand store 避免了把整个
 * 样本列表塞进全局状态。Tracks 页通过 `useSampleCatalog` 单独持有自己的
 * 样本副本，不会污染 active 的消费者。
 */

import { create } from 'zustand';
import type { Sample } from '../api/types';

/** 全局样本状态：列表 + 当前激活 id。 */
interface SamplesStore {
  /** 完整样本清单（已按 species 过滤过）。 */
  samples: Sample[];
  /** 整体替换样本列表。 */
  setSamples: (s: Sample[]) => void;
  /** 当前激活的样本 id；null 表示尚未就绪。 */
  active: string | null;
  setActive: (id: string) => void;
}

/**
 * 全局 zustand store。
 * 直接 `useSamples.getState()` / `useSamples.setState()` 也能在 hook 之外
 * 访问，使 viewer 在 useEffect 之外的同步路径中也能写入 active。
 */
export const useSamples = create<SamplesStore>((set) => ({
  samples: [],
  setSamples: (samples) => set({ samples }),
  active: null,
  setActive: (active) => set({ active }),
}));