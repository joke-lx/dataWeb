/** Model type identifiers shared across all viewer routes.
 *
 * `ModelType` 是 models 子系统的核心字符串字面量联合：
 *  - 路由层用 `ModelFactory type="hic"` 之类的字符串传入
 *  - `registry.ts` 用它作为 `Record` 的 key，保证注册表穷举
 *  - `ModelFactory` 的 fail-loud 提示把它当作「合法 type 列表」展示
 *
 * 新增模型：先在这里加一个字符串字面量，再在 `registry.ts` 注册对应组件。
 * 注意字符串顺序：保持和注册表顺序一致，便于 grep 时定位。
 */
export type ModelType =
  | 'hic'
  | 'differential'
  | '3d'
  | 'ctcf-motif';
