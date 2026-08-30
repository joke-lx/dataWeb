/**
 * PickerRow — render-kit 里通用的"单维度多选 picker 行"封装。
 *
 * 职责：把一个分类维度渲染成"左侧 label + 右侧 chip 多选 toggle"的一行 UI。
 * - 完全受控：选中状态由外部 `value` 持有，本组件不持有任何业务状态；
 * - 无业务知识：不感知 i18n、facet、URL —— caller 负责翻译 label 与计算计数；
 * - 复用入口：现在由 /database 的 FilterSidebar 使用，未来其它页面若需要
 *   "多值 facet picker" 也直接复用本组件即可。
 *
 * 渲染约定：每个 chip 显示 `value` + 小计数徽标（可选），active chip 用
 * accent 边框 + 浅背景，未选中 chip hover 浅灰底，与现有 SamplePicker 视觉一致。
 */

import type { JSX, KeyboardEvent as ReactKeyboardEvent, MouseEvent as ReactMouseEvent } from 'react';

import './picker.css';

export interface PickerOption {
  /** 选项的值（亦作 React key 与 toggle 标识）。 */
  value: string;
  /** 在该选项右侧展示的小计数；省略则隐藏徽标。 */
  count?: number;
}

interface PickerRowProps {
  /** 行标题（如 "物种" / "组织" / "品种"），由 caller 翻译后传入。 */
  label: string;
  /** 当前已选值集合（受控）。空数组 = 不筛。 */
  value: string[];
  /** 可选项集合（带计数）。 */
  options: PickerOption[];
  /** 切换后把"完整新值集合"交给 caller。 */
  onChange: (next: string[]) => void;
  /** 设为 true 时整个行视作 disabled（视觉淡化、不响应点击）。 */
  disabled?: boolean;
}

/**
 * 切换某选项的成员身份：未选则追加（保持字典序），已选则剔除。
 */
function toggleValue(value: string[], v: string): string[] {
  return value.includes(v) ? value.filter((x) => x !== v) : [...value, v].sort();
}

/**
 * 单行多选 picker。
 *
 * @param props 详见 PickerRowProps。
 */
export function PickerRow({
  label,
  value,
  options,
  onChange,
  disabled = false,
}: PickerRowProps): JSX.Element {
  const selected = new Set(value);

  const onChipClick = (v: string) => (e: ReactMouseEvent<HTMLButtonElement>): void => {
    // 防止 button 默认行为触发容器层意外的 form 提交。
    e.preventDefault();
    if (disabled) return;
    onChange(toggleValue(value, v));
  };

  const onChipKey = (v: string) => (e: ReactKeyboardEvent<HTMLButtonElement>): void => {
    if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault();
      if (disabled) return;
      onChange(toggleValue(value, v));
    }
  };

  return (
    <div
      className={'pk-row' + (disabled ? ' pk-row--disabled' : '')}
      role="group"
      aria-label={label}
    >
      <div className="pk-row__label">{label}</div>
      <div className="pk-row__chips">
        {options.map((opt) => {
          const active = selected.has(opt.value);
          const classes =
            'pk-chip' +
            (active ? ' pk-chip--active' : '') +
            (disabled ? ' pk-chip--disabled' : '');
          return (
            <button
              key={opt.value}
              type="button"
              className={classes}
              aria-pressed={active}
              disabled={disabled}
              onClick={onChipClick(opt.value)}
              onKeyDown={onChipKey(opt.value)}
            >
              <span className="pk-chip__label">{opt.value}</span>
              {typeof opt.count === 'number' && (
                <span className="pk-chip__count">{opt.count}</span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}