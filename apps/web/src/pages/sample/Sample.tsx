/**
 * Sample 详情页：单样本 viewer 的同页线性容器。
 *
 * 职责：把 `<RouteShell>` 包装 + compare 模式（?vs=）+ sample picker +
 * TrackSampleHeader 等"外壳"职责集中在一处。真正的数据图表由对应
 * `<ModelFactory type="..." />` 渲染。
 *
 * 布局（参考 detail.png）：sticky 区间栏 + 单页线性堆叠 —— 概览 → 文件 →
 * Hi-C → 轨道 → 3D → CTCF，右侧锚点导航跟随滚动。重型 viewer 由
 * `<InViewSection>` 懒挂载（滚动接近才加载 chunk），避免一次性拉起
 * WebGL / Plotly / three.js。
 *
 * 关键状态机：
 *   - 单一 sample → 所有区块自上而下渲染；
 *   - compare 模式（?vs= 合法 partner）→ 每个可视化区块内 A/B 并排。
 *   - `?tab=`（旧 tab 参数）向后兼容 → 映射到区块锚点并滚动。
 */

import { useCallback, useEffect, useMemo, useRef, useState, type JSX } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';

import type { Sample } from '../../api/types';
import { ModelFactory } from '../../components/models';
import { InViewSection } from '../../components/lazy/InViewSection';
import { RegionInput } from '../../components/nav/RegionInput';
import { ZoomSlider } from '../../components/nav/ZoomSlider';
import { Popover } from '../../components/popover/Popover';
import { RouteShell } from '../../components/route/RouteShell';
import { TracksModel } from '../../components/models/tracks';
import { SubTabBar } from '../../components/models/tracks/SubTabBar';
import { TrackSampleHeader } from '../../components/models/tracks/TrackSampleHeader';
import { GeneLane } from '../../components/models/differential/GeneLane';
import { Log2Heatmap } from '../../components/models/differential/Log2Heatmap';
import { ThreeDChromatin } from '../../components/models/3d/ThreeDChromatin';
import { CtcfModel } from '../../components/models/ctcf-motif';
import { useDragPan } from '../../hooks/useDragPan';
import { useSampleCatalog } from '../../hooks/useSampleCatalog';
import type { TrackId } from '../../components/models/tracks/trackSpec';
import { useTrackSampleSelection } from '../../hooks/useTrackSampleSelection';
import { useAppIntl } from '../../i18n';
import { useSamples } from '../../store/samples';
import { useViewport } from '../../store/viewport';
import { SUB_TABS, TRACK_CATALOG } from '../../components/models/tracks/trackSpec';
import { OverviewSection } from './OverviewSection';
import { FilesSection } from './FilesSection';
import { CollapsibleSection } from './CollapsibleSection';
import { SampleAnchorNav, type SectionDef } from './SampleAnchorNav';
import './sample.css';

/** Sample.tissue → ThreeDChromatin organ prop */
function tissueToOrgan(tissue: string): 'liver' | 'muscle' | 'brain' {
  const lower = tissue.toLowerCase();
  if (lower.includes('liver')) return 'liver';
  if (lower.includes('muscle')) return 'muscle';
  return 'brain';
}

/** 拖拽平移容器：包裹需要水平拖拽平移的 viewer（tracks / CTCF） */
function DragPanContainer({ children }: { children: React.ReactNode }): JSX.Element {
  const ref = useRef<HTMLDivElement>(null);
  useDragPan(ref);
  return <div ref={ref} className="drag-pan-container">{children}</div>;
}

/** 页面区块定义（顺序即渲染顺序）。 */
const SECTIONS: readonly SectionDef[] = [
  { id: 'overview', labelKey: 'sample.sections.overview', defaultLabel: 'Overview' },
  { id: 'files', labelKey: 'sample.sections.files', defaultLabel: 'Files' },
  { id: 'hic', labelKey: 'sample.sections.hic', defaultLabel: 'Hi-C' },
  { id: 'tracks', labelKey: 'sample.sections.tracks', defaultLabel: 'Tracks' },
  { id: '3d', labelKey: 'sample.sections.3d', defaultLabel: '3D' },
  { id: 'ctcf', labelKey: 'sample.sections.ctcf', defaultLabel: 'CTCF motif' },
];

