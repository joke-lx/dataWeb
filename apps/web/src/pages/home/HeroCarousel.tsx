/**
 * HeroCarousel — 首页轮播图区域（无第三方依赖）。
 *
 * 职责：把 `HERO_SLIDES` 的 3 张 SVG 插画按时间自动轮播，并支持
 *  - hover 暂停
 *  - 左右箭头按钮手动切换（wrap-around）
 *  - 圆点手动跳转
 *  - tab 隐藏时暂停
 *
 * 实现要点：
 *  - 轨道用 flex + `translateX(-index*100%)` + transition，天然等宽；
 *  - 计时器在 `[index, paused]` effect 里创建并清理（手动点圆点/箭头会重置计时）；
 *  - StrictMode 双挂载安全：effect 清理会 clear 上一个 interval。
 *  - 箭头按钮走绝对定位，挂在 `.home-carousel` 上，
 *    与已存在的 `.home-carousel__dots` 互不干扰。
 */

import { useCallback, useEffect, useState, type JSX } from 'react';

import { useAppIntl } from '../../i18n';
import { HERO_SLIDES } from './heroSlides';

/** 自动轮换间隔（ms）。 */
const INTERVAL_MS = 6000;

/**
 * 轮播组件。
 *
 * @returns 含插画卡片 + 指示圆点 + 左右箭头按钮的轮播区域。
 */
export function HeroCarousel(): JSX.Element {
  const { t } = useAppIntl();
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (paused) return;
    const id = window.setInterval(() => {
      setIndex((prev) => (prev + 1) % HERO_SLIDES.length);
    }, INTERVAL_MS);
    return () => window.clearInterval(id);
  }, [index, paused]);

  // 上一张：手动 wrap-around（0 → 最后一张）
  const goPrev = useCallback((): void => {
    setIndex((prev) => (prev - 1 + HERO_SLIDES.length) % HERO_SLIDES.length);
  }, []);
  // 下一张：与 setInterval 内的逻辑一致（最后一张 → 0）
  const goNext = useCallback((): void => {
    setIndex((prev) => (prev + 1) % HERO_SLIDES.length);
  }, []);

  return (
    <section
      className="home-carousel"
      aria-roledescription="carousel"
      aria-label={t('home.carousel.label')}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <button
        type="button"
        className="home-carousel__nav home-carousel__nav--prev"
        onClick={goPrev}
        aria-label={t('home.carousel.prev')}
      >
        <span aria-hidden="true">‹</span>
      </button>

      <div
        className="home-carousel__track"
        style={{ transform: `translateX(-${index * 100}%)` }}
      >
        {HERO_SLIDES.map((slide, i) => (
          <div
            key={slide.id}
            className="home-carousel__slide"
            aria-hidden={i !== index}
          >
            <div className="home-carousel__art">
              <slide.Svg />
            </div>
            <div className="home-carousel__caption">
              <h2>{t(slide.titleKey)}</h2>
              <p>{t(slide.descKey)}</p>
            </div>
          </div>
        ))}
      </div>

      <button
        type="button"
        className="home-carousel__nav home-carousel__nav--next"
        onClick={goNext}
        aria-label={t('home.carousel.next')}
      >
        <span aria-hidden="true">›</span>
      </button>

      <div className="home-carousel__dots" role="tablist" aria-label={t('home.carousel.dots')}>
        {HERO_SLIDES.map((slide, i) => (
          <button
            key={slide.id}
            type="button"
            role="tab"
            aria-selected={i === index}
            className={i === index ? 'active' : ''}
            onClick={() => setIndex(i)}
            aria-label={`${t('home.carousel.dots')} ${i + 1}`}
          />
        ))}
      </div>
    </section>
  );
}