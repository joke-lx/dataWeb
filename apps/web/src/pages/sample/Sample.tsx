/**
 * Sample 详情页：单样本 viewer 的容器。
 *
 * 职责：把 `<RouteShell>` 包装 + sub-tab 切换（hic / tracks / 3d / ctcfMotif）+
 * compare 模式（?vs=） + sample picker + TrackSampleHeader 等"外壳"职责
 * 集中在一处。真正的数据图表由对应 `<ModelFactory type="..." />` 渲染。
 *
 * 为什么这里这么多业务逻辑：路由层负责把 URL 参数（id, vs, tab, type, samples）
 * 翻译成给下层 viewer 的 props；下游 viewer 不必各自解析 URL。
 *
 * 关键状态机：
 *   - 单一 sample → 展示 sub-tab（hic / tracks / 3d / ctcfMotif）
 *   - compare 模式（?vs= 合法 partner）→ 锁定为 Differential 视图
 *
 * 注意：CSS 改动见 `sample.css`（不在本注释任务范围）。
 */

import { useEffect, useMemo, useRef, useState, type JSX } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';

import type { Sample } from '../../api/types';
import { ModelFactory } from '../../components/models';
import type { ModelType } from '../../components/models';
import { Popover } from '../../components/popover/Popover';
import { RouteShell } from '../../components/route/RouteShell';
import { TracksModel } from '../../components/models/tracks';
import { TrackSampleHeader } from '../../components/models/tracks/TrackSampleHeader';
import { GeneLane } from '../../components/models/differential/GeneLane';
import { Log2Heatmap } from '../../components/models/differential/Log2Heatmap';
import { useD3Zoom } from '../../hooks/useD3Zoom';
import { useSampleCatalog } from '../../hooks/useSampleCatalog';
import { useTrackSampleSelection } from '../../hooks/useTrackSampleSelection';
import { useAppIntl } from '../../i18n';
import { useSamples } from '../../store/samples';
import { useViewport } from '../../store/viewport';
import { SUB_TABS, TRACK_CATALOG } from '../../components/models/tracks/trackSpec';
import type { TrackId } from '../../components/models/tracks/trackSpec';
import './sample.css';

/** sub-tab 枚举：hic / tracks / 3d / ctcfMotif。 */
const TABS = ['hic', 'tracks', '3d', 'ctcfMotif'] as const;
type SampleTab = (typeof TABS)[number];
// tab id → ModelType 映射。ctcfMotif tab 内部模型 id 为 'ctcf-motif'。
// tracks 不在 ModelType union 里（它有必传 props），所以这一项用 'as never'
// 标注后由外层 if/else 分支直接渲染 <TracksModel>。
const MODEL_TYPES: Record<SampleTab, ModelType> = {
  hic: 'hic', tracks: 'tracks' as never, '3d': '3d', ctcfMotif: 'ctcf-motif',
};

/**
 * Sample 路由组件。
 * URL 参数：
 *   - `:id`        样本 id
 *   - `?vs=`       对比样本 id（compare 模式）
 *   - `?tab=`      sub-tab（hic/tracks/3d/ctcfMotif）
 *   - `?type=`     Tracks 子模式（rna_seq/h3k4me3/...）
 *   - `?samples=`  Tracks 多样本叠加（详见 useTrackSampleSelection）
 */
