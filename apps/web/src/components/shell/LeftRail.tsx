/**
 * LeftRail — 左侧样本选择侧栏。
 *
 * 架构位置：挂在 `AppShell` 内的左侧（或随响应式布局折叠），独立于路由。
 * 负责从后端拉取样本列表（当前只拉 pig 物种），按 tissue 分组展示，
 * 并把「当前激活样本」写入 Redux store 供所有 viewer 读取。
 *
 * 为什么存在：viewer 渲染需要知道「当前样本是哪个」，把样本选择做成全局
 * 组件后，多个 viewer（hic / differential / tracks / ...）可以共享同一份
 * 选中状态，避免每个路由各自实现选择器。
 *
 * 数据流：
 *  1. react-query 调 `fetchSamples('pig')` 拉样本
 *  2. `useEffect` 把数据同步到 `useSamples` store
 *  3. 用户点击样本 → `setActive(sampleId)` 更新 store
 *  4. 其他 viewer 通过 `useSamples(s => s.active)` 订阅变更
 */
import type { JSX } from 'react';
import { useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';

import { useAppIntl } from '../../i18n';
import { fetchSamples } from '../../api/client';
import type { Sample } from '../../api/types';
import { useSamples } from '../../store/samples';

/**
 * 单个样本行。
 *
 * 通过 zustand selector 分别订阅 `active` 和 `setActive`，避免组件因
 * 整个 store 变化而重渲染（细粒度订阅）。
 *
 * @param props 组件 props
 * @param props.sample 展示的样本数据
 * @returns 列表项 JSX
 */
function SampleItem({ sample }: { sample: Sample }): JSX.Element {
  const active = useSamples((s) => s.active);
  const setActive = useSamples((s) => s.setActive);

  const isActive = active === sample.id;

  return (
    <li>
      <button
        type="button"
        className={
          'sample-item' + (isActive ? ' sample-item--active' : '')
        }
        onClick={() => setActive(sample.id)}
      >
        <span className="sample-item__id">{sample.id}</span>
        <span className="sample-item__meta">
          {sample.tissue} · {sample.breed} · {sample.sex}
        </span>
      </button>
    </li>
  );
}

/**
 * 左侧样本选择栏。
 *
 * 渲染流程：
 *  1. 拉取样本（loading / error / data 三态）
 *  2. 拉取成功后写入 store
 *  3. 按 tissue 分组渲染列表
 *
 * 注意：分组在客户端完成；如果后端将来按物种返回大列表，这里需要
 * 切换到虚拟列表或后端聚合。
 *
 * @returns 侧栏 JSX
 */
export function LeftRail(): JSX.Element {
  const { t } = useAppIntl();
  const setSamples = useSamples((s) => s.setSamples);

  const { data, isLoading, error } = useQuery({
    queryKey: ['samples', 'pig'],
    queryFn: () => fetchSamples('pig'),
  });

  // Sync fetched samples into the store so other components can read them.
  useEffect(() => {
    if (data) setSamples(data);
  }, [data, setSamples]);

  // 按 tissue 分组样本，避免每个 viewer 重复此逻辑。
  // 选用 Map 而非对象：保留插入顺序、tissue 名称可能与原型链属性冲突。
  const grouped = useMemo(() => {
    const groups = new Map<string, Sample[]>();
    (data ?? []).forEach((s) => {
      const arr = groups.get(s.tissue) ?? [];
      arr.push(s);
      groups.set(s.tissue, arr);
    });
    return Array.from(groups.entries());
  }, [data]);

  return (
    <aside className="left-rail">
      <div className="left-rail__title">
        {t('leftRail.samplesCount', { count: data ? data.length : 0 })}
      </div>

      {isLoading && (
        <div className="left-rail__state">{t('leftRail.loading')}</div>
      )}

      {error instanceof Error && (
        <div className="left-rail__state left-rail__state--error">
          {t('leftRail.loadError', { message: error.message })}
        </div>
      )}

      {/* 只在「无 loading、无 error」时才显示分组列表，避免错误状态被覆盖 */}
      {!isLoading && !error && (
        <div className="left-rail__groups">
          {grouped.map(([tissue, items]) => (
            <section key={tissue} className="left-rail__group">
              <h3 className="left-rail__group-title">{tissue}</h3>
              <ul className="left-rail__list">
                {items.map((s) => (
                  <SampleItem key={s.id} sample={s} />
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </aside>
  );
}