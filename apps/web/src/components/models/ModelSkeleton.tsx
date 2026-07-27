import type { JSX } from 'react';
import type { ModelType } from './types';
import './model-factory.css';

interface ModelSkeletonProps {
  type: ModelType;
}

/**
 * ModelSkeleton — type-aware loading placeholder for model chunks.
 *
 * Mimics the visual shape of each model so the user perceives continuity
 * during Suspense fallbacks rather than "Loading…" stubs.
 */
export function ModelSkeleton({ type }: ModelSkeletonProps): JSX.Element {
  // Pick a layout based on the model type. Each model gets a shape that
  // roughly matches its eventual rendered form so the transition feels
  // stable instead of a layout jump.
  if (type === '3d') {
    return (
      <div className="model-skeleton" data-type="3d">
        <div className="skeleton-row" />
        <div className="skeleton-row" />
        <div className="skeleton-row" />
      </div>
    );
  }
  if (type === 'ctcf-motif') {
    return (
      <div className="model-skeleton" data-type="ctcf-motif">
        <div className="skeleton-block skeleton-block--tall" />
        <div className="skeleton-block skeleton-block--wide" />
      </div>
    );
  }
  // hic, differential, tracks all share a vertical-lane layout.
  return (
    <div className="model-skeleton" data-type="lanes">
      <div className="skeleton-lane" />
      <div className="skeleton-lane" />
      <div className="skeleton-lane" />
    </div>
  );
}

export default ModelSkeleton;