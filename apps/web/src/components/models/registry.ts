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
 *
 * 注册表语义：
 *  - 每个模型文件夹（`./hic`、`./differential` …）导出一个默认组件
 *  - 通过 `lazy()` 拆 chunk，访问该 viewer 路由时才下载对应代码
 *  - 漏注册会被 `ModelFactory` 的 fail-loud 逻辑捕获
 *
 * 新增模型时按此模板加一行：`<name>: lazy(() => import('./<name>'))`，
 * 并把 `<name>` 加入 `./types.ts` 的 `ModelType` 联合。
 */
export const MODEL_REGISTRY: Record<ModelType, ComponentType> = {
  hic: lazy(() => import('./hic')),
  differential: lazy(() => import('./differential')),
  '3d': lazy(() => import('./3d')),
  'ctcf-motif': lazy(() => import('./ctcf-motif')),
};

/**
 * Canonical list of all registered model types, derived from the registry keys.
 *
 * 从注册表的 key 派生，避免另写一份常量导致两边不同步。
 * 转换时用 `as ModelType[]` 而不是 `as string[]`，保留联合类型让
 * `ModelFactory` 的错误提示能精确到合法 type 列表。
 */
export const ALL_MODEL_TYPES = Object.keys(MODEL_REGISTRY) as ModelType[];
