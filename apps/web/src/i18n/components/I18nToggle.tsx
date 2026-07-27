import { type JSX } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAppDispatch, useAppSelector, setLocale, type Locale } from '../store';
import './I18nToggle.css';

export function I18nToggle(): JSX.Element {
  const dispatch = useAppDispatch();
  const locale = useAppSelector((s) => s.i18n.locale);
  const [, setParams] = useSearchParams();

  const toggle = (next: Locale) => {
    dispatch(setLocale(next));
    setParams(
      (prev) => {
        prev.set('lang', next);
        return prev;
      },
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
