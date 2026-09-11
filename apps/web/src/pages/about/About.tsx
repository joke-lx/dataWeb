/**
 * About — 项目介绍页（/about）。
 *
 * 职责：对齐参考站点主导航的 About 入口，介绍 dataWeb 的定位、数据范围、
 * 核心功能与技术栈。内容为静态文本，全部走 i18n（zh/en）。
 */
import type { JSX } from 'react';

import { RouteShell } from '../../components/route/RouteShell';
import { useAppIntl } from '../../i18n';
import '../../styles/info.css';

/**
 * 关于页面。
 *
 * @returns About 页 JSX
 */
export function About(): JSX.Element {
  const { t } = useAppIntl();

  return (
    <RouteShell title={t('about.title')} subtitle={t('about.subtitle')} breadcrumb="dataWeb">
      <div className="info-page">
        <section className="info-section">
          <h3>{t('about.overview.title')}</h3>
          <p>{t('about.overview.body')}</p>
          <p>{t('about.overview.body2')}</p>
        </section>

        <section className="info-section">
          <h3>{t('about.data.title')}</h3>
          <ul>
            <li>{t('about.data.tissues')}</li>
            <li>{t('about.data.omics')}</li>
            <li>{t('about.data.derived')}</li>
          </ul>
        </section>

        <section className="info-section">
          <h3>{t('about.features.title')}</h3>
          <ul>
            <li>{t('about.features.viz')}</li>
            <li>{t('about.features.compare')}</li>
            <li>{t('about.features.download')}</li>
          </ul>
        </section>

        <section className="info-section">
          <h3>{t('about.tech.title')}</h3>
          <p>{t('about.tech.body')}</p>
        </section>
      </div>
    </RouteShell>
  );
}

export default About;
