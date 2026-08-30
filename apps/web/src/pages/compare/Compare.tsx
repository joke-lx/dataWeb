/**
 * Compare — 自由选择 A/B 样本,跳到既有 `/sample?vs=` 对比视图;同时保留
 * "查看现成对比数据库" 入口,跳 `/compare/cases` 浏览预置案例库。
 *
 * 架构位置:路由 `/compare` 的唯一组件。
 *
 * 数据流:
 *  1. `useSampleCatalog` 拉样本(共享 TanStack Query `['samples','pig']` 缓存,
 *     与 Home / Sample / Species 同 key —— 5 分钟 staleTime);
 *  2. 用户通过两个 `<Popover>` 选择 A 与 B(本地 `useState<Sample | null>`);
 *  3. 选齐后底部 "Open comparison" 启用,点击 `useNavigate()` 跳到
 *     `/sample/${a.id}?vs=${b.id}&tab=hic&type=ab` —— 复用 `Sample.tsx`
 *     既有的 `?vs=` 对比渲染逻辑,不复制一份;
 *  4. 顶部第二张卡(`.compare-cases-cta`)提供 "Browse curated cases" 直达
 *     `/compare/cases` —— 与 A/B 自选路径并列,文案/按钮走 i18n。
 *
 * 为什么存在:
 *  之前 Home 上的 4 张 mode 卡(tissue / breed / cross / developmental)
 *  只是分类标签,无法直接进入对比;用户必须先到 /species/ → /sample/:
 *  本页让"自由 A/B 选择"成为首页一条直达入口,并把"看现成案例"作为
 *  同一页的备选入口,避免回退到 Home 才能找到案例库。
 *
 * 边界:
 *  - A == B 时按钮禁用 + 显示 "A 与 B 必须不同";
 *  - 仅选 A 或 B 时禁用 + 显示 "请同时选择 A 和 B";
 *  - 加载中显示 `t('common.loading')`(与 Species / Sample 一致);
 *  - 找不到 /catalog 出错时,这里不重复列表重试 —— 已是 query 自动 retry。
 */

import { useState, type JSX } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import type { Sample } from '../../api/types';
import { Popover } from '../../components/popover/Popover';
import { RouteShell } from '../../components/route/RouteShell';
import { useSampleCatalog } from '../../hooks/useSampleCatalog';
import { useAppIntl } from '../../i18n';
import './compare.css';

interface SamplePickerCellProps {
  /** "A" 或 "B",用于 i18n 区分标签与 aria。 */
  slot: 'A' | 'B';
  /** 当前选中的样本;`null` 表示尚未选。 */
  value: Sample | null;
  /** 由 Compare 提供 setter,把选中的样本写回父组件本地 state。 */
  onChange: (sample: Sample) => void;
  /** 整个物种目录(未加载时为 `undefined`)。 */
  samples: Sample[] | undefined;
  /** 目录是否仍在加载。 */
  isLoading: boolean;
}

/**
 * 单个 A/B 选择器单元(标签 + Popover + 当前选中预览)。
 *
 * 与 Sample.tsx 中的 `sample-picker` 不同 —— 这里没有"切换样本"语义,
 * 只把"选定 A / 选定 B"显示并允许点开换一项。
 */
