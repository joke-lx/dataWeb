/**
 * Help — 使用帮助页（/help）。
 *
 * 职责：对齐参考站点主导航的 Help 入口，给出浏览、可视化、对比与下载的
 * 快速指引。内容为静态文本，全部走 i18n（zh/en）。
 */
import type { JSX } from 'react';

import { RouteShell } from '../../components/route/RouteShell';
import { useAppIntl } from '../../i18n';
import '../../styles/info.css';

/**
 * 帮助页面。
 *
 * @returns Help 页 JSX
 */
export function Help(): JSX.Element {
  const { t } = useAppIntl();

  return (
    <RouteShell title={t('help.title')} subtitle={t('help.subtitle')} breadcrumb="dataWeb">
      <div className="info-page">
        <section className="info-section">
          <h3>{t('help.nav.title')}</h3>
          <ul>
            <li>{t('help.nav.home')}</li>
            <li>{t('help.nav.dataset')}</li>
            <li>{t('help.nav.visual')}</li>
            <li>{t('help.nav.compar')}</li>
            <li>{t('help.nav.about')}</li>
            <li>{t('help.nav.help')}</li>
          </ul>
        </section>

        <section className="info-section">
          <h3>{t('help.browse.title')}</h3>
          <ul>
            <li>{t('help.browse.region')}</li>
            <li>{t('help.browse.zoom')}</li>
            <li>{t('help.browse.tracks')}</li>
            <li>{t('help.browse.3d')}</li>
            <li>{t('help.browse.ctcf')}</li>
          </ul>
        </section>

        <section className="info-section">
          <h3>{t('help.compare.title')}</h3>
          <ul>
            <li>{t('help.compare.self')}</li>
            <li>{t('help.compare.cases')}</li>
          </ul>
        </section>

        <section className="info-section">
          <h3>{t('help.download.title')}</h3>
          <ul>
            <li>{t('help.download.sample')}</li>
            <li>{t('help.download.database')}</li>
          </ul>
        </section>
      </div>
    </RouteShell>
  );
}

export default Help;
