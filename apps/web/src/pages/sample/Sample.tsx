/**
 * Sample 详情页：单样本 viewer 的同页线性容器。
 *
 * 职责：把 `<RouteShell>` 包装 + compare 模式（?vs=）+ sample picker +
 * 左侧数据/轨道控制台（`<SampleSidebar>`）等"外壳"职责集中在一处。
 * 真正的数据图表由对应 `<ModelFactory type="..." />` 渲染。
 *
 * 布局（参考参考站点详细页）：左侧窄栏 = 样本卡 + 视图区块勾选 + Tracks
 * 轨道多选 + 文件摘要；右侧主区 = 概览 → 文件 → Hi-C → 轨道 → 3D → CTCF
 * 线性堆叠。重型 viewer 由 `<InViewSection>` 懒挂载（滚动接近才加载 chunk），
 * 避免一次性拉起 WebGL / Plotly / three.js。
 *
 * 关键状态机：
 *   - 单一 sample → 所有区块自上而下渲染；
 *   - compare 模式（?vs= 合法 partner）→ 每个可视化区块内 A/B 并排；
 *   - `?tab=`（旧 tab 参数）向后兼容 → 映射到区块锚点并滚动。
 */

import { useCallback, useEffect, useMemo, useRef, useState, type JSX } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';

import type { Sample } from '../../api/types';
import type { HicNormalization } from '../../api/client';
import { ModelFactory } from '../../components/models';
import { InViewSection } from '../../components/lazy/InViewSection';
import { RegionInput } from '../../components/nav/RegionInput';
import { HicToolbar } from '../../components/nav/HicToolbar';
import { ZoomSlider } from '../../components/nav/ZoomSlider';
import { Popover } from '../../components/popover/Popover';
import { RouteShell } from '../../components/route/RouteShell';
import { TracksModel } from '../../components/models/tracks';
import { GenomeBrowserView } from '../../components/models/tracks/GenomeBrowserView';
import { ExportPdfButton } from '../../components/feedback/ExportPdfButton';
import { Loading } from '../../components/feedback/Loading';
import { CrosshairLayer } from '../../components/overlay/CrosshairLayer';
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
import {
  GENOME_BROWSER_TRACKS,
  SUB_TABS,
  TRACK_CATALOG,
} from '../../components/models/tracks/trackSpec';
import { OverviewSection } from './OverviewSection';
import { FilesSection } from './FilesSection';
import { CollapsibleSection } from './CollapsibleSection';
import { SampleSidebar, type SectionDef } from './SampleSidebar';
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
  hic: 900,
  tracks: 620,
  '3d': 480,
  ctcf: 420,
};

/** 支持侧边栏勾选展示的区块（可视化模型）。 */
const VIZ_SECTIONS: readonly string[] = ['hic', 'tracks', '3d', 'ctcf'];

/**
 * Sample 路由组件。
 * URL 参数：
 *   - `:id`        样本 id
 *   - `?vs=`       对比样本 id（compare 模式）
 *   - `?tab=`      旧 tab 参数 → 向后兼容映射到区块锚点滚动
 *   - `?types=`    Tracks 多选轨道（逗号分隔，顺序 = stacking 顺序）
 *   - `?type=`     旧 Tracks 单选参数（向后兼容，见 initialTypes）
 *   - `?samples=`  Tracks 多样本叠加（详见 useTrackSampleSelection）
 */
