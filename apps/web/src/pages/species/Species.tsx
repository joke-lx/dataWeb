/**
 * Species 落地页：列出某个物种下按组织分组的全部样本。
 *
 * 职责：URL 上 `/species/:species` → 加载全局样本清单 → 按 `tissue` 分组
 * 渲染卡片网格。点击卡片进入 `/sample/:id`。
 *
 * 设计：Explorer 模式
 * - 左侧栏：组织 + 品种筛选（sticky）
 * - 搜索框 + 排序下拉
 * - 横向卡片布局：icon + 名称 + 元数据 + 箭头
 */

import { useMemo, useState, type JSX } from 'react';
import { Link, useParams } from 'react-router-dom';

import type { Sample } from '../../api/types';
import { RouteShell } from '../../components/route/RouteShell';
import { ArrowIcon, SearchIcon, tissueIcon } from '../../components/icons/tissueIcons';
import { useSampleCatalog } from '../../hooks/useSampleCatalog';
import { useAppIntl } from '../../i18n';
import './species.css';

// ── Helpers ─────────────────────────────────────────────────────────────────

const TISSUE_DOT: Record<string, string> = {
  Brain: 'td-brain',
  Liver: 'td-liver',
  Muscle: 'td-muscle',
};

function tissueMeta(tissue: string): { icon: () => JSX.Element; dot: string } {
  return { icon: tissueIcon(tissue), dot: TISSUE_DOT[tissue] ?? 'td-other' };
}

type SortMode = 'id' | 'breed' | 'tissue';

/**
 * Species 落地页（Explorer 模式）。
 */
