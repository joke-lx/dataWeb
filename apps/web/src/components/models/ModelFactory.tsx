/**
 * ModelFactory — 所有 viewer 模型的统一入口。
 *
 * 架构位置：路由层（`routes/<name>/index.tsx`）调用此组件并传入 `type`，
 * 内部根据 `MODEL_REGISTRY` 找到对应的 lazy chunk 组件，挂到 Suspense
 * 下渲染。
 *
 * 为什么存在：避免路由层直接 import 每个模型组件（会强制全部打包到
 * 主 chunk）。通过「type 字符串 + lazy 组件表」实现按需加载、注册集中、
 * fail-loud 校验。详见 dataweb-work-flow ref1（ModelFactory pattern）。
 */
import { Suspense, type JSX } from 'react';
import type { ModelType } from './types';
import { MODEL_REGISTRY, ALL_MODEL_TYPES } from './registry';
import { ModelSkeleton } from './ModelSkeleton';
import { MissingModelFallback } from './MissingModelFallback';
import './model-factory.css';

/**
 * ModelFactory 的 props。
 *
 * @property type  要渲染的模型类型（注册表 key）
 * @property [key] 透传给底层模型组件的额外 props（用 `[key: string]: unknown`
 *                 保持「零耦合」约定——各模型独立决定自己接什么 prop）
 */
interface ModelFactoryProps {
  type: ModelType;
  [key: string]: unknown;
}

/**
 * ModelFactory — unified entry point for all viewer models.
 *
 * Usage: `<ModelFactory type="hic" />`
 *
 * Resolves `type` against the MODEL_REGISTRY, renders the matching
 * model component lazily with a Suspense fallback.
 *
 * Behavior on unknown `type`:
 *  - Dev: throws so the bug surfaces immediately during development.
 *  - Prod: renders `<MissingModelFallback />` so users see a friendly
 *    placeholder instead of a blank page.
 */
export function ModelFactory({ type, ...props }: ModelFactoryProps): JSX.Element {
  const Component = MODEL_REGISTRY[type];

  if (!Component) {
    // fail-loud 防御：dev 环境直接抛错，避免「忘注册 → 静默空白页」。
    // 生产环境降级为 MissingModelFallback，保证用户至少看到提示。
    if (import.meta.env.DEV) {
      throw new Error(
        `[ModelFactory] Unknown model type: "${type}". ` +
        `Valid types: ${ALL_MODEL_TYPES.join(', ')}. ` +
        `Did you forget to add it to MODEL_REGISTRY?`,
      );
    }
    return <MissingModelFallback type={type} />;
  }

  // Suspense + type-aware skeleton：异步加载模型 chunk 时展示对应形状的占位，
  // 避免「loading 跳变」给用户造成不连续感。
  return (
    <Suspense fallback={<ModelSkeleton type={type} />}>
      <Component {...props} />
    </Suspense>
  );
}

export default ModelFactory;