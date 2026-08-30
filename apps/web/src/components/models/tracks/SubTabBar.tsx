/**
 * SubTabBar —— Tracks 路由顶部的分组 chip 条。
 *
 * 职责：
 *  - 把传入的 `tabs: SubTab[]` 按 `group` 字段聚合为「Sequencing / Structure /
 *    Annotation」三类（在 `trackSpec.ts` 中定义）；
 *  - 渲染每个分组下的子 tab chip，受控组件：选中态由父级 `value` 决定；
 *  - 鼠标悬停 tooltip 显示 `TRACK_CATALOG[id].title`（更详细的轨道描述）。
 *
 * 架构位置：纯受控 UI 条，无网络/状态耦合，被 `/tracks` 路由直接使用。
 */

import type { JSX } from 'react';

import type { SubTab } from './trackSpec';
import { GROUP_LABELS, TRACK_CATALOG } from './trackSpec';
import './tracks.css';

export interface SubTabBarProps {
  tabs: SubTab[];
  /** 当前已选中的 tab id 集合（按选择顺序，顺序决定 stacking 顺序）。 */
  value: readonly string[];
  /**
   * 选中变化时的回调——toggle 语义（已选则移除、未选则追加），由父级
   * 维护 `selectedTypes` 状态。
   */
  onChange: (id: string) => void;
}

/**
 * 分组 chip 选择条。
 *
 * @param tabs 待渲染的子 tab 描述列表（一般直接来自 `SUB_TABS`）
 * @param value 当前选中的 tab id
 * @param onChange 选中变化时的回调，由父级同步到 URL
 */
export function SubTabBar({ tabs, value, onChange }: SubTabBarProps): JSX.Element {
  // 按 group 字段聚合。Map 保证插入顺序 = tabs 出现顺序。
  const groups = new Map<string, SubTab[]>();
  for (const tab of tabs) {
    const existing = groups.get(tab.group) ?? [];
    existing.push(tab);
    groups.set(tab.group, existing);
  }

  return (
    <div className="subtab-bar">
      {Array.from(groups.entries()).map(([group, groupTabs]) => (
        <div key={group} className="subtab-group">
          <span className="subtab-group-label">
            {GROUP_LABELS[group as SubTab['group']]}
          </span>
          {groupTabs.map((tab) => (
            <button
              key={tab.id}
              className={
                'subtab-chip' + (value.includes(tab.id) ? ' subtab-chip--active' : '')
              }
              onClick={() => onChange(tab.id)}
              title={TRACK_CATALOG[tab.id]?.title ?? tab.id}
            >
              {tab.label}
            </button>
          ))}
        </div>
      ))}
    </div>
  );
}