export function Species(): JSX.Element {
  const { t } = useAppIntl();
  const { species: speciesId = 'pig' } = useParams<{ species: string }>();
  const { samples, isLoading, error } = useSampleCatalog();

  // ── 交互状态 ──
  const [selectedTissue, setSelectedTissue] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortMode, setSortMode] = useState<SortMode>('id');

  // ── 数据过滤 + 排序 ──
  const filtered = useMemo(() => {
    if (!samples) return [];

    const query = searchQuery.trim().toLowerCase();

    let list = samples.filter((s) => s.species === speciesId);

    // 组织过滤
    if (selectedTissue) {
      list = list.filter((s) => s.tissue === selectedTissue);
    }

    // 搜索
    if (query) {
      list = list.filter(
        (s) =>
          s.id.toLowerCase().includes(query) ||
          s.tissue.toLowerCase().includes(query) ||
          s.breed.toLowerCase().includes(query),
      );
    }

    // 排序
    list = list.slice().sort((a, b) => {
      if (sortMode === 'breed') return a.breed.localeCompare(b.breed);
      if (sortMode === 'tissue') return a.tissue.localeCompare(b.tissue);
      return a.id.localeCompare(b.id);
    });

    return list;
  }, [samples, speciesId, selectedTissue, searchQuery, sortMode]);

  // 按组织分组
  const grouped = useMemo<Array<[string, Sample[]]>>(() => {
    const groups = new Map<string, Sample[]>();
    for (const s of filtered) {
      const arr = groups.get(s.tissue) ?? [];
      arr.push(s);
      groups.set(s.tissue, arr);
    }
    return Array.from(groups.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [filtered]);

  // 统计
  const tissueSet = useMemo(() => {
    if (!samples) return new Set<string>();
    return new Set(samples.filter((s) => s.species === speciesId).map((s) => s.tissue));
  }, [samples, speciesId]);

  const breedSet = useMemo(() => {
    if (!samples) return new Set<string>();
    return new Set(samples.filter((s) => s.species === speciesId).map((s) => s.breed));
  }, [samples, speciesId]);

  // ── 物种元数据 ──
  const speciesMeta: Record<string, { latin: string; title: string }> = {
    pig: { latin: 'Sus scrofa', title: t('home.species.pig.latinName') },
    chicken: { latin: 'Gallus gallus', title: t('home.species.chicken.latinName') },
  };
  const meta = speciesMeta[speciesId] ?? { latin: speciesId, title: speciesId };

  return (
    <RouteShell title={meta.title} subtitle={meta.latin}>
      {isLoading && <div className="sp-state">{t('common.loading')}</div>}
      {error instanceof Error && (
        <div className="sp-state sp-state--error">
          {t('species.error', { message: error.message })}
        </div>
      )}
      {!isLoading && !error && (
        <div className="sp-layout">
          {/* ── 左侧栏 ── */}
          <aside className="sp-sidebar">
            <h3>{t('species.menu.tissues')}</h3>
            <div
              className={'sp-sidebar-item' + (selectedTissue === null ? ' active' : '')}
              onClick={() => setSelectedTissue(null)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSelectedTissue(null); } }}
            >
              <span className="tissue-dot" style={{ background: 'var(--color-accent)' }} />
              {t('species.menu.all')}
              <span className="tissue-count">{tissueSet.size}</span>
            </div>
            {Array.from(tissueSet).sort().map((tissue) => {
              const meta = tissueMeta(tissue);
              const count = samples?.filter((s) => s.species === speciesId && s.tissue === tissue).length ?? 0;
              return (
                <div
                  key={tissue}
                  className={'sp-sidebar-item' + (selectedTissue === tissue ? ' active' : '')}
                  onClick={() => setSelectedTissue(tissue === selectedTissue ? null : tissue)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSelectedTissue(tissue === selectedTissue ? null : tissue); } }}
                >
                  <span className={'tissue-dot ' + meta.dot} />
                  {tissue}
                  <span className="tissue-count">{count}</span>
                </div>
              );
            })}
            <div className="sp-sidebar-divider" />
            <h3>{t('species.menu.breeds')}</h3>
            {Array.from(breedSet).sort().map((breed) => (
              <div key={breed} className="sp-sidebar-item">
                {breed}
                <span className="tissue-count">
                  {samples?.filter((s) => s.species === speciesId && s.breed === breed).length ?? 0}
                </span>
              </div>
            ))}
          </aside>

          {/* ── 主区域 ── */}
          <div className="sp-main">
            <div className="sp-search-bar">
              <div className="sp-search-input-wrap">
                <SearchIcon />
                <input
                  type="text"
                  placeholder={t('species.search.placeholder')}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              <select
                value={sortMode}
                onChange={(e) => setSortMode(e.target.value as SortMode)}
                className="sp-sort-select"
              >
                <option value="id">{t('species.sort.id')}</option>
                <option value="breed">{t('species.sort.breed')}</option>
                <option value="tissue">{t('species.sort.tissue')}</option>
              </select>
            </div>

            {grouped.length === 0 ? (
              <div className="sp-state">{t('species.emptyForSpecies')}</div>
            ) : (
              grouped.map(([tissue, items]) => {
                const meta = tissueMeta(tissue);
                const MetaIcon = meta.icon;
                return (
                  <section key={tissue} className="sp-group">
                    <div className="sp-group-header">
                      <span className={'tissue-dot ' + meta.dot} />
                      <h3>
                        <MetaIcon />
                        {tissue}
                      </h3>
                      <span className="tissue-count">{items.length}</span>
                    </div>
                    <div className="sp-card-list">
                      {items.map((s) => (
                        <Link key={s.id} className="sp-card" to={`/sample/${s.id}`}>
                          <div className="sp-card-icon">
                            <MetaIcon />
                          </div>
                          <div className="sp-card-body">
                            <div className="sp-card-name">{s.id}</div>
                            <div className="sp-card-meta">
                              {s.breed} · {s.sex} · {s.dev_stage}
                            </div>
                          </div>
                          <span className="sp-card-arrow">
                            <ArrowIcon />
                          </span>
                        </Link>
                      ))}
                    </div>
                  </section>
                );
              })
            )}
          </div>
        </div>
      )}
    </RouteShell>
  );
}

export default Species;
