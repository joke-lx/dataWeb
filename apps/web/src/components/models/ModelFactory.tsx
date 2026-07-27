import { Suspense, type JSX } from 'react';
import type { ModelType } from './types';
import { MODEL_REGISTRY, ALL_MODEL_TYPES } from './registry';
import { ModelSkeleton } from './ModelSkeleton';
import { MissingModelFallback } from './MissingModelFallback';
import './model-factory.css';

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
    if (import.meta.env.DEV) {
      throw new Error(
        `[ModelFactory] Unknown model type: "${type}". ` +
        `Valid types: ${ALL_MODEL_TYPES.join(', ')}. ` +
        `Did you forget to add it to MODEL_REGISTRY?`,
      );
    }
    return <MissingModelFallback type={type} />;
  }

  return (
    <Suspense fallback={<ModelSkeleton type={type} />}>
      <Component {...props} />
    </Suspense>
  );
}

export default ModelFactory;