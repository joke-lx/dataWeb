import { configureStore } from '@reduxjs/toolkit';
import { useDispatch, useSelector, type TypedUseSelectorHook } from 'react-redux';
import { i18nReducer, setLocale, type Locale } from './i18nSlice';

export const i18nStore = configureStore({
  reducer: { i18n: i18nReducer },
});

export type RootState = ReturnType<typeof i18nStore.getState>;
export type AppDispatch = typeof i18nStore.dispatch;

export const useAppDispatch: () => AppDispatch = useDispatch;
export const useAppSelector: TypedUseSelectorHook<RootState> = useSelector;

export { setLocale };
export type { Locale };
