/**
 * HomeFooter — 首页深色页脚（4 列链接 + 版权）。
 *
 * 职责：汇总全站主要入口（平台/查看器/资源/关于），复用既有 i18n key
 * （`nav.*` 等）与新加的 footer 文案。
 */

import type { JSX } from 'react';
import { Link } from 'react-router-dom';

import { useAppIntl } from '../../i18n';

/** 单列链接。 */
interface FooterLink {
  to: string;
  labelKey: string;
  defaultLabel: string;
}

const COLUMNS: Array<{ titleKey: string; links: FooterLink[] }> = [
  {
    titleKey: 'home.footer.col.platform',
    links: [
      { to: '/', labelKey: 'nav.home', defaultLabel: 'Home' },
      { to: '/database', labelKey: 'nav.database', defaultLabel: 'Database' },
      { to: '/compare', labelKey: 'nav.compare', defaultLabel: 'Compare' },
    ],
  },
  {
    titleKey: 'home.footer.col.viewers',
    links: [
      { to: '/explore/hic', labelKey: 'nav.tracks.hic', defaultLabel: 'Hi-C' },
      { to: '/explore/tracks', labelKey: 'nav.tracks', defaultLabel: 'Tracks' },
      { to: '/explore/3d', labelKey: 'nav.3d', defaultLabel: '3D' },
      { to: '/explore/ctcfMotif', labelKey: 'nav.ctcfMotif', defaultLabel: 'CTCF Motif' },
    ],
  },
  {
    titleKey: 'home.footer.col.resources',
    links: [
      { to: '/compare/cases', labelKey: 'home.compare.cases.title', defaultLabel: 'Browse curated cases' },
      { to: '/database', labelKey: 'home.footer.links.download', defaultLabel: 'Download data' },
      { to: '#home-features', labelKey: 'home.footer.links.docs', defaultLabel: 'Documentation' },
    ],
  },
  {
    titleKey: 'home.footer.col.about',
    links: [
      { to: '/compare', labelKey: 'home.footer.links.comparison', defaultLabel: 'Comparison workspace' },
      { to: '/database', labelKey: 'home.footer.links.samples', defaultLabel: 'Sample catalog' },
    ],
  },
];

/**
 * 页脚组件。
 *
 * @returns 深色页脚：4 列链接 + 底部版权条。
 */
export function HomeFooter(): JSX.Element {
  const { t } = useAppIntl();
  return (
    <footer className="home-footer">
      <div className="home-footer__inner">
        <div className="home-footer__brand">
          <b>dataWeb</b>
          <span>{t('site.footer.disclaimer')}</span>
          <span>{t('site.footer.noUpload')}</span>
        </div>
        <div className="home-footer__cols">
          {COLUMNS.map((col) => (
            <div key={col.titleKey} className="home-footer__col">
              <h4>{t(col.titleKey)}</h4>
              <ul>
                {col.links.map((link) => (
                  <li key={link.to + link.labelKey}>
                    <Link to={link.to}>{t(link.labelKey, link.defaultLabel)}</Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
      <div className="home-footer__bar">
        {t('home.footer.copyright')}
      </div>
    </footer>
  );
}
