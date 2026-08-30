/**
 * Home 页（Style E · Cool Slate）—— dataWeb 的唯一入口。
 *
 * 结构（自上而下）：
 *  1. HeroCarousel —— 3 张 SVG 插画自动轮播
 *  2. 居中搜索框 + 物种下拉 → 跳 /database?q=
 *  3. 三个 CTA 按钮：查看数据库 / 阅读文档 / 下载数据
 *  4. FeatureGrid —— 6 张 Key Features 卡片
 *  5. HomeFooter —— 深色 4 列链接 + 版权
 *
 * 文案全部走 i18n（en + zh-CN）。
 */

import { type JSX, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import { useAppIntl } from '../../i18n';
import { HeroCarousel } from './HeroCarousel';
import { FeatureGrid } from './FeatureGrid';
import { HomeFooter } from './HomeFooter';
import './home.css';

/**
 * Home 页组件。
 */
export function Home(): JSX.Element {
  const { t } = useAppIntl();
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [species, setSpecies] = useState('pig');

  const onSearch = (event: React.FormEvent) => {
    event.preventDefault();
    const q = query.trim();
    const params = new URLSearchParams();
    if (q) params.set('q', q);
    if (species) params.set('species', species);
    navigate(`/database?${params.toString()}`);
  };

  return (
    <main className="home-page">
      <HeroCarousel />

      {/* ── 搜索区 ── */}
      <section className="home-search-section">
        <form className="home-search" onSubmit={onSearch}>
          <label className="home-search__input-wrap">
            <span className="home-search__icon" aria-hidden="true" />
            <input
              className="home-search__input"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t('home.search.placeholder')}
              aria-label={t('common.sampleId')}
            />
          </label>
          <select
            className="home-search__select"
            aria-label={t('common.species')}
            value={species}
            onChange={(e) => setSpecies(e.target.value)}
          >
            <option value="pig">{t('common.species.pig')}</option>
            <option value="chicken">{t('common.species.chicken')}</option>
          </select>
          <button className="home-search__btn" type="submit">
            {t('common.search')}
          </button>
        </form>

        <div className="home-actions">
          <Link className="home-btn home-btn--filled" to="/database">
            {t('home.actions.database')}
          </Link>
          <button
            type="button"
            className="home-btn home-btn--outlined home-btn--disabled"
            disabled
            aria-disabled="true"
            title={t('home.actions.docsDisabledHint')}
          >
            {t('home.actions.docs')}
          </button>
          <Link className="home-btn home-btn--outlined" to="/database">
            {t('home.actions.download')}
          </Link>
        </div>
      </section>

      <FeatureGrid id="home-features" />
      <HomeFooter />
    </main>
  );
}

export default Home;
