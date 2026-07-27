import { lazy } from 'react';
import type { ComponentType } from 'react';
import type { ModelType } from './types';

/**
 * Model registry — maps each ModelType to its component.
 *
 * Components are lazy-loaded so each model chunks independently and the
 * factory never bundles models the current route isn't using.
 *
 * Access via `ModelFactory`, never directly.
 */
export const MODEL_REGISTRY: Record<ModelType, ComponentType> = {
  hic: lazy(() => import('./hic')),
  differential: lazy(() => import('./differential')),
  tracks: lazy(() => import('./tracks')),
  '3d': lazy(() => import('./3d')),
  'ctcf-motif': lazy(() => import('./ctcf-motif')),
};

/** Canonical list of all registered model types, derived from the registry keys. */
export const ALL_MODEL_TYPES = Object.keys(MODEL_REGISTRY) as ModelType[];
