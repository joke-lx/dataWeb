/**
 * Species 落地页：列出某个物种下按组织分组的全部样本。
 *
 * 职责：URL 上 `/species/:species` → 加载全局样本清单 → 按 `tissue` 分组
 * 渲染卡片网格。点击卡片进入 `/sample/:id`。
 *
 * 为什么是二级路由（不是顶级 tab）：它是 home 页 species 卡的"展开"，
 * semantic 上属于 landing → 详情关系，不参与主导航。
 */

import { useMemo, type JSX } from 'react';
import { Link, useParams } from 'react-router-dom';

import type { Sample } from '../../api/types';
import { RouteShell } from '../../components/route/RouteShell';
import { useSampleCatalog } from '../../hooks/useSampleCatalog';
import { useAppIntl } from '../../i18n';
import './species.css';

/**
 * Species 落地页。负责：
 * 1. 读取 URL `:species` 参数，找不到则默认 'pig'；
 * 2. 用 `useSampleCatalog` 拉取样本（与 Tracks 共享 TanStack 缓存）；
 * 3. 按 tissue 分组、locale 排序展示。
 *
 * 仅从 Home 页 species 卡片进入——不做主导航目标。
 */
export function Species(): JSX.Element {
  const { t } = useAppIntl();
  const { species: speciesId = 'pig' } = useParams<{ species: string }>();
  const { samples, isLoading, error } = useSampleCatalog();

  // 把样本按 tissue 归组并按 tissue 名字排序——中文/英文 locale 都能稳定排序。
  const grouped = useMemo<Array<[string, Sample[]]>>(() => {
    if (!samples) return [];
    const groups = new Map<string, Sample[]>();
    for (const s of samples) {
      if (s.species !== speciesId) continue;
      const arr = groups.get(s.tissue) ?? [];
      arr.push(s);
      groups.set(s.tissue, arr);
    }
    return Array.from(groups.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [samples, speciesId]);

  // 物种元数据：拉丁名 + 显示标题。
  const speciesMeta: Record<string, { latin: string; title: string }> = {
    pig: { latin: 'Sus scrofa', title: t('home.species.pig.latinName') },
    chicken: { latin: 'Gallus gallus', title: t('home.species.chicken.latinName') },
  };
  const meta = speciesMeta[speciesId] ?? { latin: speciesId, title: speciesId };

  return (
    <RouteShell title={meta.title} subtitle={meta.latin}>
      {isLoading && <div className="samples-state">{t('common.loading')}</div>}
      {error instanceof Error && (
        <div className="samples-state samples-state--error">
          {t('species.error', { message: error.message })}
        </div>
      )}
      {!isLoading && !error && (
        <div className="samples-grid">
          {grouped.length === 0 ? (
            <div className="samples-state">{t('species.emptyForSpecies')}</div>
          ) : (
            grouped.map(([tissue, items]) => (
              <section key={tissue} className="samples-group">
                <h3 className="samples-group__title">{tissue}</h3>
                <div className="samples-group__items">
                  {items.map((s) => (
                    <Link key={s.id} className="samples-card" to={`/sample/${s.id}`}>
                      <span className="samples-card__id">{s.id}</span>
                      <span className="samples-card__meta">
                        {s.breed} · {s.sex} · {s.dev_stage}
                      </span>
                    </Link>
                  ))}
                </div>
              </section>
            ))
          )}
        </div>
      )}
    </RouteShell>
  );
}

export default Species;