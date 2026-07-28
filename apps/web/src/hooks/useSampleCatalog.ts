/**
 * 加载样本目录（TanStack Query 缓存 + 5 分钟 staleTime）。
 *
 * 职责：返回某个物种下的全部样本列表，供 Sample / Species / Tracks 页面使用。
 * 故意不写入全局 `samples` store，理由见下方注释。
 */

import { useQuery } from '@tanstack/react-query';

import { fetchSamples } from '../api/client';
import type { Sample } from '../api/types';

/**
 * 加载当前物种的全部样本并通过 TanStack Query 缓存。
 * queryKey 为 `['samples', 'pig']`，与 LeftRail（目前未挂载）共享缓存，
 * 重挂时不会重新发请求。
 *
 * 为什么**不**写入全局 `samples` store：
 * 1. 全局 store 关心的是 `active`（Hi-C / 3D / Differential / Loop 路线用）。
 * 2. Sample 目录是一个"按需加载"的数据，强行在 viewer 路由挂载会变成
 *    隐式副作用。Tracks 路线通过本 hook 显式 opt-in。
 * 3. 解耦后任意 route 切换样本需求都能独立改 staleTime / 网络策略。
 */
export function useSampleCatalog(): {
  samples: Sample[] | undefined;
  isLoading: boolean;
  error: Error | null;
} {
  const query = useQuery<Sample[], Error>({
    queryKey: ['samples', 'pig'],
    queryFn: () => fetchSamples('pig'),
    // 5 分钟：catalog 很少变，缩短能减少不必要的网络往返。
    staleTime: 5 * 60_000,
  });

  return {
    samples: query.data,
    isLoading: query.isLoading,
    error: query.error,
  };
}