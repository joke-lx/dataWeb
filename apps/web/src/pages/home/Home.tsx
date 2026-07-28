import { type JSX } from 'react';

import { useAppIntl } from '../../i18n';
import './home.css';

const COMPARISON_MODES = ['tissue', 'breed', 'cross', 'developmental'] as const;

export function Home(): JSX.Element {
  const { t } = useAppIntl();

  return (
    <main className="home-page">
      {/* ── Hero ── */}
      <section className="home-hero">
        <div className="home-hero__inner">
          <div className="home-hero__eyebrow">{t('home.hero.eyebrow')}</div>
          <h1 className="home-hero__title">{t('home.hero.title')}</h1>
          <p className="home-hero__lede">{t('home.hero.lede')}</p>

          <form className="home-search" onSubmit={(e) => e.preventDefault()}>
            <label className="home-search__input-wrap">
              <span className="home-search__icon" aria-hidden="true" />
              <input
                className="home-search__input"
                placeholder={t('home.search.placeholder')}
                aria-label={t('common.sampleId')}
              />
            </label>
            <button className="home-search__btn" type="submit">
              {t('common.search')}
            </button>
          </form>

          <nav className="home-quick-links" aria-label="Quick entry points">
            <a className="home-quick-link" href="/species/pig" title="Browse a sample">
              <span className="home-quick-link__glyph">▦</span>{t('nav.hic')}
            </a>
            <a className="home-quick-link" href="/sample/Brain_BF3?vs=Liver_BF3" title="Compare two samples">
              <span className="home-quick-link__glyph">Δ</span>{t('nav.differential')}
            </a>
          </nav>
        </div>
      </section>

      <section className="home-section">
        <div className="home-section__head">
          <h2>{t('home.species.title')}</h2>
          <p>{t('home.species.subtitle')}</p>
        </div>
        <div className="home-species-grid">
          <article className="home-species-card">
            <div className="home-species-card__top">
              <div>
                <div className="home-species-card__latin">{t('home.species.pig.latinName')}</div>
                <h3>Pig</h3>
                <p className="home-species-card__desc">{t('home.species.pig.description')}</p>
              </div>
              <a className="home-btn" href="/species/pig">{t('home.species.browse')}</a>
            </div>
            <div className="home-species-card__stats">
              <div className="home-species-card__stat"><b>6</b><span>{t('home.species.pig.sampleCount')}</span></div>
              <div className="home-species-card__stat"><b>4</b><span>{t('home.species.pig.tissueCount')}</span></div>
              <div className="home-species-card__stat"><b>2</b><span>{t('home.species.pig.breedCount')}</span></div>
            </div>
          </article>
          <article className="home-species-card">
            <div className="home-species-card__top">
              <div>
                <div className="home-species-card__latin">{t('home.species.chicken.latinName')}</div>
                <h3>Chicken</h3>
                <p className="home-species-card__desc">{t('home.species.chicken.description')}</p>
              </div>
              <a className="home-btn" href="/species/chicken">{t('home.species.browse')}</a>
            </div>
            <div className="home-species-card__stats">
              <div className="home-species-card__stat"><b>TBD</b><span>{t('home.species.pig.sampleCount')}</span></div>
              <div className="home-species-card__stat"><b>—</b><span>{t('home.species.pig.tissueCount')}</span></div>
              <div className="home-species-card__stat"><b>—</b><span>{t('home.species.pig.breedCount')}</span></div>
            </div>
          </article>
        </div>
      </section>

      <section className="home-section" id="comparison">
        <div className="home-section__head">
          <h2>{t('home.comparison.title')}</h2>
          <p>{t('home.comparison.subtitle')}</p>
        </div>
        <div className="home-mode-grid">
          {COMPARISON_MODES.map((mode, i) => (
            <article key={mode} className="home-mode">
              <div className="home-mode__index">
                {String(i + 1).padStart(2, '0')}&nbsp;/&nbsp;{mode.toUpperCase()}
              </div>
              <h3>{t(`home.comparison.${mode}.title`)}</h3>
              <p>{t(`home.comparison.${mode}.description`)}</p>
            </article>
          ))}
        </div>
      </section>

      <footer className="home-footer">
        <span>{t('site.footer.disclaimer')}</span>
        <span>{t('site.footer.noUpload')}</span>
      </footer>
    </main>
  );
}

export default Home;
