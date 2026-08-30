/**
 * CompareCase — `/compare/case/:id` 的最小化 client-side redirect。
 *
 * 职责:在渲染期间把"案例 id"翻译成具体 URL,然后用 `<Navigate replace />`
 * 让 react-router 把当前位置换成 `/sample/{a}?vs={b}&tab={t}&type={t}`。
 *
 * 为什么存在(以及为什么是组件而不是 redirect-loader):
 *  - 案例数据 (`COMPARE_CASES`) 来自代码而非后端 —— 不需要 loader;
 *  - `<Navigate replace>` 是 react-router 的标准 client-side redirect,
 *    渲染一次就同步把 history 换成新位置,无需额外的 fetch；
 *  - 让 Home 上的卡片点击 → 立即进入真正的 Sample 对比视图,
 *    不用经过 `/compare` 中转（用户体验上看不到中间页）。
 *
 * 边界:
 *  - 未知 id → 重定向到 `/compare`(让用户自己 A/B pick);
 *  - `tab` 始终写入 URL;`type` 仅在 case 显式设置时写入 —— Sample 页的
 *    `trackSubTab` 兜底逻辑会把缺失的 `?type=` 默认成 'ab'。
 */

import type { JSX } from 'react';
import { Navigate, useParams } from 'react-router-dom';

import { getCase } from './cases';

export function CompareCase(): JSX.Element {
  const { id = '' } = useParams<{ id: string }>();
  const c = getCase(id);

  if (!c) {
    // 未知 id(直接敲 URL 或已被移除的旧 case)→ 退回 /compare 由用户自选。
    return <Navigate to="/compare" replace />;
  }

  const search = new URLSearchParams({ vs: c.sampleB, tab: c.tab });
  if (c.type) search.set('type', c.type);
  return <Navigate to={`/sample/${c.sampleA}?${search.toString()}`} replace />;
}

export default CompareCase;
