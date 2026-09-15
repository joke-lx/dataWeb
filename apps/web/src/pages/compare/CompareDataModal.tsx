/**
 * CompareDataModal —— Compare 工作区「从数据库选择数据」弹窗。
 *
 * 交互与 /database 列表页一致但缩小到弹窗：
 *  - 关键词搜索（样本 id / 组织 / 品种 / 物种 / 发育阶段）；
 *  - 物种 / 组织 / 品种三个维度的多选筛选；
 *  - 结果列表点击即加入对比（已加入的行置灰并标记 ✓），
 *    可连续添加多个后点「完成」关闭。
 *
 * 为什么存在：原「+ Add Data」是 340px 的 Popover 平铺列表，样本一多
 * 无法检索；数据库页已有成熟的筛选交互，这里抽取缩小版复用其心智模型。
 */

import { useEffect, useMemo, useState, type JSX } from 'react';
import { Modal, Input, Select, Button, Empty } from 'antd';
import { SearchOutlined } from '@ant-design/icons';

import type { Sample } from '../../api/types';
import { useAppIntl } from '../../i18n';

interface CompareDataModalProps {
  /** 弹窗开关（由 CompareRail 控制）。 */
  open: boolean;
  /** 整个物种目录（未加载时为 `undefined`）。 */
  samples: Sample[] | undefined;
  /** 已加入对比的样本 id（用于行内禁用标记）。 */
  added: string[];
  /** 添加一个样本到对比（已存在时由父组件去重）。 */
  onAdd: (id: string) => void;
  /** 关闭弹窗。 */
  onClose: () => void;
}

interface Filters {
  species: string[];
  tissue: string[];
  breed: string[];
}

const EMPTY_FILTERS: Filters = { species: [], tissue: [], breed: [] };

/**
 * 从数据库选择数据的 Modal。
 */
export function CompareDataModal({
  open,
  samples,
  added,
  onAdd,
  onClose,
}: CompareDataModalProps): JSX.Element {
  const { t } = useAppIntl();
  const [q, setQ] = useState('');
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);

  const all = samples ?? [];

  // 每次打开弹窗重置为全新会话（筛选/搜索不跨会话残留）。
  useEffect(() => {
    if (open) {
      setQ('');
      setFilters(EMPTY_FILTERS);
    }
  }, [open]);

  // 文本匹配 + 三维筛选（与 /database 的筛选语义一致）。
  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    return all.filter((row) => {
      if (filters.species.length && !filters.species.includes(row.species)) return false;
      if (filters.tissue.length && !filters.tissue.includes(row.tissue)) return false;
      if (filters.breed.length && !filters.breed.includes(row.breed)) return false;
      if (query) {
        const hay = `${row.id} ${row.tissue} ${row.breed} ${row.species} ${row.dev_stage}`.toLowerCase();
        if (!hay.includes(query)) return false;
      }
      return true;
    });
  }, [all, filters, q]);

  // 筛选选项（去重，按样本数据实际取值）。
  const options = useMemo(() => {
    const uniq = (key: keyof Sample) =>
      Array.from(new Set(all.map((r) => r[key]).filter(Boolean))).map((v) => ({
        value: v as string,
        label: v as string,
      }));
    return { species: uniq('species'), tissue: uniq('tissue'), breed: uniq('breed') };
  }, [all]);

  const reset = () => {
    setQ('');
    setFilters(EMPTY_FILTERS);
  };

  return (
    <Modal
      open={open}
      onCancel={onClose}
      footer={null}
      width={720}
      title={t('compare.dataModal.title')}
    >
      {/* 搜索 + 筛选区 */}
      <Input
        allowClear
        placeholder={t('database.search.placeholder')}
        value={q}
        onChange={(e) => setQ(e.target.value)}
        prefix={<SearchOutlined />}
        className="cmp-dm-search"
      />
      <div className="cmp-dm-filters">
        <Select
          mode="multiple"
          allowClear
          placeholder={t('compare.dataModal.selectSpecies')}
          value={filters.species}
          onChange={(v) => setFilters({ ...filters, species: v })}
          options={options.species}
          className="cmp-dm-select"
        />
        <Select
          mode="multiple"
          allowClear
          placeholder={t('compare.dataModal.selectTissue')}
          value={filters.tissue}
          onChange={(v) => setFilters({ ...filters, tissue: v })}
          options={options.tissue}
          className="cmp-dm-select"
        />
        <Select
          mode="multiple"
          allowClear
          placeholder={t('compare.dataModal.selectBreed')}
          value={filters.breed}
          onChange={(v) => setFilters({ ...filters, breed: v })}
          options={options.breed}
          className="cmp-dm-select"
        />
        <Button size="small" onClick={reset}>
          {t('database.filter.reset')}
        </Button>
      </div>
      <div className="cmp-dm-count">
        {t('compare.dataModal.showing', { total: all.length, count: filtered.length })}
      </div>

      {/* 结果列表：点击行加入对比，可连续添加 */}
      {filtered.length === 0 ? (
        <div className="cmp-dm-empty">
          <Empty
            description={t('compare.dataModal.empty')}
            image={Empty.PRESENTED_IMAGE_SIMPLE}
          >
            <Button size="small" onClick={reset}>
              {t('database.emptyCta')}
            </Button>
          </Empty>
        </div>
      ) : (
        <div className="cmp-dm-list" role="listbox" aria-label={t('compare.dataModal.title')}>
          {filtered.map((s) => {
            const selected = added.includes(s.id);
            return (
              <button
                key={s.id}
                type="button"
                role="option"
                aria-selected={selected}
                disabled={selected}
                className={'cmp-dm-row' + (selected ? ' is-added' : '')}
                onClick={() => onAdd(s.id)}
              >
                <span className="cmp-dm-row-id">{s.id}</span>
                <span className="cmp-dm-row-meta">
                  {s.species} · {s.tissue} · {s.breed} · {s.sex}
                </span>
                {selected && (
                  <span className="cmp-dm-row-check">{t('compare.dataModal.added')} ✓</span>
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* 底部：已添加数量 + 完成 */}
      <div className="cmp-dm-footer">
        <span className="cmp-dm-footer-count">
          {t('compare.dataModal.showing', { total: all.length, count: filtered.length })}
        </span>
        <Button type="primary" onClick={onClose}>
          {t('compare.dataModal.done')}
        </Button>
      </div>
    </Modal>
  );
}

export default CompareDataModal;
