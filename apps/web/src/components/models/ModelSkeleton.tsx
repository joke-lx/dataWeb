/**
 * ModelSkeleton — 模型加载时的 type-aware 占位符。
 *
 * 架构位置：被 `ModelFactory` 的 `<Suspense fallback>` 引用；只在异步
 * chunk 下载期间出现。一旦模型组件挂载完成就立即被替换。
 *
 * 为什么存在：统一的「Loading…」文字给用户造成「跳变 + 不知道加载什么」
 * 的感觉。type-aware skeleton 提前画出对应模型的轮廓（3d 立体块、
 * ctcf 双块、其它 3 lane），让加载过渡更平滑，也暗示用户「你点的模型存在」。
 */
import type { JSX } from 'react';
import type { ModelType } from './types';
import './model-factory.css';

/**
 * ModelSkeleton 的 props。
 *
 * @property type 用于决定骨架形状的模型类型。
 */
interface ModelSkeletonProps {
  type: ModelType;
}

/**
 * ModelSkeleton — 模型 chunk 加载时的 type-aware 占位符。
 *
 * 模拟每个模型的视觉形状，让用户在 Suspense fallback 期间感受到
 * 连续性，而不是看到 "Loading…" 标记。 */
export function ModelSkeleton({ type }: ModelSkeletonProps): JSX.Element {
  // 根据模型类型选择布局。每个模型得到一个与其最终渲染形态大致匹配的
  // 形状，让过渡感觉稳定而不是布局跳动。
  // 3D viewer：三个堆叠的横向条，暗示「立体多视角」的层次。
  if (type === '3d') {
    return (
      <div className="model-skeleton" data-type="3d">
        <div className="skeleton-row" />
        <div className="skeleton-row" />
        <div className="skeleton-row" />
      </div>
    );
  }
  // CTCF motif viewer：高 + 宽两块，暗示 motif logo + 饼图的布局。
  if (type === 'ctcf-motif') {
    return (
      <div className="model-skeleton" data-type="ctcf-motif">
        <div className="skeleton-block skeleton-block--tall" />
        <div className="skeleton-block skeleton-block--wide" />
      </div>
    );
  }
  // hic, differential, tracks 共享「垂直 lane 堆叠」形态。
  // hic, differential, tracks 共享「垂直 lane 堆叠」形态。
  return (
    <div className="model-skeleton" data-type="lanes">
      <div className="skeleton-lane" />
      <div className="skeleton-lane" />
      <div className="skeleton-lane" />
    </div>
  );
}

export default ModelSkeleton;