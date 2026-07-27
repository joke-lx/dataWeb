import type { Locale } from '../store/i18nSlice';

export function detectLocaleFromUrl(
  params: URLSearchParams,
  navigatorLanguage?: string,
): Locale {
  const lang = params.get('lang');
  if (lang === 'zh-CN') return 'zh-CN';
  if (lang === 'en') return 'en';
  if (navigatorLanguage && navigatorLanguage.startsWith('zh')) return 'zh-CN';
  return 'en';
}
