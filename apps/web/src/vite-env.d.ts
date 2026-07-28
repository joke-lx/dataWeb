/**
 * Vite 环境变量 + 自定义资源模块的 ambient 声明。
 *
 * 职责：
 * 1. `/// <reference types="vite/client" />` 引入 Vite 内置的 `import.meta.env`
 *    类型（`MODE` / `DEV` / `PROD` / `BASE_URL` 等）以及 `?url` / `?raw` 后缀。
 * 2. 声明项目内用到但非 npm 维护的图形资源模块：GLSL 着色器、`.vert` / `.frag`
 *    后缀默认为字符串导入。
 *
 * 为什么必须在这里声明：浏览器侧没有运行时 Module Federation / loader 链，
 * 必须用 TS ambient 声明告诉编译器 `import xxx from './shader.glsl'`
 * 之类的语句是字符串字面量。
 */

/// <reference types="vite/client" />

/** GLSL 片段 + `?raw` 后缀：直接拿到着色器源码字符串。 */
declare module '*.glsl?raw' {
  const src: string;
  export default src;
}

/** GLSL 完整模块（依赖 vite-plugin-glsl 解析）。 */
declare module '*.glsl' {
  const src: string;
  export default src;
}

/** 顶点着色器（`.vert`）。 */
declare module '*.vert' {
  const src: string;
  export default src;
}

/** 片段着色器（`.frag`）。 */
declare module '*.frag' {
  const src: string;
  export default src;
}