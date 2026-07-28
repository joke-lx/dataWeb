/**
 * StatusBar — 底部状态栏。
 *
 * 架构位置：嵌入到 `AppShell` 底部；常驻显示当前视口信息。
 * 由两部分组成：当前基因组区间（chr:start-end）和数据来源说明。
 *
 * 为什么存在：让用户在任何页面都看得到「我现在看的是哪段区间」，避免在
 * viewer 内反复滚动查找 region 指示器；同时提供数据来源的可追溯声明。
 */
import type { JSX } from 'react';

import { useAppIntl } from '../../i18n';
import { formatBp } from '../../genomics/coords';
import { useViewport } from '../../store/viewport';

/**
 * 底部状态栏组件。
 *
 * 数据来源：从 `useViewport` 细粒度订阅 chr/start/end，避免无关字段
 * （如 bin、species）变化触发重渲染。坐标使用 `formatBp` 自动按 kb/Mb
 * 单位缩写，避免显示 1,000,000 这种长数字。
 *
 * @returns 状态栏 JSX
 */
export function StatusBar(): JSX.Element {
  const { t } = useAppIntl();
  const chr = useViewport((state) => state.chr);
  const start = useViewport((state) => state.start);
  const end = useViewport((state) => state.end);

  return (
    <footer className="statusbar">
      <div className="statusbar__region">
        {chr}:{formatBp(start)}-{formatBp(end)}
      </div>
      <div className="statusbar__source">{t('status.dataSource')}</div>
    </footer>
  );
}