/** 每个可视化区块的懒挂载最小高度（占位防锚点跳动）。 */
const SECTION_MIN_HEIGHT: Record<string, number> = {
  overview: 200,
  files: 320,
  hic: 560,
  tracks: 620,
  '3d': 480,
  ctcf: 420,
};

/**
 * 支持侧边栏勾选展示的区块（可视化模型）。
 * 取消勾选 → 整块从 DOM 卸载（释放 WebGL / Plotly / three.js 资源）。
 */
const VIZ_SECTIONS: readonly string[] = ['hic', 'tracks', '3d', 'ctcf'];

/**
 * Sample 路由组件。
 * URL 参数：
 *   - `:id`        样本 id
 *   - `?vs=`       对比样本 id（compare 模式）
 *   - `?tab=`      旧 tab 参数 → 向后兼容映射到区块锚点滚动
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
  const [searchQuery, setSearchQuery] = useState('');
  // 概览/文件标题折叠（默认展开）；4 个 viz 区块侧边栏勾选展示（默认全展示）。
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({});
  const [visibleSections, setVisibleSections] = useState<Record<string, boolean>>({});
  const toggleCollapsed = (id: string) => setCollapsedSections((prev) => ({ ...prev, [id]: !prev[id] }));
  const toggleVisible = (id: string) => setVisibleSections((prev) => ({ ...prev, [id]: !prev[id] }));
  const sample = useMemo(() => samples?.find((item) => item.id === id), [samples, id]);
  const partner = useMemo(
    () => (partnerId ? samples?.find((item) => item.id === partnerId) : undefined),
    [samples, partnerId],
  );
  // 严格判断 compare 模式：partnerId 存在 + 双方都找到 + 不等于自己。
  const isCompareMode = Boolean(partnerId && partner && sample && partnerId !== sample.id);

  // --- Tracks 多选 sub-tab 业务逻辑 ---
  // 默认预选 3 个核心结构轨道；URL ?types=a,b,c 同步用户选择顺序（决定 stacking 顺序）。
  // 兼容旧 ?type= 单选 URL（无 ?types= 时有 ?type= 则把它作为唯一选中项）。
  const DEFAULT_TYPES: TrackId[] = ['ab', 'is', 'tad'];
  const typesParam = params.get('types');
  const typeParam = params.get('type');
  const initialTypes = useMemo<TrackId[]>(() => {
    if (typesParam !== null) {
      const arr = typesParam
        .split(',')
        .filter((t) => SUB_TABS.some((tt) => tt.id === t)) as TrackId[];
      return arr.length > 0 ? arr : DEFAULT_TYPES;
    }
    if (typeParam !== null && SUB_TABS.some((tt) => tt.id === typeParam)) {
      return [typeParam as TrackId];
    }
    return DEFAULT_TYPES;
  }, []); // 只在首挂载初始化一次
  const [selectedTypes, setSelectedTypes] = useState<TrackId[]>(initialTypes);

  // toggle 一个 tab：已选则移除、未选则追加（保持原顺序，追加到末尾）。
  const toggleType = useCallback(
    (id: string) => {
      setSelectedTypes((prev) => {
        if (prev.includes(id as TrackId)) return prev.filter((t) => t !== id);
        return [...prev, id as TrackId];
      });
    },
    [],
  );

  /**
   * 去重渲染计划：多选时每个 tab 的 aux（TAD/Gene 等）会被多个主轨道重复
   * 携带 —— 这里过滤出"未被任何选中主轨道覆盖、且未被前面的 aux 用过"的
   * aux，保证 TAD / Gene 在整个 tracks 区块只渲染一次。
   * 单选时行为与旧版一致（主轨道 + 完整 aux 上下文）。
   */
  const trackRenderPlan = useMemo<Array<{ main: TrackId; aux: TrackId[] }>>(
    () => {
      const mainSet = new Set<TrackId>(selectedTypes);
      const auxSeen = new Set<TrackId>();
      return selectedTypes.map((main) => {
        const tab = SUB_TABS.find((tt) => tt.id === main);
        const filteredAux = (tab?.aux ?? []).filter(
          (a) => !mainSet.has(a) && !auxSeen.has(a),
        );
        filteredAux.forEach((a) => auxSeen.add(a));
        return { main, aux: filteredAux };
      });
    },
    [selectedTypes],
  );

  // URL 同步：写 ?types=，并清掉旧 ?type= 字段避免混淆。
  useEffect(() => {
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (selectedTypes.length === 0) {
          next.delete('types');
        } else {
          next.set('types', selectedTypes.join(','));
        }
        next.delete('type');
        return next;
      },
      { replace: false },
    );
  }, [selectedTypes, setParams]);

  const { sampleIds: trackSampleIds, setSampleIdsRaw } = useTrackSampleSelection();
  // 把样本列表 index 成 Map 便于 O(1) 取——叠加多 sample 时 linear find 太慢。
  const trackSampleById = useMemo(() => {
    const map = new Map<string, Sample>();
    (samples ?? []).forEach((s) => map.set(s.id, s));
    return map;
  }, [samples]);
  // 仅 bigwig 类主轨支持多样本叠加；其它轨道（bedGraph/is/tad/...）不传该参数。
  // 多选时所有选中的 bigwig tab 共享同一份 overlaySampleIds（同一组样本叠加）。
  const overlaySampleIds = trackSampleIds;
  const overlayMeta =
    overlaySampleIds === undefined
      ? undefined
      : overlaySampleIds.map(
          (oid) =>
            trackSampleById.get(oid) ??
            // 缺失元数据兜底：保留 id 但字段为空——避免上层渲染崩溃。
            ({ id: oid, species: '', tissue: '', breed: '', sex: '', individual: 0, dev_stage: '' } as Sample),
        );
  // --- end tracks 多选业务逻辑 ---

  // 把样本 catalog 同步到 zustand store（其他 viewer 只要 active 即可）。
  useEffect(() => { if (samples) setSamples(samples); }, [samples, setSamples]);
  useEffect(() => { if (sample) setActive(sample.id); }, [sample, setActive]);

  // 向后兼容 ?tab=：首挂载后滚动到对应区块锚点。
  useEffect(() => {
    if (!sample || isLoading) return;
    const rawTab = params.get('tab');
    const hash = window.location.hash.replace('#', '');
    const target = rawTab
      ? rawTab === 'ctcfMotif' ? 'ctcf' : rawTab === '3d' ? '3d' : rawTab
      : hash || null;
    if (target) {
      const el = document.querySelector<HTMLElement>(`[data-section="${target}"]`);
      if (el) {
        // 初载用 auto（不打断首屏），稍后一次 rAF 再滚。
        requestAnimationFrame(() => el.scrollIntoView({ behavior: 'auto', block: 'start' }));
      }
    }
    // 只在首挂载时执行一次。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoading]);

  const candidates = useMemo(
    () => (samples ?? []).filter((item) => item.id !== sample?.id),
    [samples, sample?.id],
  );
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
        .slice()
        .sort((a, b) => a.id.localeCompare(b.id)),
    [candidates, query],
  );
  const canCompare = candidates.length > 0;

  if (isLoading) return <main className="route-page"><div className="route-content">{t('common.loading')}</div></main>;
  if (!sample) return <main className="route-page"><div className="model-missing"><strong>{t('sample.notFound.title')}</strong><p>{t('sample.notFound.description', { id: id ?? '' })}</p></div></main>;

  const compareActive = isCompareMode && Boolean(partner);

  const region = `${viewport.chr}:${viewport.start.toLocaleString()}-${viewport.end.toLocaleString()}`;
  const subtitle = compareActive && partner
    ? `${sample.tissue} vs ${partner.tissue} · ${sample.species} · ${sample.breed} vs ${partner.breed} · ${region}`
    : `${sample.species} · ${sample.tissue} · ${sample.breed} · ${sample.sex} · ${sample.dev_stage}`;

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

  // ── 各区块内容 ──

  const hicSection = (
    <InViewSection minHeight={SECTION_MIN_HEIGHT.hic}>
      {compareActive && partner ? (
        <>
          <Log2Heatmap sampleA={sample.id} sampleB={partner.id} />
          <GeneLane sampleId={sample.id} />
        </>
      ) : (
        <ModelFactory type="hic" />
      )}
    </InViewSection>
  );

  const tracksSection = (
    <div className="sample-tracks-block">
      <SubTabBar
        tabs={SUB_TABS}
        value={selectedTypes}
        onChange={toggleType}
      />
      {selectedTypes.length === 0 ? (
        <div className="tracks-empty">{t('tracks.empty')}</div>
      ) : (
        trackRenderPlan.map(({ main, aux }) => {
          const tab = SUB_TABS.find((tt) => tt.id === main);
          if (!tab) return null;
          const spec = TRACK_CATALOG[main];
          const isBigwig = spec.kind === 'bigwig';
          return (
            <InViewSection key={main} minHeight={SECTION_MIN_HEIGHT.tracks}>
              <DragPanContainer>
                {!compareActive && isBigwig && overlaySampleIds && (
                  <TrackSampleHeader
                    title={spec.title}
                    sampleIds={overlaySampleIds}
                    onSampleChange={setSampleIdsRaw}
                    allSamples={samples ?? []}
                    isCatalogLoading={isLoading}
                  />
                )}
                {compareActive && partner ? (
                  <div className="compare-tracks">
                    {/* 对比模式：同类型上下 A/B 并排，只显示主轨道 —— aux 不重复渲染
                        （对比目的就是看同一类型的 A/B 差异，TAD/Gene 上下文不堆叠）。 */}
                    <div className="compare-tracks__block">
                      <span className="compare-label">{sample.id}</span>
                      <TracksModel tab={main} sampleId={sample.id} aux={[]} />
                    </div>
                    <div className="compare-tracks__block">
                      <span className="compare-label">{partner.id}</span>
                      <TracksModel tab={main} sampleId={partner.id} aux={[]} />
                    </div>
                  </div>
                ) : (
                  <TracksModel
                    tab={main}
                    sampleId={sample.id}
                    aux={aux}
                    overlaySampleIds={isBigwig ? overlaySampleIds : undefined}
                    overlayMeta={isBigwig ? overlayMeta : undefined}
                  />
                )}
              </DragPanContainer>
            </InViewSection>
          );
        })
      )}
    </div>
  );

  const threeDSection = (
    <InViewSection minHeight={SECTION_MIN_HEIGHT['3d']}>
      {compareActive && partner ? (
        <div className="compare-3d">
          <div className="compare-3d__panel">
            <ThreeDChromatin organ={tissueToOrgan(sample.tissue)} sampleId={sample.id} />
            <span className="compare-label">{sample.id}</span>
          </div>
          <div className="compare-3d__panel">
            <ThreeDChromatin organ={tissueToOrgan(partner.tissue)} sampleId={partner.id} />
            <span className="compare-label">{partner.id}</span>
          </div>
        </div>
      ) : (
        <ModelFactory type="3d" />
      )}
    </InViewSection>
  );

  const ctcfSection = (
    <InViewSection minHeight={SECTION_MIN_HEIGHT.ctcf}>
      {compareActive && partner ? (
        <DragPanContainer>
          <div className="compare-ctcf">
            <div className="compare-ctcf__panel">
              <span className="compare-label">{sample.id}</span>
              <CtcfModel />
            </div>
            <div className="compare-ctcf__panel">
              <span className="compare-label">{partner.id}</span>
              <CtcfModel />
            </div>
          </div>
        </DragPanContainer>
      ) : (
        <DragPanContainer>
          <ModelFactory type="ctcf-motif" />
        </DragPanContainer>
      )}
    </InViewSection>
  );

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
          <div className="sample-toolbar__title">
            {compareActive && partner ? `${sample.id} vs ${partner.id}` : sample.id}
          </div>
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
                    {filteredSuggested.length === 0 ? <div className="compare-picker__empty-section">—</div> : filteredSuggested.map((other) => {
                      const isSelected = other.id === partnerId;
                      return (
                        <button key={other.id} type="button" className={'compare-picker__chip' + (isSelected ? ' compare-picker__chip--selected' : '')} onClick={() => isSelected ? exitCompare() : navigateToCompare(other.id)}>
                          <span className="compare-picker__chip-id">{other.id}</span>
                          {isSelected ? <span className="compare-picker__chip-tag">✓</span> : <span className="compare-picker__chip-tag">{t('sample.comparePicker.sameBreed')}</span>}
                          <span className="compare-picker__chip-arrow" aria-hidden="true">{isSelected ? '×' : '→'}</span>
                        </button>
                      );
                    })}
                    <h4 className="compare-picker__section">{t('sample.comparePicker.allSamples', { count: allSamples.length })}</h4>
                    <div className="compare-picker__list">
                      {allSamples.map((other) => {
                        const isSelected = other.id === partnerId;
                        return (
                          <div key={other.id} role="button" tabIndex={0} className={'compare-picker__row' + (isSelected ? ' compare-picker__row--selected' : '')} onClick={() => isSelected ? exitCompare() : navigateToCompare(other.id)} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); isSelected ? exitCompare() : navigateToCompare(other.id); } }}>
                            <span className="compare-picker__row-id">{other.id}</span>
                            <span className="compare-picker__row-meta">{other.tissue} · {other.breed} · {other.sex}{isSelected ? ' · ✓' : ''}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                  <div className="compare-picker__foot">{t('sample.comparePicker.helper')}</div>
                </>
              )}
            </Popover>
          )}
          <div className="sample-region">
            <RegionInput />
            <span className="sample-region__sep" aria-hidden="true">·</span>
            <span className="sample-region__bin-label">bin</span>
            <ZoomSlider />
          </div>
        </div>
      }
    >
      <div className="sample-linear">
        <div className="sample-linear__main">
          <CollapsibleSection
            id="overview"
            title={t('sample.sections.overview')}
            collapsed={Boolean(collapsedSections.overview)}
            onToggle={() => toggleCollapsed('overview')}
          >
            <OverviewSection sample={sample} partner={compareActive ? partner : undefined} />
          </CollapsibleSection>

          <CollapsibleSection
            id="files"
            title={t('sample.sections.files')}
            collapsed={Boolean(collapsedSections.files)}
            onToggle={() => toggleCollapsed('files')}
          >
            <FilesSection sampleId={sample.id} compareActive={compareActive} />
          </CollapsibleSection>

          {visibleSections.hic !== false && (
            <section id="hic" data-section="hic" className="sample-section">
              <h3 className="sample-section__title">{t('sample.sections.hic')}</h3>
              {hicSection}
            </section>
          )}

          {visibleSections.tracks !== false && (
            <section id="tracks" data-section="tracks" className="sample-section">
              <h3 className="sample-section__title">{t('sample.sections.tracks')}</h3>
              {tracksSection}
            </section>
          )}

          {visibleSections['3d'] !== false && (
            <section id="3d" data-section="3d" className="sample-section">
              <h3 className="sample-section__title">{t('sample.sections.3d')}</h3>
              {threeDSection}
            </section>
          )}

          {visibleSections.ctcf !== false && (
            <section id="ctcf" data-section="ctcf" className="sample-section">
              <h3 className="sample-section__title">{t('sample.sections.ctcf')}</h3>
              {ctcfSection}
            </section>
          )}
        </div>

        <SampleAnchorNav
          sections={SECTIONS}
          compareActive={compareActive}
          a={sample.id}
          b={partner?.id}
          toggleableIds={VIZ_SECTIONS}
          visible={visibleSections}
          onToggle={toggleVisible}
        />
      </div>
    </RouteShell>
  );
}

export default Sample;
