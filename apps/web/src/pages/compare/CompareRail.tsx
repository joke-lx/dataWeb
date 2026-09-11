/**
 * CompareRail —— Compare 工作区左侧数据栏（参考图形态）。
 *
 * 职责：
 *  - 操作区：`+ Add Data`（Popover 选样本）、`Clear All`、`Save Session`、
 *    `Synchronize All Charts`（同步开关）；
 *  - 数据集列表：已加入对比的样本卡片，展示 id + 元数据（tissue · breed · sex、
 *    Type: Hi-C、Assembly: 物种），每项可移除；
 *  - 底部保留预置案例库入口（/compare/cases）。
 *
 * 为什么存在：参考站点的对比页以"数据工作区"形态呈现——左侧管理数据集，
 * 右侧并排渲染面板；当前实现只有 A/B 两个下拉选择，无法表达多数据集
 * 会话与"同步所有图表"这类工作区语义。
 */

import type { JSX } from 'react';
import { Link } from 'react-router-dom';

import type { Sample } from '../../api/types';
import { Popover } from '../../components/popover/Popover';
import { useAppIntl } from '../../i18n';

interface CompareRailProps {
  /** 整个物种目录（未加载时为 `undefined`）。 */
  samples: Sample[] | undefined;
  /** 目录是否仍在加载。 */
  isLoading: boolean;
  /** 已加入对比的样本 id 列表（顺序 = 面板顺序）。 */
  added: string[];
  /** 添加一个样本到对比（已存在时忽略，由父组件去重）。 */
  onAdd: (id: string) => void;
  /** 从对比中移除一个样本。 */
  onRemove: (id: string) => void;
  /** 清空全部数据集。 */
  onClear: () => void;
  /** 保存会话（复制当前 ?samples= 链接）。 */
  onSaveSession: () => void;
  /** 会话链接是否刚复制成功（按钮短暂显示反馈文案）。 */
  saved: boolean;
  /** 是否同步所有面板视口。 */
  sync: boolean;
  /** 切换同步开关。 */
  onToggleSync: () => void;
}

/**
 * 左侧数据栏：操作按钮 + 数据集列表 + 案例库入口。
 */
export function CompareRail({
  samples,
  isLoading,
  added,
  onAdd,
  onRemove,
  onClear,
  onSaveSession,
  saved,
  sync,
  onToggleSync,
}: CompareRailProps): JSX.Element {
  const { t } = useAppIntl();

  return (
    <aside className="compare-rail">
      {/* 操作区 */}
      <div className="compare-rail__actions">
        <Popover
          width={340}
          align="left"
          trigger={(open) => (
            <button
              type="button"
              className="compare-rail__btn compare-rail__btn--primary"
              onClick={open}
              disabled={isLoading}
              aria-haspopup="dialog"
            >
              + {t('compare.workspace.addData')}
            </button>
          )}
        >
          {(close) => (
            <div className="compare-rail__menu" role="listbox">
              {isLoading && (
                <div className="compare-rail__menu-empty">{t('common.loading')}</div>
              )}
              {!isLoading && (samples ?? []).length === 0 && (
                <div className="compare-rail__menu-empty">
                  {t('sample.notFound.title')}
                </div>
              )}
              {!isLoading &&
                (samples ?? []).map((s) => {
                  const selected = added.includes(s.id);
                  return (
                    <button
                      key={s.id}
                      type="button"
                      role="option"
                      aria-selected={selected}
                      disabled={selected}
                      className={
                        'compare-rail__option' +
                        (selected ? ' compare-rail__option--selected' : '')
                      }
                      onClick={() => {
                        onAdd(s.id);
                        close();
                      }}
                    >
                      <span className="compare-rail__option-id">{s.id}</span>
                      <span className="compare-rail__option-meta">
                        {s.tissue} · {s.breed} · {s.sex}
                      </span>
                      {selected && (
                        <span className="compare-rail__option-check" aria-hidden="true">
                          ✓
                        </span>
                      )}
                    </button>
                  );
                })}
            </div>
          )}
        </Popover>

        <button
          type="button"
          className="compare-rail__btn"
          onClick={onClear}
          disabled={added.length === 0}
        >
          {t('compare.workspace.clearAll')}
        </button>

        <button
          type="button"
          className="compare-rail__btn"
          onClick={onSaveSession}
          disabled={added.length === 0}
        >
          {saved ? t('compare.workspace.saved') : t('compare.workspace.saveSession')}
        </button>

        <button
          type="button"
          className={
            'compare-rail__btn compare-rail__btn--sync' + (sync ? ' is-on' : '')
          }
          onClick={onToggleSync}
          aria-pressed={sync}
        >
          {t('compare.workspace.syncCharts')}
        </button>
      </div>

      {/* 数据集列表 */}
      <div className="compare-rail__list">
        {added.length === 0 && (
          <div className="compare-rail__empty">{t('compare.workspace.empty')}</div>
        )}
        {added.map((id, index) => {
          const s = samples?.find((item) => item.id === id);
          if (!s) return null;
          return (
            <div key={id} className="compare-rail__item">
              <div className="compare-rail__item-head">
                <span className="compare-rail__item-id">
                  {index + 1}. {s.id}
                </span>
                <button
                  type="button"
                  className="compare-rail__item-remove"
                  onClick={() => onRemove(id)}
                  aria-label={t('compare.workspace.remove')}
                >
                  ×
                </button>
              </div>
              <div className="compare-rail__item-meta">
                {s.tissue} · {s.breed} · {s.sex}
              </div>
              <div className="compare-rail__item-meta">
                {t('compare.workspace.type')}
              </div>
              <div className="compare-rail__item-meta">
                {t('compare.workspace.assembly')}: {s.species}
              </div>
            </div>
          );
        })}
      </div>

      <Link to="/compare/cases" className="compare-rail__cases">
        {t('compare.workspace.casesLink')} →
      </Link>
    </aside>
  );
}

export default CompareRail;
