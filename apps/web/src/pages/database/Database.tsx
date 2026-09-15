/**
 * Database — 数据库选择列表页（/database）。
 *
 * 参考设计稿重构：三栏分类标题 + 横向筛选区 + 表格式数据列表 + 左下角浮动统计面板。
 */

import { useEffect, useMemo, useState, type JSX } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Empty, Select, Table, Button, Tag, Input } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
  DownloadOutlined,
  EyeOutlined,
  SearchOutlined,
  FilterOutlined,
  ToolOutlined,
} from '@ant-design/icons';

import type { Sample } from '../../api/types';
import { RouteShell } from '../../components/route/RouteShell';
import { Loading } from '../../components/feedback/Loading';
import { useSampleCatalog } from '../../hooks/useSampleCatalog';
import { useAppIntl } from '../../i18n';
import { DownloadDrawer } from './DownloadDrawer';
import './database.css';

/** 每页行数。 */
const PAGE_SIZE = 5;

/** 筛选项类型。 */
interface Filters {
  species: string[];
  tissue: string[];
  cellType: string[];
  dataType: string[];
}

const EMPTY_FILTERS: Filters = {
  species: [],
  tissue: [],
  cellType: [],
  dataType: [],
};

/** 表格行数据类型（在 Sample 基础上增加可选展示字段）。 */
interface DatasetRow extends Sample {
  assembly?: string;
  dataType?: string;
  cellType?: string;
  publication?: string;
  sample: string;
  allele?: string;
}

/**
 * 把原始 Sample 映射成表格行。
 * 仅保留真实存在的字段；缺失字段留空，由渲染层显示「暂无」。
 */
function toRow(s: Sample): DatasetRow {
  return {
    ...s,
    sample: s.id,
    // assembly 从 species 推导（当前只有 pig → Sscrofa11.1）
    assembly: s.species === 'pig' ? 'Sscrofa11.1' : undefined,
    // 以下字段当前数据模型中不存在，留空
    dataType: undefined,
    cellType: undefined,
    publication: undefined,
    allele: undefined,
  };
}

/**
 * /database 列表页。
 */
