/**
 * FilterSidebar — /database 左侧筛选栏。
 *
 * 职责：搜索框 + 三个 PickerRow（物种 / 组织 / 品种），每个 PickerRow 是
 * render-kit 的纯 UI 封装，本组件负责喂入 facet 计数与 toggle 逻辑。
 * 完全受控：筛选值 `value` 与搜索词 `q` 都由上层 Database 页持有。
 *
 * 计数策略：统计"在其它维度筛选后的样本"里每个选项出现的次数
 * （标准 facet 计数），让用户看到交叉筛选后的剩余数。
 */

import { useEffect, useState, type JSX } from 'react';
import { Input } from 'antd';

import type { Sample } from '../../api/types';
import { PickerRow } from '../../components/render-kit/picker/PickerRow';
import { useAppIntl } from '../../i18n';

/** 筛选值：三个维度各是一个字符串数组（空 = 不筛）。 */
export interface Filters {
  species: string[];
  tissue: string[];
  breed: string[];
}

interface FilterSidebarProps {
  value: Filters;
  onChange: (next: Filters) => void;
  q: string;
  onSearchChange: (q: string) => void;
  samples: Sample[];
}

/** 统计某维度下每个选项在"已按其它维度筛过的样本"里的计数。 */
function countsFor(
  samples: Sample[],
  dim: keyof Filters,
  active: Filters,
): Array<{ value: string; count: number }> {
  const dims: (keyof Filters)[] = ['species', 'tissue', 'breed'];
  const others = dims.filter((d) => d !== dim);
  // 仅当其它维度有选中时才收窄池子，否则用全量样本。
  const anyActive = others.some((d) => active[d].length > 0);
  const pool = !anyActive
    ? samples
    : samples.filter((s) =>
        others.some((d) => active[d].includes(s[d] as string)),
      );
  const map = new Map<string, number>();
  for (const s of pool) {
    const v = s[dim] as string;
    map.set(v, (map.get(v) ?? 0) + 1);
  }
  return Array.from(map.entries())
    .map(([value, count]) => ({ value, count }))
    .sort((a, b) => a.value.localeCompare(b.value));
}

/**
 * 左侧筛选栏。
 */
export function FilterSidebar({
  value,
  onChange,
  q,
  onSearchChange,
  samples,
}: FilterSidebarProps): JSX.Element {
  const { t } = useAppIntl();
  const [search, setSearch] = useState(q);
  // 200ms 防抖：避免每次击键都触发上层过滤重算。
  const [debounced, setDebounced] = useState(q);
  useEffect(() => {
    const id = window.setTimeout(() => setDebounced(search), 200);
    return () => window.clearTimeout(id);
  }, [search]);
  useEffect(() => {
    onSearchChange(debounced);
    // 仅当防抖值变化时触发一次。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debounced]);
  // 外部 q 变化（如 URL 直达）时同步回输入框。
  useEffect(() => {
    setSearch(q);
    setDebounced(q);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  const setDim = (dim: keyof Filters, next: string[]): void => {
    onChange({ ...value, [dim]: next });
  };

  // 三行 picker：每行一组 facet 计数 + 受控的多选 chip。
  const panels: Array<{
    key: keyof Filters;
    label: string;
    options: Array<{ value: string; count: number }>;
  }> = [
    { key: 'species', label: t('database.filter.species'), options: countsFor(samples, 'species', value) },
    { key: 'tissue', label: t('database.filter.tissue'), options: countsFor(samples, 'tissue', value) },
    { key: 'breed', label: t('database.filter.breed'), options: countsFor(samples, 'breed', value) },
  ];

  return (
    <aside className="db-sidebar">
      <Input.Search
        allowClear
        placeholder={t('database.search.placeholder')}
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />
      <div className="db-filter-rows">
        {panels.map((p) => (
          <PickerRow
            key={p.key}
            label={p.label}
            value={value[p.key]}
            options={p.options}
            onChange={(next) => setDim(p.key, next)}
          />
        ))}
      </div>
    </aside>
  );
}