export function Sample(): JSX.Element {
  const { id } = useParams<{ id: string }>();
  const [params, setParams] = useSearchParams();
  const { t } = useAppIntl();
  const { samples, isLoading } = useSampleCatalog();
  const setActive = useSamples((state) => state.setActive);
  const setSamples = useSamples((state) => state.setSamples);
  const viewport = useViewport();
  const partnerId = params.get('vs');
  // 兜底 default 'hic'，避免初次渲染时拿到无效值。
  const [tab, setTab] = useState<SampleTab>((params.get('tab') as SampleTab) || 'hic');
  const [searchQuery, setSearchQuery] = useState('');
  const viewerRef = useRef<HTMLDivElement>(null);
  useD3Zoom(viewerRef);
  const sample = useMemo(() => samples?.find((item) => item.id === id), [samples, id]);
  const partner = useMemo(
    () => (partnerId ? samples?.find((item) => item.id === partnerId) : undefined),
    [samples, partnerId],
  );
  // 严格判断 compare 模式：partnerId 存在 + 双方都找到 + 不等于自己。
  const isCompareMode = Boolean(partnerId && partner && sample && partnerId !== sample.id);

  // --- Tracks sub-tab 业务逻辑：解析 ?type= + 准备叠加样本元数据 ---
  const trackType = (params.get('type') ?? 'ab') as TrackId;
  // 兜底到 index 3（AB）——历史约定，避免 type 非法时空白。
  const trackSubTab = SUB_TABS.find((t) => t.id === trackType) ?? SUB_TABS[3];
  const trackAux = trackSubTab.aux;
  const { sampleIds: trackSampleIds, setSampleIdsRaw } = useTrackSampleSelection();
  const trackMainSpec = TRACK_CATALOG[trackSubTab.id];
  // 把样本列表 index 成 Map 便于 O(1) 取——叠加多 sample 时 linear find 太慢。
  const trackSampleById = useMemo(() => {
    const map = new Map<string, Sample>();
    (samples ?? []).forEach((s) => map.set(s.id, s));
    return map;
  }, [samples]);
  // 仅 bigwig 类主轨支持多样本叠加；其它轨道（bedGraph/is/tad/...）不传该参数。
  const overlaySampleIds = trackMainSpec.kind === 'bigwig' ? trackSampleIds : undefined;
  const overlayMeta =
    overlaySampleIds === undefined
      ? undefined
      : overlaySampleIds.map(
          (id) =>
            trackSampleById.get(id) ??
            // 缺失元数据兜底：保留 id 但字段为空——避免上层渲染崩溃。
            ({ id, species: '', tissue: '', breed: '', sex: '', individual: 0, dev_stage: '' } as Sample),
        );
  // --- end tracks 业务逻辑 ---

  // 把样本 catalog 同步到 zustand store（其他 viewer 只要 active 即可）。
  useEffect(() => { if (samples) setSamples(samples); }, [samples, setSamples]);
  useEffect(() => { if (sample) setActive(sample.id); }, [sample, setActive]);

  const candidates = useMemo(
    // 排除自己——compare 的可选集不包含自己。
    () => (samples ?? []).filter((item) => item.id !== sample?.id),
    [samples, sample?.id],
  );
  // 同品种 + 不同组织：compare 的"智能推荐"列表。
  const suggested = useMemo(
    () =>
      !sample
        ? []
        : candidates.filter(
            (item) => item.breed === sample.breed && item.tissue !== sample.tissue,
          ),
    [candidates, sample],
  );
  const query = searchQuery.trim().toLowerCase();
  const filteredSuggested = useMemo(
    () =>
      suggested.filter(
        (item) =>
          !query ||
          item.id.toLowerCase().includes(query) ||
          item.tissue.toLowerCase().includes(query),
      ),
    [suggested, query],
  );
  const allSamples = useMemo(
    () =>
      candidates
        .filter(
          (item) =>
            !query ||
            item.id.toLowerCase().includes(query) ||
            item.tissue.toLowerCase().includes(query),
        )
        // 副本排序：避免污染原数组（candidates 也会被其它逻辑用）。
        .slice()
        .sort((a, b) => a.id.localeCompare(b.id)),
    [candidates, query],
  );
  const canCompare = candidates.length > 0;

  if (isLoading) return <main className="route-page"><div className="route-content">{t('common.loading')}</div></main>;
  if (!sample) return <main className="route-page"><div className="model-missing"><strong>{t('sample.notFound.title')}</strong><p>{t('sample.notFound.description', { id: id ?? '' })}</p></div></main>;

  // compare 模式要求 partner 实际存在；缺失即视为关闭。
  const compareActive = isCompareMode && partner;

  const region = `${viewport.chr}:${viewport.start.toLocaleString()}-${viewport.end.toLocaleString()}`;
  // 标题 / 副标题 / breadcrumb 全部按是否 compare 走不同分支。
  const subtitle = compareActive && partner
    ? `${sample.tissue} vs ${partner.tissue} · ${sample.species} · ${sample.breed} vs ${partner.breed} · ${region}`
    : `${sample.species} · ${sample.tissue} · ${sample.breed} · ${sample.sex} · ${sample.dev_stage}`;

  // 写入 ?vs= 跳转对比；保留其它 URL 参数。
  const navigateToCompare = (targetId: string) => {
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.set('vs', targetId);
        return next;
      },
      { replace: false },
    );
  };

  const exitCompare = () => {
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.delete('vs');
        return next;
      },
      { replace: false },
    );
  };

  const title = compareActive && partner
    ? `${sample.id} vs ${partner.id}`
    : `${sample.id} — ${sample.tissue} (${sample.species})`;

  return (
    <RouteShell
      title={title}
      subtitle={subtitle}
      breadcrumb={
        compareActive && partner
          ? `${sample.species} › ${sample.tissue} › ${sample.id} vs ${partner.id}`
          : `${sample.species} › ${sample.tissue} › ${sample.id}`
      }
      actions={
        compareActive && partner ? (
          <div className="sample-actions">
            <button type="button" onClick={exitCompare} aria-label={t('sample.compare.closeButton')}>
              {t('sample.compare.closeButton')} ×
            </button>
          </div>
        ) : null
      }
      toolbar={
        <div className="sample-toolbar">
          <Popover
            width={240}
            trigger={(open) => (
              <button type="button" className="sample-picker-trigger" onClick={open}>
                {t('sample.actions.changeSample')} ▾
              </button>
            )}
          >
            {(close) => (
              <div className="sample-picker__menu">
                {(samples ?? []).map((item) => (
                  <Link key={item.id} to={`/sample/${item.id}`} onClick={close}>
                    {item.id}<small>{item.tissue} · {item.breed}</small>
                  </Link>
                ))}
              </div>
            )}
          </Popover>
          {!compareActive && (
            <div className="sample-tabs" role="tablist">
              {TABS.map((item) => (
                <button
                  key={item}
                  type="button"
                  role="tab"
                  aria-selected={tab === item}
                  className={tab === item ? 'active' : ''}
                  onClick={() => setTab(item)}
                >
                  {t(`sample.tabs.${item}`)}
                </button>
              ))}
            </div>
          )}
          {compareActive && (
            <div className="sample-tabs sample-tabs--compare" role="tablist">
              <button type="button" role="tab" aria-selected={true} className="active">
                {sample.id}
              </button>
              <button type="button" role="tab" aria-selected={true} className="active">
                vs {partner.id}
              </button>
            </div>
          )}
          {canCompare && (
            <Popover
              width={400}
              className="compare-picker"
              trigger={(open) => (
                <button
                  type="button"
                  className="sample-picker-trigger"
                  disabled={!canCompare}
                  onClick={open}
                >
                  {t('sample.actions.compareWith')} ▾
                </button>
              )}
            >
              {() => (
                <>
                  <div className="compare-picker__head">
                    <div className="compare-picker__title">{t('sample.comparePicker.title')} <em>{sample.id}</em></div>
                  </div>
                  <div className="compare-picker__body">
                    <div className="compare-picker__search">
                      <svg className="compare-picker__search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <circle cx="11" cy="11" r="7" />
                        <line x1="21" y1="21" x2="16.65" y2="16.65" />
                      </svg>
                      <input type="text" value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder={t('sample.comparePicker.search')} autoFocus />
                    </div>
                    <h4 className="compare-picker__section"><span className="compare-picker__meta-dot" aria-hidden="true" />{t('sample.comparePicker.suggested')}</h4>
                    {filteredSuggested.length === 0 ? <div className="compare-picker__empty-section">—</div> : filteredSuggested.map((other) => (
                      <button key={other.id} type="button" className="compare-picker__chip" onClick={() => navigateToCompare(other.id)}>
                        <span className="compare-picker__chip-id">{other.id}</span>
                        <span className="compare-picker__chip-tag">{t('sample.comparePicker.sameBreed')}</span>
                        <span className="compare-picker__chip-arrow" aria-hidden="true">→</span>
                      </button>
                    ))}
                    <h4 className="compare-picker__section">{t('sample.comparePicker.allSamples', { count: allSamples.length })}</h4>
                    <div className="compare-picker__list">
                      {allSamples.map((other) => (
                        <div key={other.id} role="button" tabIndex={0} className="compare-picker__row" onClick={() => navigateToCompare(other.id)} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); navigateToCompare(other.id); } }}>
                          <span className="compare-picker__row-id">{other.id}</span>
                          <span className="compare-picker__row-meta">{other.tissue} · {other.breed} · {other.sex}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="compare-picker__foot">{t('sample.comparePicker.helper')}</div>
                </>
              )}
            </Popover>
          )}
        </div>
      }
    >
      <div className="sample-region">{region} · {t('stage.binLabel', { bin: viewport.bin.toLocaleString() })}</div>
      <div ref={viewerRef} className="sample-viewer">
        {/* compare 模式：固定显示 Log2Heatmap + GeneLane，忽略 sub-tab */}
        {compareActive && partner ? (
          <>
            <Log2Heatmap sampleA={sample.id} sampleB={partner.id} />
            <GeneLane sampleId={sample.id} />
          </>
        ) : tab === 'tracks' ? (
          <>
            {overlaySampleIds && (
              <TrackSampleHeader
                title={TRACK_CATALOG[trackSubTab.id].title}
                sampleIds={overlaySampleIds}
                onSampleChange={setSampleIdsRaw}
                allSamples={samples ?? []}
                isCatalogLoading={isLoading}
              />
            )}
            <TracksModel
              tab={trackSubTab.id}
              sampleId={sample.id}
              aux={trackAux}
              overlaySampleIds={overlaySampleIds}
              overlayMeta={overlayMeta}
            />
          </>
        ) : (
          <ModelFactory type={MODEL_TYPES[tab]} />
        )}
      </div>
      <div className="sample-navigator">{t('sample.regionNavigator')}</div>
    </RouteShell>
  );
}

export default Sample;