export function Database(): JSX.Element {
  const { t } = useAppIntl();
  const navigate = useNavigate();
  const { samples, isLoading, error } = useSampleCatalog();
  const [params, setParams] = useSearchParams();
  const speciesParam = params.get('species');

  const [filters, setFilters] = useState<Filters>(() =>
    speciesParam ? { ...EMPTY_FILTERS, species: [speciesParam] } : EMPTY_FILTERS,
  );
  const [q, setQ] = useState(params.get('q') ?? '');
  const [page, setPage] = useState(1);
  const [drawerSample, setDrawerSample] = useState<Sample | null>(null);
  const [showStats, setShowStats] = useState(false);

  // URL 中 ?species= 变化时同步默认物种筛选。
  useEffect(() => {
    if (!speciesParam) return;
    setFilters((prev) =>
      prev.species.length === 1 && prev.species[0] === speciesParam
        ? prev
        : { ...prev, species: [speciesParam] },
    );
  }, [speciesParam]);

  const all = useMemo(() => (samples ?? []).map(toRow), [samples]);

  // 文本匹配 + 四维筛选。
  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    return all.filter((row) => {
      if (filters.species.length && !filters.species.includes(row.species)) return false;
      if (filters.tissue.length && !filters.tissue.includes(row.tissue)) return false;
      if (filters.cellType.length && !row.cellType) return false;
      if (filters.dataType.length && !row.dataType) return false;
      if (query) {
        const hay = `${row.id} ${row.tissue} ${row.breed} ${row.species}`.toLowerCase();
        if (!hay.includes(query)) return false;
      }
      return true;
    });
  }, [all, filters, q]);

  // 筛选选项（去重；缺失维度返回空数组）。
  const options = useMemo(() => {
    const uniq = (key: keyof DatasetRow) =>
      Array.from(new Set(all.map((r) => r[key]).filter(Boolean))).map((v) => ({
        value: v as string,
        label: v as string,
      }));
    return {
      species: uniq('species'),
      tissue: uniq('tissue'),
      cellType: uniq('cellType'),
      dataType: uniq('dataType'),
    };
  }, [all]);

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

  // 物种筛选变化 → 同步回 URL（与 ?q= 一致）。恰好选中 1 个时写 ?species=，
  // 清空或多选时删除参数（URL 只能表达单值深链，多选是页面内局部状态）。
  const onSpeciesChange = (next: string[]) => {
    setFilters((prev) => ({ ...prev, species: next }));
    setPage(1);
    setParams((prev) => {
      const p = new URLSearchParams(prev);
      if (next.length === 1) p.set('species', next[0]);
      else p.delete('species');
      return p;
    }, { replace: true });
  };

  const resetFilters = () => {
    setFilters(EMPTY_FILTERS);
    setQ('');
    setPage(1);
    // 清掉 URL 里的物种/搜索参数，刷新后不会再"复活"。
    setParams((prev) => {
      const p = new URLSearchParams(prev);
      p.delete('species');
      p.delete('q');
      return p;
    }, { replace: true });
  };

  // 表格列定义。
  const columns: ColumnsType<DatasetRow> = [
    {
      title: t('database.col.dataset'),
      dataIndex: 'id',
      key: 'id',
      render: (id: string, row) => (
        <div className="db-col-dataset">
          <button
            type="button"
            className="db-dataset-link"
            onClick={() => navigate(`/sample/${id}`)}
          >
            {id}
          </button>
          <div className="db-dataset-desc">
            {row.species} · {row.tissue} · {row.breed}
          </div>
        </div>
      ),
    },
    {
      title: t('common.species'),
      dataIndex: 'species',
      key: 'species',
      render: (v: string) => <Tag color="blue">{v}</Tag>,
    },
    {
      title: t('database.col.organ'),
      dataIndex: 'tissue',
      key: 'tissue',
      render: (v: string) => <Tag color="green">{v}</Tag>,
    },
    {
      title: t('database.col.assembly'),
      dataIndex: 'assembly',
      key: 'assembly',
      render: (v?: string) => v
        ? <Tag color="orange">{v}</Tag>
        : <span className="db-col-empty">{t('database.col.empty')}</span>,
    },
    {
      title: t('database.col.dataType'),
      dataIndex: 'dataType',
      key: 'dataType',
      render: (v?: string) => v
        ? <Tag color="purple">{v}</Tag>
        : <span className="db-col-empty">{t('database.col.empty')}</span>,
    },
    {
      title: t('database.col.sample'),
      dataIndex: 'sample',
      key: 'sample',
      render: (v: string) => <span className="db-col-sample">{v}</span>,
    },
    {
      title: t('database.col.allele'),
      dataIndex: 'allele',
      key: 'allele',
      render: (v?: string) => v
        ? <span className="db-col-allele">{v}</span>
        : <span className="db-col-empty">{t('database.col.empty')}</span>,
    },
    {
      title: t('database.col.publication'),
      dataIndex: 'publication',
      key: 'publication',
      render: (v?: string) => v ? (
        <div className="db-col-publication">
          <a href="#" className="db-publication-link">{v}</a>
        </div>
      ) : (
        <span className="db-col-empty">{t('database.col.empty')}</span>
      ),
    },
    {
      title: t('database.col.actions'),
      key: 'actions',
      width: 140,
      render: (_, row) => (
        <div className="db-col-actions">
          <a
            href="#"
            className="db-download-link"
            onClick={(e) => {
              e.preventDefault();
              setDrawerSample(row);
            }}
          >
            <DownloadOutlined /> {t('database.action.download')}
          </a>
          <a
            href="#"
            className="db-visualize-link"
            onClick={(e) => {
              e.preventDefault();
              navigate(`/sample/${row.id}`);
            }}
          >
            <EyeOutlined /> {t('database.action.visualize')}
          </a>
        </div>
      ),
    },
  ];

  return (
    <RouteShell
      title=""
      subtitle=""
      breadcrumb=""
    >
      {/* 三栏分类标题 */}
      <div className="db-hero">
        <div className="db-hero-cols">
          <h2 className="db-hero-col db-hero-col--blue">{t('database.hero.col1')}</h2>
          <h2 className="db-hero-col db-hero-col--green">{t('database.hero.col2')}</h2>
          <h2 className="db-hero-col db-hero-col--purple">{t('database.hero.col3')}</h2>
        </div>
        <p className="db-hero-subtitle">
          {t('database.hero.subtitle')}
        </p>
      </div>

      {isLoading && <Loading variant="block" label={t('common.loading')} />}
      {error instanceof Error && (
        <div className="db-state db-state--error">{t('species.error', { message: error.message })}</div>
      )}

      {!isLoading && !error && (
        <div className="db-container">
          {/* 筛选区 */}
          <div className="db-filter-panel">
            <div className="db-filter-title">
              <FilterOutlined /> {t('database.filter.title')}
            </div>

            <Input
              allowClear
              placeholder={t('database.filter.searchPlaceholder')}
              value={q}
              onChange={(e) => onSearchChange(e.target.value)}
              prefix={<SearchOutlined />}
              className="db-search-input"
            />

            <div className="db-filter-row">
              <div className="db-filter-field">
                <label className="db-filter-label">{t('database.filter.species')}</label>
                <Select
                  mode="multiple"
                  allowClear
                  placeholder={t('database.filter.selectSpecies')}
                  value={filters.species}
                  onChange={onSpeciesChange}
                  options={options.species}
                  className="db-filter-select"
                />
              </div>
              <div className="db-filter-field">
                <label className="db-filter-label">{t('database.filter.organ')}</label>
                <Select
                  mode="multiple"
                  allowClear
                  placeholder={t('database.filter.selectOrgan')}
                  value={filters.tissue}
                  onChange={(v) => setFilters({ ...filters, tissue: v })}
                  options={options.tissue}
                  className="db-filter-select"
                />
              </div>
              <div className="db-filter-field">
                <label className="db-filter-label">{t('database.filter.cellType')}</label>
                <Select
                  mode="multiple"
                  allowClear
                  placeholder={t('database.filter.selectCellType')}
                  value={filters.cellType}
                  onChange={(v) => setFilters({ ...filters, cellType: v })}
                  options={options.cellType}
                  className="db-filter-select"
                />
              </div>
              <div className="db-filter-field">
                <label className="db-filter-label">{t('database.filter.dataType')}</label>
                <Select
                  mode="multiple"
                  allowClear
                  placeholder={t('database.filter.selectDataType')}
                  value={filters.dataType}
                  onChange={(v) => setFilters({ ...filters, dataType: v })}
                  options={options.dataType}
                  className="db-filter-select"
                />
              </div>
            </div>

            <div className="db-filter-actions">
              <Button type="primary" onClick={resetFilters}>
                {t('database.filter.reset')}
              </Button>
              <span className="db-filter-count">
                {t('database.filter.showing', { count: filtered.length, total: all.length })}
              </span>
            </div>
          </div>

          {/* 数据表格 */}
          <div className="db-table-panel">
            {filtered.length === 0 ? (
              <Empty
                description={t('database.empty')}
                image={Empty.PRESENTED_IMAGE_SIMPLE}
              >
                <button
                  type="button"
                  className="db-empty-cta"
                  onClick={resetFilters}
                >
                  {t('database.emptyCta')}
                </button>
              </Empty>
            ) : (
              <Table<DatasetRow>
                columns={columns}
                dataSource={filtered}
                rowKey="id"
                pagination={{
                  current: page,
                  pageSize: PAGE_SIZE,
                  total: filtered.length,
                  onChange: setPage,
                  showSizeChanger: false,
                }}
                className="db-table"
              />
            )}
          </div>
        </div>
      )}

      {/* 左下角浮动 Tools 按钮 + 统计面板 */}
      <div className="db-float-panel">
        <button
          type="button"
          className={`db-float-btn ${showStats ? 'db-float-btn--active' : ''}`}
          onClick={() => setShowStats(!showStats)}
        >
          <ToolOutlined />
          <span className="db-float-btn-label">{t('database.float.tools')}</span>
          <span className="db-float-btn-count">4</span>
        </button>

        {showStats && (
          <div className="db-stats-card">
            <div className="db-stats-header">
              <span>{t('database.float.ofData')}</span>
              <span>{t('database.float.characteristic')}</span>
            </div>
            <div className="db-stats-row">
              <span>TB</span>
              <span>31,908 {t('database.float.genes')}</span>
            </div>
            <div className="db-stats-row">
              <span>GB</span>
              <span>534 {t('database.float.mirnas')}</span>
            </div>
            <div className="db-stats-row">
              <span>B</span>
              <span>2,884,709 {t('database.float.peaks')}</span>
            </div>
          </div>
        )}
      </div>

      <DownloadDrawer sample={drawerSample} onClose={() => setDrawerSample(null)} />
    </RouteShell>
  );
}

export default Database;
