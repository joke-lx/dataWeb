/**
 * FeatureGrid — 首页 Key Features 卡片区。
 *
 * 职责：把 6 个核心能力展示成 2×3 卡片网格，每张卡是跳转到对应页面/深链的
 * `<Link>`。图标用 @ant-design/icons（Home 是 lazy chunk，icons 不进入主包）。
 */

import type { JSX } from 'react';
import { Link } from 'react-router-dom';
import {
  AreaChartOutlined,
  CloudDownloadOutlined,
  ColumnHeightOutlined,
  ExperimentOutlined,
  HeatMapOutlined,
  NodeIndexOutlined,
} from '@ant-design/icons';

import { useAppIntl } from '../../i18n';

/** 单张 feature 卡片的声明。 */
interface FeatureDef {
  to: string;
  icon: JSX.Element;
  titleKey: string;
  descKey: string;
}

/** 6 张卡片：图标 + 文案 + 跳转目标。 */
const FEATURES: readonly FeatureDef[] = [
  {
    to: '/sample/Brain_BF3?tab=hic',
    icon: <HeatMapOutlined />,
    titleKey: 'home.features.f1.title',
    descKey: 'home.features.f1.desc',
  },
  {
    to: '/sample/Brain_BF3?tab=tracks',
    icon: <AreaChartOutlined />,
    titleKey: 'home.features.f2.title',
    descKey: 'home.features.f2.desc',
  },
  {
    to: '/sample/Brain_BF3?tab=3d',
    icon: <NodeIndexOutlined />,
    titleKey: 'home.features.f3.title',
    descKey: 'home.features.f3.desc',
  },
  {
    to: '/sample/Brain_BF3?tab=ctcfMotif',
    icon: <ExperimentOutlined />,
    titleKey: 'home.features.f4.title',
    descKey: 'home.features.f4.desc',
  },
  {
    to: '/compare',
    icon: <ColumnHeightOutlined />,
    titleKey: 'home.features.f5.title',
    descKey: 'home.features.f5.desc',
  },
  {
    to: '/database',
    icon: <CloudDownloadOutlined />,
    titleKey: 'home.features.f6.title',
    descKey: 'home.features.f6.desc',
  },
];

/**
 * Key Features 网格。
 *
 * @param props - 可选 `id` 用于页内锚点（如 `#home-features`）。
 */
export function FeatureGrid({ id }: { id?: string }): JSX.Element {
  const { t } = useAppIntl();
  return (
    <section className="home-features" id={id}>
      <div className="home-features__head">
        <h2>{t('home.features.title')}</h2>
        <p>{t('home.features.subtitle')}</p>
      </div>
      <div className="home-features__grid">
        {FEATURES.map((f) => (
          <Link key={f.titleKey} className="home-feature-card" to={f.to}>
            <span className="home-feature-card__icon">{f.icon}</span>
            <h3>{t(f.titleKey)}</h3>
            <p>{t(f.descKey)}</p>
          </Link>
        ))}
      </div>
    </section>
  );
}
