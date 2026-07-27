import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

export type Locale = 'zh-CN' | 'en';

export interface I18nState {
  locale: Locale;
}

const initialState: I18nState = {
  locale: 'en',
};

export const i18nSlice = createSlice({
  name: 'i18n',
  initialState,
  reducers: {
    setLocale(state, action: PayloadAction<Locale>) {
      state.locale = action.payload;
    },
  },
});

export const { setLocale } = i18nSlice.actions;

export const i18nReducer = i18nSlice.reducer;

export type I18nSlice = ReturnType<typeof i18nSlice.getInitialState>;
