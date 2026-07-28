/**
 * i18n 子系统的对外 barrel。
 *
 * 职责：把所有 i18n 相关 export 汇聚到一个入口（hook、组件、RTK store、
 * URL 检测器），让上层 import 时不必了解目录结构。
 *
 * 为什么存在：避免上层 import 时写 `../../i18n/store/i18nSlice` 这种又深
 * 又绕的路径，并在重构子目录时上层不需要跟着改。
 *
 * 单一 source of truth：URL `?lang=` 是初始 locale 的唯一真理源；本模块
 * 内提供的 `detectLocaleFromUrl` + `setLocale` 完成读 / 写循环。
 */
export { useAppIntl } from './hooks/useAppIntl';
export { I18nToggle } from './components/I18nToggle';
export { detectLocaleFromUrl } from './url/localeFromUrl';
export {
  i18nStore,
  useAppDispatch,
  useAppSelector,
  setLocale,
} from './store';
export type { Locale } from './store/i18nSlice';