function SamplePickerCell({
  slot,
  value,
  onChange,
  samples,
  isLoading,
}: SamplePickerCellProps): JSX.Element {
  const { t } = useAppIntl();

  return (
    <div className="compare-pickers__cell">
      <div className="compare-pickers__label">
        {t(slot === 'A' ? 'home.reuse.pickerLabelA' : 'home.reuse.pickerLabelB')}
      </div>
      <Popover
        width={360}
        align="left"
        trigger={(open) => (
          <button
            type="button"
            className="compare-pickers__trigger"
            onClick={open}
            aria-haspopup="dialog"
          >
            {value ? (
              <>
                <span className="compare-pickers__trigger-id">{value.id}</span>
                <span className="compare-pickers__trigger-meta">
                  {value.tissue} · {value.breed} · {value.sex}
                </span>
              </>
            ) : (
              <span className="compare-pickers__trigger-placeholder">
                {t('home.reuse.pickerPlaceholder')}
              </span>
            )}
          </button>
        )}
      >
        {(close) => (
          <div className="compare-pickers__menu" role="listbox">
            {isLoading && (
              <div className="compare-pickers__menu-empty">{t('common.loading')}</div>
            )}
            {!isLoading && (samples ?? []).length === 0 && (
              <div className="compare-pickers__menu-empty">
                {t('sample.notFound.title')}
              </div>
            )}
            {!isLoading &&
              (samples ?? []).map((s) => (
                <button
                  key={s.id}
                  type="button"
                  role="option"
                  aria-selected={value?.id === s.id}
                  className={
                    'compare-pickers__option' +
                    (value?.id === s.id ? ' compare-pickers__option--selected' : '')
                  }
                  onClick={() => {
                    onChange(s);
                    close();
                  }}
                >
                  <span className="compare-pickers__option-id">{s.id}</span>
                  <span className="compare-pickers__option-meta">
                    {s.tissue} · {s.breed} · {s.sex}
                  </span>
                </button>
              ))}
          </div>
        )}
      </Popover>
    </div>
  );
}

/**
 * Compare 工作区组件。
 */
export function Compare(): JSX.Element {
  const { t } = useAppIntl();
  const navigate = useNavigate();
  const { samples, isLoading } = useSampleCatalog();

  // 局部状态:选的 A / B;不写入全局 store,因为这只是"提交前的临时值"。
  const [a, setA] = useState<Sample | null>(null);
  const [b, setB] = useState<Sample | null>(null);

  const bothPicked = a !== null && b !== null;
  const samePicked = bothPicked && a.id === b.id;
  const canSubmit = bothPicked && !samePicked;

  // 提交后跳到既有 /sample 对比视图 —— tab/type 固定 hic+ab,作为默认视图。
  // 后续可考虑按用户上次选择持久化。
  const submit = (): void => {
    if (!canSubmit) return;
    const params = new URLSearchParams({ vs: b.id, tab: 'hic', type: 'ab' });
    navigate(`/sample/${a.id}?${params.toString()}`);
  };

  return (
    <RouteShell
      title={t('home.reuse.title')}
      subtitle={t('home.reuse.subtitle')}
    >
      {/* 顶部说明卡 —— 让用户明白这页做什么。 */}
      <div className="compare-intro">
        <h3 className="compare-intro__title">{t('home.reuse.previewTitle')}</h3>
        <p className="compare-intro__body">{t('home.reuse.previewBody')}</p>
      </div>

      {/* 现成对比案例库入口 —— 不愿自选 A/B 时,可走预置 8 条案例直达。 */}
      <article className="compare-cases-cta">
        <div className="compare-cases-cta__text">
          <h3 className="compare-cases-cta__title">
            {t('home.reuse.casesCard.title')}
          </h3>
          <p className="compare-cases-cta__body">
            {t('home.reuse.casesCard.body')}
          </p>
        </div>
        <Link to="/compare/cases" className="compare-cases-cta__action">
          {t('home.reuse.casesCard.cta')} →
        </Link>
      </article>

      {/* A/B 选择器两列。 */}
      <div className="compare-pickers">
        <SamplePickerCell slot="A" value={a} onChange={setA} samples={samples} isLoading={isLoading} />
        <SamplePickerCell slot="B" value={b} onChange={setB} samples={samples} isLoading={isLoading} />
      </div>

      {/* 提交区。按钮处于禁用态时给出原因。 */}
      <div className="compare-actions">
        <button
          type="button"
          className="compare-actions__submit"
          disabled={!canSubmit}
          onClick={submit}
        >
          {t('home.reuse.open')}
        </button>
        {!bothPicked && (
          <span className="compare-actions__hint">{t('home.reuse.needBoth')}</span>
        )}
        {bothPicked && samePicked && (
          <span className="compare-actions__hint compare-actions__hint--warn">
            {t('home.reuse.needDifferent')}
          </span>
        )}
      </div>
    </RouteShell>
  );
}

export default Compare;
