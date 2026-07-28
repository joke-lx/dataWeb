/**
 * MissingModelFallback — 生产环境缺失模型的友好降级页。
 *
 * 架构位置：被 `ModelFactory` 在「registry 找不到 type + 非 dev 环境」时渲染。
 *
 * 为什么存在：dev 抛错帮开发者；生产环境不能让用户看到空白页或崩溃。
 * 这个组件用显眼的「!」标记 + 文本说明告诉用户「这个 viewer 暂时不可用」，
 * 给运维一个排错的窗口期。
 */
import type { JSX } from 'react';
import type { ModelType } from './types';
import './model-factory.css';

/**
 * MissingModelFallback 的 props。
 *
 * @property type 缺失的模型类型（显示在文案中以便排查）。
 */
interface MissingModelFallbackProps {
  type: ModelType;
}

/**
 * MissingModelFallback — prod-friendly placeholder shown when
 * `ModelFactory` is asked to render a `type` that isn't registered.
 *
 * In dev this branch is unreachable (we throw instead). In prod it
 * keeps the page from going blank so the user sees a useful message
 * while ops fix the missing registration.
 */
export function MissingModelFallback({ type }: MissingModelFallbackProps): JSX.Element {
  return (
    // role="alert" 让屏幕阅读器立刻播报，给辅助技术用户同样可感知。
    <div className="model-missing" role="alert">
      <div className="model-missing__badge">!</div>
      <div className="model-missing__body">
        <strong>Model unavailable</strong>
        <p>
          The viewer for <code>{type}</code> is temporarily unavailable.
          Please try a different route.
        </p>
      </div>
    </div>
  );
}

export default MissingModelFallback;