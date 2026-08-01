/**
 * Home 页（Style D · Clean Academic）—— dataWeb 的唯一入口。
 *
 * 视觉：白底 + 深青绿 accent + 左对齐 hero + 右侧 Hi-C 可视化卡 +
 *       5 列 viewer 入口 + index-card 风格 species。
 * 文案全部走 i18n，跟之前一致。
 */

import { type JSX } from 'react';
import { Link } from 'react-router-dom';

import { COMPARE_CASES } from '../compare/cases';
import { useAppIntl } from '../../i18n';
import './home.css';

/**
 * Home 页组件。
 * 整页 i18n 通过 `useAppIntl().t` 拉取字符串，不依赖 react-intl 原始组件。
 */
export function Home(): JSX.Element {
  const { t } = useAppIntl();

  return (
    <main className="home-page">
      {/* ── Hero：左文案 + 右可视化卡 ── */}
      <section className="home-hero">
        <div className="home-hero__inner">
          <div className="home-hero__left">
            <div className="home-hero__eyebrow">{t('home.hero.eyebrow')}</div>
            <h1 className="home-hero__title">
              <span className="home-hero__title-accent">Multi-omics</span> 3D genome
              <br />
              browser.
            </h1>
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
              <select
                className="home-search__select"
                aria-label={t('common.species')}
                defaultValue="Pig"
              >
                <option value="Pig">Pig</option>
                <option value="Chicken">Chicken</option>
              </select>
              <button className="home-search__btn" type="submit">
                {t('common.search')}
              </button>
            </form>

            <div className="home-chips" aria-label="Sample suggestions">
              <span className="home-chips__label">Try</span>
              <button className="home-chip" type="button">Brain_BF3</button>
              <button className="home-chip" type="button">Liver_BF3</button>
              <button className="home-chip" type="button">Muscle_LR</button>
              <button className="home-chip" type="button">Heart_DLY</button>
            </div>
          </div>

          {/* 右：Hi-C 可视化卡 —— 纯装饰，aria-hidden */}
          <div className="home-hero__right" aria-hidden="true">
            <div className="home-hero__viz-head">
              <b>chr1 · 24.55–26.41 Mb</b>
              <div className="home-hero__viz-meta">
                <span>Hi-C <b>KR</b></span>
                <span>5 kb</span>
              </div>
            </div>
            <div className="home-hero__viz">
              <div className="home-hero__viz-hic" />
              <div className="home-hero__viz-loop" />
              <div className="home-hero__viz-axis">
                <span>26.4 Mb</span>
                <span>25.5 Mb</span>
                <span>24.6 Mb</span>
              </div>
              <div className="home-hero__viz-legend">
                <div><i style={{ background: 'var(--color-accent)' }} /> TAD body</div>
                <div><i style={{ background: '#1f5b9d' }} /> CTCF loop</div>
                <div><i style={{ background: '#2e7d4e' }} /> B compartment</div>
                <div><i style={{ background: '#9d2c44' }} /> A compartment</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── 5 个 viewer 入口 ── */}
      <section className="home-section">
        <div className="home-section__head">
          <div>
            <h2>Choose a viewer</h2>
            <p>Five linked perspectives on the same sample — open any of them and cross-link from the URL.</p>
          </div>
          <div className="home-section__count"><b>05</b> &nbsp;viewers</div>
        </div>

        <nav className="home-viewers" aria-label="Viewer types">
          <Link className="home-viewer" to="/sample/Brain_BF3?tab=hic">
            <div className="home-viewer__icon">▦</div>
            <h3>Hi-C</h3>
            <p>Contact matrix, TADs, CTCF loops, A/B compartments.</p>
            <span className="home-viewer__cue">→</span>
          </Link>
          <Link className="home-viewer" to="/sample/Brain_BF3?tab=tracks">
            <div className="home-viewer__icon">≋</div>
            <h3>Tracks</h3>
            <p>BigWig, bedGraph, gene models, PEI anchors.</p>
            <span className="home-viewer__cue">→</span>
          </Link>
          <Link className="home-viewer" to="/sample/Brain_BF3?tab=ctcfMotif">
            <div className="home-viewer__icon">⌁</div>
            <h3>CTCF Motif</h3>
            <p>Motif orientation, genotype pile, footprint.</p>
            <span className="home-viewer__cue">→</span>
          </Link>
          <Link className="home-viewer" to="/sample/Brain_BF3?tab=3d">
            <div className="home-viewer__icon">◇</div>
            <h3>3D Chromatin</h3>
            <p>Reconstructed 3D models, distance matrices.</p>
            <span className="home-viewer__cue">→</span>
          </Link>
          <Link className="home-viewer" to="/compare">
            <div className="home-viewer__icon">⇄</div>
            <h3>Δ Hi-C</h3>
            <p>Side-by-side differential contact map.</p>
            <span className="home-viewer__cue">→</span>
          </Link>
        </nav>
      </section>

      {/* ── Species 卡（index-card 风格，左 accent rule） ── */}
      <section className="home-section">
        <div className="home-section__head">
          <div>
            <h2>{t('home.species.title')}</h2>
            <p>{t('home.species.subtitle')}</p>
          </div>
          <div className="home-section__count"><b>02</b> &nbsp;species</div>
        </div>

        <div className="home-species-grid">
          <article className="home-species-card">
            <div className="home-species-card__accent" />
            <div className="home-species-card__body">
              <div className="home-species-card__latin">{t('home.species.pig.latinName')}</div>
              <h3>Pig</h3>
              <p className="home-species-card__desc">{t('home.species.pig.description')}</p>
              <div className="home-species-card__stats">
                <div className="home-species-card__stat">
                  <b>6</b><span>{t('home.species.pig.sampleCount')}</span>
                </div>
                <div className="home-species-card__stat">
                  <b>4</b><span>{t('home.species.pig.tissueCount')}</span>
                </div>
                <div className="home-species-card__stat">
                  <b>2</b><span>{t('home.species.pig.breedCount')}</span>
                </div>
              </div>
              <div className="home-species-card__tracks">
                <span>Hi-C</span><span>AB index</span><span>TAD</span><span>PEI</span>
                <span>RNA-seq</span><span>H3K4me3</span><span>H3K27ac</span>
                <span>CTCF ChIP-seq</span><span>SV</span>
              </div>
              <div className="home-species-card__cta">
                <Link to="/species/pig">{t('home.species.browse')}</Link>
                <span className="home-species-card__ref">ref · <b>Sscrofa11.1</b></span>
              </div>
            </div>
          </article>

          <article className="home-species-card home-species-card--alt">
            <div className="home-species-card__accent" />
            <div className="home-species-card__body">
              <div className="home-species-card__latin">{t('home.species.chicken.latinName')}</div>
              <h3>Chicken</h3>
              <p className="home-species-card__desc">{t('home.species.chicken.description')}</p>
              <div className="home-species-card__stats">
                <div className="home-species-card__stat">
                  <b>TBD</b><span>{t('home.species.pig.sampleCount')}</span>
                </div>
                <div className="home-species-card__stat">
                  <b>—</b><span>{t('home.species.pig.tissueCount')}</span>
                </div>
                <div className="home-species-card__stat">
                  <b>—</b><span>{t('home.species.pig.breedCount')}</span>
                </div>
              </div>
              <div className="home-species-card__tracks">
                <span>Hi-C</span><span>AB index</span><span>TAD</span><span>PEI</span>
                <span>RNA-seq</span><span>H3K4me3</span>
                <span>H3K27ac (CUT&amp;Tag)</span><span>SV</span>
                <span className="off">no CTCF ChIP-seq</span>
              </div>
              <div className="home-species-card__cta">
                <Link to="/species/chicken">{t('home.species.browse')}</Link>
                <span className="home-species-card__ref">ref · <b>GRCg6a</b></span>
              </div>
            </div>
          </article>
        </div>
      </section>

      {/* ── 复用对比模式 ── */}
      <section className="home-section">
        <div className="home-section__head">
          <div>
            <h2>{t('home.reuse.title')}</h2>
            <p>{t('home.reuse.subtitle')}</p>
          </div>
          <div className="home-section__count"><b>04</b> &nbsp;modes</div>
        </div>

        <div className="home-modes">
          <Link className="home-mode" to="/compare">
            <div className="home-mode__num">01 · TISSUE</div>
            <h3>Tissue</h3>
            <p>Compare chromatin organization and signal tracks across organs.</p>
            <div className="home-mode__pair"><code>Brain</code><span>vs</span><code>Liver</code></div>
          </Link>
          <Link className="home-mode" to="/compare">
            <div className="home-mode__num">02 · BREED</div>
            <h3>Breed</h3>
            <p>Inspect genomic differences between breeds within a species.</p>
            <div className="home-mode__pair"><code>BF3</code><span>vs</span><code>LR</code></div>
          </Link>
          <Link className="home-mode" to="/compare">
            <div className="home-mode__num">03 · CROSS</div>
            <h3>Reciprocal cross</h3>
            <p>Contrast parental-origin and reciprocal-cross datasets.</p>
            <div className="home-mode__pair"><code>BF3 × LR</code><span>vs</span><code>LR × BF3</code></div>
          </Link>
          <Link className="home-mode" to="/compare">
            <div className="home-mode__num">04 · TIME</div>
            <h3>Developmental</h3>
            <p>Follow 3D genome features across developmental time points.</p>
            <div className="home-mode__pair"><code>E30</code><span>vs</span><code>Adult</code></div>
          </Link>
        </div>
      </section>

      {/* ── 对比案例库 ── */}
      <section className="home-section" id="cases">
        <div className="home-section__head">
          <div>
            <h2>{t('home.cases.title')}</h2>
            <p>{t('home.cases.subtitle')}</p>
          </div>
          <div className="home-section__count"><b>{String(COMPARE_CASES.length).padStart(2, '0')}</b> &nbsp;cases</div>
        </div>
        <div className="home-cases-grid">
          {COMPARE_CASES.map((c, i) => (
            <article key={c.id} className="home-case-card">
              <div className="home-case-card__index">
                {String(i + 1).padStart(2, '0')}&nbsp;/&nbsp;VS
              </div>
              <h3>{t(c.titleKey)}</h3>
              <p>{t(c.subtitleKey)}</p>
              <div className="home-case-card__pair">
                <code>{c.sampleA}</code>
                <span className="home-case-card__vs">vs</span>
                <code>{c.sampleB}</code>
              </div>
              <Link className="home-btn" to={`/compare/case/${c.id}`}>
                Open →
              </Link>
            </article>
          ))}
        </div>
      </section>

      <footer className="home-footer">
        <div>
          <b>dataWeb</b> · {t('site.footer.disclaimer')} · {t('site.footer.noUpload')}
        </div>
        <div className="home-footer__doc">build · <b>MMXXVI · 08</b></div>
      </footer>
    </main>
  );
}

export default Home;