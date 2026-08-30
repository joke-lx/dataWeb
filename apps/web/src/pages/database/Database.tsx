/**
 * Database — 数据库选择列表页（/database）。
 *
 * 职责：展示全部样本，支持左侧筛选（物种/组织/品种）、搜索、排序、分页；
 * 每个结果卡片可"可视化"（跳 /sample/:id）或"下载"（打开文件抽屉）。
 *
 * 布局（参考 list.png）：左侧 sidebar + 右侧工具栏（Tabs + 排序）+ 结果卡片列表。
 */

import { useMemo, useState, type JSX } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Empty, Pagination, Select, Tabs } from 'antd';

import type { Sample } from '../../api/types';
import { RouteShell } from '../../components/route/RouteShell';
import { useSampleCatalog } from '../../hooks/useSampleCatalog';
import { useAppIntl } from '../../i18n';
import { FilterSidebar, type Filters } from './FilterSidebar';
import { ResultCard } from './ResultCard';
import { DownloadDrawer } from './DownloadDrawer';
import './database.css';

/** 每页卡片数 —— 6 个样本正好分 2 页，能演示分页。 */
const PAGE_SIZE = 5;

type SortMode = 'id' | 'tissue' | 'breed';

const EMPTY_FILTERS: Filters = { species: [], tissue: [], breed: [] };

/**
 * /database 列表页。
 */
export function Database(): JSX.Element {
  const { t } = useAppIntl();
  const { samples, isLoading, error } = useSampleCatalog();
  const [params, setParams] = useSearchParams();

  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [q, setQ] = useState(params.get('q') ?? '');
  const [sort, setSort] = useState<SortMode>('id');
  const [page, setPage] = useState(1);
  const [drawerSample, setDrawerSample] = useState<Sample | null>(null);

  const all = samples ?? [];

  // 文本匹配 + 三维筛选 + 排序。
  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    let list = all.filter((s) => {
      if (filters.species.length && !filters.species.includes(s.species)) return false;
      if (filters.tissue.length && !filters.tissue.includes(s.tissue)) return false;
      if (filters.breed.length && !filters.breed.includes(s.breed)) return false;
      if (query) {
        const hay = `${s.id} ${s.tissue} ${s.breed}`.toLowerCase();
        if (!hay.includes(query)) return false;
      }
      return true;
    });
    list = list.slice().sort((a, b) => {
      if (sort === 'breed') return a.breed.localeCompare(b.breed);
      if (sort === 'tissue') return a.tissue.localeCompare(b.tissue);
      return a.id.localeCompare(b.id);
    });
    return list;
  }, [all, filters, q, sort]);

  // 搜索词写回 URL（?q=），刷新可恢复。
  const onSearchChange = (next: string) => {
    setQ(next);
    setPage(1);
    setParams((prev) => {
      const p = new URLSearchParams(prev);
      if (next) p.set('q', next);
      else p.delete('q');
      return p;
    }, { replace: true });
  };

  const pageItems = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const sortOptions = [
    { value: 'id', label: t('database.sort.id') },
    { value: 'tissue', label: t('database.sort.tissue') },
    { value: 'breed', label: t('database.sort.breed') },
  ];

  return (
    <RouteShell
      title={t('database.title')}
      subtitle={t('database.subtitle', { count: all.length })}
      breadcrumb="6 samples · pig · Sscrofa11.1"
    >
      {isLoading && <div className="db-state">{t('common.loading')}</div>}
      {error instanceof Error && (
        <div className="db-state db-state--error">{t('species.error', { message: error.message })}</div>
      )}
      {!isLoading && !error && (
        <div className="db-layout">
          <FilterSidebar
            value={filters}
            onChange={(next) => {
              setFilters(next);
              setPage(1);
            }}
            q={q}
            onSearchChange={onSearchChange}
            samples={all}
          />

          <div className="db-main">
            <div className="db-toolbar">
              <Tabs
                activeKey="results"
                items={[
                  {
                    key: 'results',
                    label: t('database.tab.results', { count: filtered.length }),
                  },
                ]}
              />
              <Select
                value={sort}
                onChange={(v) => { setSort(v as SortMode); setPage(1); }}
                options={sortOptions}
                className="db-sort"
                aria-label={t('database.sort.label')}
              />
            </div>

            <div className="db-results">
              {pageItems.map((s) => (
                <ResultCard key={s.id} sample={s} onDownload={setDrawerSample} />
              ))}
            </div>

            {filtered.length === 0 ? (
              <Empty
                description={t('database.empty')}
                image={Empty.PRESENTED_IMAGE_SIMPLE}
              >
                <button
                  type="button"
                  className="db-empty-cta"
                  onClick={() => {
                    setFilters(EMPTY_FILTERS);
                    onSearchChange('');
                  }}
                >
                  {t('database.emptyCta')}
                </button>
              </Empty>
            ) : (
              <Pagination
                current={page}
                pageSize={PAGE_SIZE}
                total={filtered.length}
                onChange={setPage}
                showSizeChanger={false}
                simple
                className="db-pagination"
              />
            )}
          </div>
        </div>
      )}

      <DownloadDrawer sample={drawerSample} onClose={() => setDrawerSample(null)} />
    </RouteShell>
  );
}

export default Database;
