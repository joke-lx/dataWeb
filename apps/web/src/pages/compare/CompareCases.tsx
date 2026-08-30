/**
 * CompareCases — `/compare/cases` 路由：列出 `COMPARE_CASES` 全部预设。
 *
 * 职责:
 *  1. 用 `RouteShell` 提供与 `/compare` 一致的页面框架(标题 + 副标题 + 容器);
 *  2. 把 8 条预设渲染成网格卡，卡内 link 走 `/compare/case/:id` →
 *     `CompareCase.tsx` 的 `<Navigate replace>` 直跳到 `/sample?vs=` 视图;
 *  3. 文案全部走 i18n(`home.cases.*`)—— 与原来 Home 上的同一份文案，迁移过来
 *     后文案 key 不变，避免重译。
 *
 * 为什么存在:
 *  Home 页的 "对比案例库" 8-card 网格曾直接展示；本次重构后 Home 只剩
 *  2 个 card btn入口（自行选择 + 从案例查看）,"从案例查看" 指向本路由。
 *  保持 8 条 case 与 Home 之前的视觉风格一致(grid、index、左 accent rule)
 *  让用户从 Home 跳过来时感受延续。
 *
 * 边界:
 *  - 无 sample 数据加载:cases 是静态代码常量,不依赖 catalog;
 *  - 不做分页/筛选 —— 8 条预设保持一次性展示即可;
 *  - 跳转到 `/compare/case/:id` 后由 `CompareCase.tsx` 解析失败时兜底到
 *    `/compare`,这里不重复该逻辑。
 */

import { type JSX } from 'react';
import { Link } from 'react-router-dom';

import { RouteShell } from '../../components/route/RouteShell';
import { useAppIntl } from '../../i18n';
import { COMPARE_CASES } from './cases';
import './compare-cases.css';

export function CompareCases(): JSX.Element {
  const { t } = useAppIntl();

  return (
    <RouteShell title={t('home.cases.title')} subtitle={t('home.cases.subtitle')}>
      <div className="cases-grid">
        {COMPARE_CASES.map((c, i) => (
          <article key={c.id} className="cases-card">
            <div className="cases-card__index">
              {String(i + 1).padStart(2, '0')}&nbsp;/&nbsp;VS
            </div>
            <h3 className="cases-card__title">{t(c.titleKey)}</h3>
            <p className="cases-card__desc">{t(c.subtitleKey)}</p>
            <div className="cases-card__pair">
              <code>{c.sampleA}</code>
              <span className="cases-card__vs">vs</span>
              <code>{c.sampleB}</code>
            </div>
            <Link className="cases-card__open" to={`/compare/case/${c.id}`}>
              Open →
            </Link>
          </article>
        ))}
      </div>
    </RouteShell>
  );
}

export default CompareCases;