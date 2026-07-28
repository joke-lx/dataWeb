/**
 * 通用区间数据获取 hook（基于 `fetch` + AbortController）。
 *
 * 职责：当 URL 变化时拉取 ArrayBuffer，组件卸载或 URL 变化时自动 abort。
 * 之所以存在而不直接用 TanStack Query：它是底层 fetcher，专给那些不想引入
 * react-query 缓存语义、但仍需要 abort 行为的二进制端点（bigwig / hic）使用。
 *
 * 为什么带 `deps`：useEffect 的依赖数组需要把 token 化的 URL 字符串之外的
 * 隐式依赖（比如 species id）显式列出来以便正确触发重新拉取。
 */

import { useEffect, useRef, useState } from 'react';

/** 选项。`deps` 拼接到 URL 之后参与 useEffect 依赖比较。 */
interface RangeQueryOptions {
  url: string;
  deps: unknown[];
}

/**
 * 通用 range fetcher。
 * - 默认返回 `ArrayBuffer<T>`，调用方负责解释（`new Float32Array(buf)` 等）。
 * - 自动取消旧请求，AbortError 不会抛给调用方。
 * - 其它错误以 `Error` 形式暴露。
 */
export function useRangeQuery<T = ArrayBuffer>({
  url,
  deps,
}: RangeQueryOptions) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  // 用 ref 持有最新的 AbortController，保证上一轮请求能被取消。
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    // 取消上一轮（如果有还在飞的请求）。
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setLoading(true);
    setError(null);

    fetch(url, { signal: ctrl.signal })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(`${response.status} ${response.statusText}`);
        }
        const buffer = await response.arrayBuffer();
        setData(buffer as unknown as T);
        setLoading(false);
      })
      .catch((caught: unknown) => {
        // 主动 abort 视为正常路径：不写 error。
        if (caught instanceof DOMException && caught.name === 'AbortError') {
          return;
        }
        setError(
          caught instanceof Error ? caught : new Error(String(caught)),
        );
        setLoading(false);
      });

    // 卸载时再补一次 abort，覆盖"url 变了但还来不及 abort" 的窗口。
    return () => ctrl.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url, ...deps]);

  return { data, loading, error };
}
