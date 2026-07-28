/**
 * Tracks 路由中"多样本叠加"选择的 URL 驱动 hook。
 *
 * 职责：把 sample ids 的状态挂在 URL `?samples=` 上，而不是另起一个 store。
 * 解析时遵守三态语义（缺失 / 显式空 / 显式列表），保证刷新页面 / 复制链接
 * 都能恢复完全一致的状态。
 *
 * 为什么独立 hook：与 `samples` store 中的 `active`（Hi-C / 3D / Differential
 * 使用）解耦——这是两件事，混在一起会让主 viewer 拖着 catalog 副作用。
 */

import { useCallback, useMemo } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import { useSearchParams } from 'react-router-dom';

import { useActiveSample } from './useActiveSample';

/**
 * `/tracks` 路由的 bigwig track 上多样本叠加选择的 URL 驱动 hook。
 *
 * 语义（URL `?samples=`）：
 *   - **缺失**    → 回退到 `[active ?? 'Brain_BF3']`（首次渲染）
 *   - `samples=`   → 显式空（未选择任何样本）
 *   - `samples=A,B,C` → 规范排序列表 `['A','B','C']`
 *
 * 本 hook 是 picker 的*唯一*真理源——不在全局 `samples` store 中镜像。
 * 这使 `active`（由 Hi-C / 3D / Differential 使用）与叠加选择完全解耦。
 *
 * `setter` 使用 `setParams` 的回调形式，以便在更新时保留所有 sibling 键
 *（`type` 以及未来的键）。
 */
export function useTrackSampleSelection(): {
  sampleIds: string[];
  hasExplicit: boolean;
  setSampleIds: Dispatch<SetStateAction<string[]>>;
  setSampleIdsRaw: (next: string[]) => void;
} {
  const [params, setParams] = useSearchParams();
  const active = useActiveSample();

  const raw = params.get('samples');
  // 是否"用户显式设置过"——区分默认 fallback 与用户真实选择，picker UI 需要这个信号。
  const hasExplicit = raw !== null;

  const sampleIds = useMemo<string[]>(() => {
    if (raw === null) {
      // 缺失：回退到 active sample（或默认 Brain_BF3）——pick 尚未打开时的语义。
      return [active ?? 'Brain_BF3'];
    }
    if (raw === '') {
      // 显式空：用户打开 picker 并以空选中提交，不要合成 fallback。
      return [];
    }
    // 列表：trim + 过滤空段 + 排序——确保 URL 序列化有 canonical 形式。
    return raw
      .split(',')
      .map((s) => s.trim())
      .filter((s) => s.length > 0)
      .sort();
  }, [raw, active]);

  // 写入 URL 时同样去重 + 排序；空数组保留键以维持"显式空"语义。
  const setSampleIdsRaw = useCallback(
    (next: string[]) => {
      const canonical = Array.from(new Set(next)).sort();
      setParams(
        (prev) => {
          if (canonical.length === 0) {
            // 保留空值以便下次 hydrate 仍能识别为"显式空"。
            prev.set('samples', '');
          } else {
            prev.set('samples', canonical.join(','));
          }
          return prev;
        },
        { replace: false },
      );
    },
    [setParams],
  );

  // 适配 React 风格的 `setState(prev => ...)` 调用，向下转发到 raw setter。
  const setSampleIds = useCallback<Dispatch<SetStateAction<string[]>>>(
    (updater) => {
      setSampleIdsRaw(typeof updater === 'function' ? updater(sampleIds) : updater);
    },
    [setSampleIdsRaw, sampleIds],
  );

  return { sampleIds, hasExplicit, setSampleIds, setSampleIdsRaw };
}