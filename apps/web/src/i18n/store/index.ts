/**
 * i18n 全局 RTK store + 类型化 hooks。
 *
 * 职责：创建一个独立的、仅含 i18n slice 的 store（不复用其他业务 store）。
 * 配套导出 `useAppDispatch` / `useAppSelector`，均已绑定 RootState /
 * AppDispatch 类型。
 *
 * 为什么独立 store：i18n 是横切关注点，且 boot 阶段（main.tsx 同步检测
 * URL locale）需要在 `<Provider>` 挂载之前就 dispatch `setLocale`，独立
 * store 便于模块顶部调用。
 *
 * 数据流（"URL ?lang= 单一 source of truth"）：
 *   1. main.tsx 解析 URL → 立即 `dispatch(setLocale(...))`
 *   2. 后续 I18nToggle 切换时同时 dispatch + 更新 URL `?lang=`
 *   3. 组件通过 `useAppSelector` 读取
 */

import { configureStore } from '@reduxjs/toolkit';
import { useDispatch, useSelector, type TypedUseSelectorHook } from 'react-redux';
import { i18nReducer, setLocale, type Locale } from './i18nSlice';

/**
 * 全局 store：仅承载 i18n slice。
 * 它在 `<Provider store={i18nStore}>` 内使用，并由 main.tsx 在 Provider 挂载
 * 之前同步派发初始 `setLocale`。
 */
export const i18nStore = configureStore({
  reducer: { i18n: i18nReducer },
});

/** Root state 类型（用于 useSelector 推断）。 */
export type RootState = ReturnType<typeof i18nStore.getState>;
/** Dispatch 类型（用于 useDispatch 推断）。 */
export type AppDispatch = typeof i18nStore.dispatch;

/** 类型化的 `useDispatch`，配合 `AppDispatch` 推断 thunks / payloads。 */
export const useAppDispatch: () => AppDispatch = useDispatch;
/** 类型化的 `useSelector`，已绑定 RootState。 */
export const useAppSelector: TypedUseSelectorHook<RootState> = useSelector;

// 重新导出 slice 中的 action + 类型，方便上层统一从 `@/i18n` 引入。
export { setLocale };
export type { Locale };
