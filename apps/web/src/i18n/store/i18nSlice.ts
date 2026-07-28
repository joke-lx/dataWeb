/**
 * i18n RTK slice —— 仅承载当前 locale。
 *
 * 职责：维护一个极简的 `locale` 状态。整套 i18n 真正的"真理源"是 URL
 * `?lang=` 参数；本 slice 只在内存中镜像当前值，方便 react-redux 订阅
 * 来重渲染 `<IntlProvider>`。
 *
 * 为什么用 RTK 而不是 zustand：与 RTK 提供的 `useDispatch` / `useSelector`
 * 类型工具兼容（见 `i18n/store/index.ts`），并保留未来加 thunk / 持久化
 * 时的工具链一致性。
 *
 * 关键约束：dispatch `setLocale` 之前应当已经同步更新了 URL `?lang=`，否则
 * 当用户刷新页面时会回到 URL 中的旧语言——URL → store → IntlProvider
 * 构成单向数据流。
 */

import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

/** 当前支持的语种集合。 */
export type Locale = 'zh-CN' | 'en';

/** i18n slice 状态。 */
export interface I18nState {
  locale: Locale;
}

/** 初始状态：英文是 fallback（detector 会在 main.tsx 启动时覆盖）。 */
const initialState: I18nState = {
  locale: 'en',
};

/**
 * RTK slice。
 * 仅一个 action：`setLocale` —— 由 I18nToggle / URL 同步逻辑调用。
 */
export const i18nSlice = createSlice({
  name: 'i18n',
  initialState,
  reducers: {
    setLocale(state, action: PayloadAction<Locale>) {
      state.locale = action.payload;
    },
  },
});

/** 命名导出 action creator。 */
export const { setLocale } = i18nSlice.actions;

/** 命名导出 reducer，便于根 store 装配。 */
export const i18nReducer = i18nSlice.reducer;

/** 工具类型：state 的完整推断形式。 */
export type I18nSlice = ReturnType<typeof i18nSlice.getInitialState>;
