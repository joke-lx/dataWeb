/**
 * models 子系统的对外公共 API。
 *
 * 路由层和其它业务模块只应该从这个 barrel 导入，避免直接深入到
 * `ModelFactory.tsx` / `registry.ts` 等内部实现文件，便于后续重构。
 *
 * 故意不导出 `ModelSkeleton`、`MissingModelFallback`、`ALL_MODEL_TYPES`：
 * 这三者都只服务于 `ModelFactory` 内部，外部不应该绕过工厂直接使用。
 * `ModelType` 以 `type` 关键字导出，确保它作为纯类型被擦除。
 */
export { ModelFactory } from './ModelFactory';
export { MODEL_REGISTRY } from './registry';
export type { ModelType } from './types';