export function Sample(): JSX.Element {
  const { id } = useParams<{ id: string }>();
  const [params, setParams] = useSearchParams();
  const { t } = useAppIntl();
  const { samples, isLoading } = useSampleCatalog();
  const setActive = useSamples((state) => state.setActive);
  const setSamples = useSamples((state) => state.setSamples);
  useViewport();
  const partnerId = params.get('vs');
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
  const DEFAULT_TYPES: TrackId[] = ['ab', 'is', 'tad', 'loop', 'pc1', 'gene'];
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

  // ── Hi-C 快速调整工具栏状态（独立一行，受控下发给 GenomeBrowserView）──
  const [triangle, setTriangle] = useState(false);
  const [autoColor, setAutoColor] = useState(true);
  const [lockResolution, setLockResolution] = useState(false);
  const [normalization, setNormalization] = useState<HicNormalization>('log2');
  const [vmaxScale, setVmaxScale] = useState(1);
  const [colorMap, setColorMap] = useState<'rdbu' | 'viridis' | 'ref' | 'reds'>('ref');
  const [geneQuery, setGeneQuery] = useState('');
  const onGeneSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const q = geneQuery.trim();
    if (!q) return;
    // 后端 mock：跳转到 /sample/{id}?g=gene
    setParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set('g', q);
      return next;
    });
  };
  const hicWrapRef = useRef<HTMLDivElement>(null);
  const enterHicFullscreen = () => {
    const el = hicWrapRef.current;
    if (!el) return;
    if (document.fullscreenElement !== el) {
      el.requestFullscreen?.().catch(() => {});
    } else {
      document.exitFullscreen?.();
    }
  };

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
  // Hi-C 一体化视图的配套轨道（TAD/Loops/PC1/Gene）由 Hi-C 区块渲染；
  // Tracks 区块只渲染剩余的信号轨道（测序 + AB/IS/PEI/SV），避免两处重复。
  const signalTracks = useMemo(
    () => selectedTypes.filter((t) => !GENOME_BROWSER_TRACKS.includes(t)),
    [selectedTypes],
  );
  const trackRenderPlan = useMemo<Array<{ main: TrackId; aux: TrackId[] }>>(
    () => {
      // mainSet 用全量 selectedTypes：配套轨道视为"已被 Hi-C 区块覆盖"，
      // 使信号轨道的 tad/gene aux 不再重复渲染。
      const mainSet = new Set<TrackId>(selectedTypes);
      const auxSeen = new Set<TrackId>();
      return signalTracks.map((main) => {
        const tab = SUB_TABS.find((tt) => tt.id === main);
        const filteredAux = (tab?.aux ?? []).filter(
          (a) => !mainSet.has(a) && !auxSeen.has(a),
        );
        filteredAux.forEach((a) => auxSeen.add(a));
        return { main, aux: filteredAux };
      });
    },
    [signalTracks, selectedTypes],
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

  const { sampleIds: trackSampleIds } = useTrackSampleSelection();
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

  if (isLoading) return (
    <main className="route-page">
      <div className="route-content">
        <Loading variant="full" label={t('common.loading')} />
      </div>
    </main>
  );
  if (!sample) return <main className="route-page"><div className="model-missing"><strong>{t('sample.notFound.title')}</strong><p>{t('sample.notFound.description', { id: id ?? '' })}</p></div></main>;

  const compareActive = isCompareMode && Boolean(partner);

  // title/subtitle 已按设计稿隐藏（页面不再显示大标题）。

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

  // 左侧面板"下载文件"：滚动到文件区块（折叠时先展开）。
  const scrollToFiles = () => {
    setCollapsedSections((prev) => ({ ...prev, files: false }));
    const el = document.querySelector<HTMLElement>('[data-section="files"]');
    el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };


  // ── 各区块内容 ──



  const tracksBody = (
    <div className="sample-tracks-block">
      {signalTracks.length === 0 ? (
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

  const threeDBody = (
    <div className="gbv-subblock__body">
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
    </div>
  );

  const ctcfBody = (
    <div className="gbv-subblock__body">
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
    </div>
  );


  const hicSection = (
    <InViewSection minHeight={SECTION_MIN_HEIGHT.hic}>
      {/* Hi-C 主图：compare 模式为差异热图，否则为一体化视图（Hi-C + 配套轨道） */}
      {compareActive && partner ? (
        <>
          <Log2Heatmap sampleA={sample.id} sampleB={partner.id} />
          <GeneLane sampleId={sample.id} />
          {/* 对比模式：信号轨道 A/B 并排子块（Hi-C 配套轨道由上方视图承载） */}
          {visibleSections.tracks !== false && (
            <div className="gbv-subblock" data-section="tracks">
              <h4 className="gbv-subblock__title">{t('sample.sections.tracks')}</h4>
              {tracksBody}
            </div>
          )}
        </>
      ) : (
        <div className="gbv-hic-host" data-crosshair-host ref={hicWrapRef}>
          <div className="hic-viewbar">
            <span className="hic-viewbar__sample">{sample.id}</span>
            <button type="button" className="hic-viewbar__refresh" aria-label="Refresh view">
              <svg width="13" height="13" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <path d="M2.5 8a5.5 5.5 0 1 1 1.6 3.9M2.5 8V4.5M2.5 8H6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
            <span className="hic-viewbar__hap">Haplotype ID</span>
          </div>
          <GenomeBrowserView
            sampleId={sample.id}
            tracks={visibleSections.tracks !== false ? selectedTypes : []}
            labels={{
              tad: t('sample.genomeBrowser.tad'),
              loops: t('sample.genomeBrowser.loops'),
              pc1: t('sample.genomeBrowser.pc1'),
              gene: t('sample.genomeBrowser.gene'),
            }}
            hicOptions={{
              triangle,
              colorMode: autoColor ? 'auto' : 'full',
              normalization,
              lockResolution,
              vmaxScale,
              colorMap,
              onColorMapChange: setColorMap,
            }}
            hideInternalToolbar={!compareActive}
          />
          {/* 十字准线 + 区域说明：悬浮 Hi-C 时竖线贯穿全部轨道 */}
          <CrosshairLayer />
        </div>
      )}
      {visibleSections['3d'] !== false && (
        <div className="gbv-subblock" data-section="3d">
          <h4 className="gbv-subblock__title">{t('sample.sections.3d')}</h4>
          {threeDBody}
        </div>
      )}
      {visibleSections.ctcf !== false && (
        <div className="gbv-subblock" data-section="ctcf">
          <h4 className="gbv-subblock__title">{t('sample.sections.ctcf')}</h4>
          {ctcfBody}
        </div>
      )}
    </InViewSection>
  );
  return (
    <RouteShell
      title=""
      subtitle=""
      breadcrumb=""
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
          <form className="gene-search" onSubmit={onGeneSearch} role="search">
            <input
              className="gene-search__input"
              value={geneQuery}
              onChange={(e) => setGeneQuery(e.target.value)}
              placeholder="Search genes or input positions"
              aria-label="Search genes"
            />
            <button type="submit" className="gene-search__btn" aria-label="Search">
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <circle cx="7" cy="7" r="4.5" stroke="currentColor" strokeWidth="1.4"/>
                <path d="M10.5 10.5 L13.5 13.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
              </svg>
            </button>
          </form>
          <div className="sample-region">
            <RegionInput />
            <span className="sample-region__sep" aria-hidden="true">·</span>
            <span className="sample-region__bin-label">bin</span>
            <ZoomSlider />
          </div>
          {/* Hi-C 快速调整工具栏：与坐标/分辨率同行（compare 模式由各 ComparePanel 自带） */}
          {!compareActive && (
            <HicToolbar
              triangle={triangle}
              onTriangleChange={setTriangle}
              autoColor={autoColor}
              onAutoColorChange={setAutoColor}
              lockResolution={lockResolution}
              onLockResolutionChange={setLockResolution}
              normalization={normalization}
              onNormalizationChange={setNormalization}
              colorMap={colorMap}
              onColorMapChange={setColorMap}
              getCanvas={() => hicWrapRef.current?.querySelector<HTMLCanvasElement>('.hic-matrix canvas') ?? null}
              filenamePrefix={sample.id}
              onFullscreen={enterHicFullscreen}
              vmaxScale={vmaxScale}
              onVmaxScaleChange={setVmaxScale}
              actions={<ExportPdfButton label={t('sample.exportPdf')} />}
            />
          )}
        </div>
      }
    >
      <div className="sample-linear">
        {/* 左侧：数据 / 轨道控制台 + 概览 + 文件（统一在左栏滚动区，不挤占右侧可视化） */}
        <div className="sample-linear__left">
          <SampleSidebar
            sections={SECTIONS}
            sample={sample}
            partner={compareActive ? partner : undefined}
            compareActive={compareActive}
            toggleableIds={VIZ_SECTIONS}
            visible={visibleSections}
            onToggleVisible={toggleVisible}
            selectedTypes={selectedTypes}
            onToggleType={toggleType}
            onDownload={scrollToFiles}
          >
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
          </SampleSidebar>
        </div>

        {/* 右侧：主区线性堆叠（可视化） */}
        <div className="sample-linear__main">
          {visibleSections.hic !== false && (
            <section id="hic" data-section="hic" className="sample-section">
              {hicSection}
            </section>
          )}

          {/* 轨道 / 3D / CTCF 已合并进 Hi-C 区块（见 hicSection 内子块） */}
        </div>
      </div>
    </RouteShell>
  );
}

export default Sample;
