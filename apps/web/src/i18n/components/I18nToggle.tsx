/**
 * 语言切换器（中/英双语 tab）。
 *
 * 职责：把当前 locale 展示给用户，并允许切换。切换时**同时**：
 * 1. dispatch `setLocale` 到 RTK store → 触发 `<IntlProvider>` 重渲染；
 * 2. 写入 URL `?lang=` → 保持 URL 单一 source of truth（刷新可恢复）。
 *
 * 为什么 dispatch 与 URL 同步改：URL 是 source of truth，store 是 mirror。
 * 漏掉任何一个，下次刷新或被外部跳转覆盖 URL 时都会出现不一致。
 */

import { type JSX } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAppDispatch, useAppSelector, setLocale, type Locale } from '../store';
import './I18nToggle.css';

/**
 * 语言切换按钮组。
 * 用 `replace: true` 写 URL —— 多次切换不应污染浏览历史栈。
 */
export function I18nToggle(): JSX.Element {
  const dispatch = useAppDispatch();
  const locale = useAppSelector((s) => s.i18n.locale);
  const [, setParams] = useSearchParams();

  const toggle = (next: Locale) => {
    // 先 dispatch：store 是渲染的触发器；再写 URL：保持 source of truth 一致。
    dispatch(setLocale(next));
    setParams(
      (prev) => {
        prev.set('lang', next);
        return prev;
      },
      // 不留历史：避免每次切换都新加一个 history entry。
      { replace: true },
    );
  };

  return (
    <div className="i18n-toggle" role="tablist" aria-label="Language">
      <button
        role="tab"
        aria-selected={locale === 'en'}
        className={locale === 'en' ? 'active' : ''}
        onClick={() => toggle('en')}
      >
        EN
      </button>
      <button
        role="tab"
        aria-selected={locale === 'zh-CN'}
        className={locale === 'zh-CN' ? 'active' : ''}
        onClick={() => toggle('zh-CN')}
      >
        中文
      </button>
    </div>
  );
}
