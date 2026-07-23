import type { JSX } from 'react';

import type { SubTab } from '../../routes/trackSpec';
import { GROUP_LABELS, TRACK_CATALOG } from '../../routes/trackSpec';
import './tracks.css';

export interface SubTabBarProps {
  tabs: SubTab[];
  value: string;
  onChange: (id: string) => void;
}

export function SubTabBar({ tabs, value, onChange }: SubTabBarProps): JSX.Element {
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
              className={'subtab-chip' + (value === tab.id ? ' subtab-chip--active' : '')}
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
