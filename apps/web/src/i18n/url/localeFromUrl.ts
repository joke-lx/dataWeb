/**
 * 从 URL 解析当前 locale —— i18n 启动时的"真理源"。
 *
 * 职责：按 URL `?lang=` → 浏览器语言 → 英文 fallback 的顺序决定初始 locale。
 * 与 `I18nToggle` 切换时同步写入 `?lang=` 配合，构成 URL 单一 source of truth。
 *
 * 为什么必须是纯函数且同步：在 `main.tsx` 渲染前就要得到 locale（用于
 * 初始化 RTK store），不能在这里引入 async / hook。
 *
 * 三级 fallback 顺序：
 *   1. URL `?lang=zh-CN` / `?lang=en` 显式指定
 *   2. `navigator.language` 前缀为 `zh` → 'zh-CN'
 *   3. 默认 'en'
 */

import type { Locale } from '../store/i18nSlice';

/**
 * 检测初始 locale。
 * - `params`: `new URLSearchParams(window.location.search)` 或等价的 map
 * - `navigatorLanguage`: 浏览器设置；测试时可注入
 */
export function detectLocaleFromUrl(
  params: URLSearchParams,
  navigatorLanguage?: string,
): Locale {
  // 优先级最高：URL 显式指定。
  const lang = params.get('lang');
  if (lang === 'zh-CN') return 'zh-CN';
  if (lang === 'en') return 'en';
  // 次级：浏览器偏好。所有 zh-*（zh-CN / zh-TW / zh-HK）都归并到 'zh-CN'，
  // 因为本项目只维护这一个中文 locale。
  if (navigatorLanguage && navigatorLanguage.startsWith('zh')) return 'zh-CN';
  // 最终回退：英文。
  return 'en';
}
