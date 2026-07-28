/**
 * 读取当前激活样本 id 的轻量 selector hook。
 *
 * 职责：把 zustand 的 `useSamples` 选择器模式封装成单一函数，让上层
 * （如 `useTrackSampleSelection` fallback）只关心"当前 active 是谁"。
 *
 * 为什么存在：避免在多个 viewer 里重复写
 * `useSamples((s) => s.active)`，并对未来 useSample 变更（如加 fallback 逻辑）留一个统一入口。
 */

import { useSamples } from '../store/samples';

/**
 * 返回当前激活样本的 id；若 store 尚未写入则返回 null。
 * 用 zustand selector 形式订阅，避免无关字段变更触发重渲染。
 */
export function useActiveSample(): string | null {
  return useSamples((state) => state.active);
}
