/**
 * trackSpec —— Tracks 模型的"轨道描述"与"sub-tab 描述"。
 *
 * 这个文件**没有**运行时副作用，只导出纯数据 / 纯类型，被 `TracksModel`、
 * `SubTabBar` 等组件静态 import。
 *
 * 关键概念：
 *  - `TrackId` = 路由 URL 中 `tab` 参数的合法值（如 `'rna_seq'`、`'tad'`）；
 *  - `TrackSpec.kind` 决定 lane 渲染组件（bigwig / bedGraph / is / pei …）；
 *  - `SUB_TABS` 描述路由 sub-tab 与固定辅助 lane 的绑定关系；
 *  - `GROUP_LABELS` 给 `SubTabBar` 用作分组 chip 上的标签。
 *
 * 架构位置：tracks 模型的"业务字典"——和 `routes/tracks/trackSpec.ts` 的
 * 路由 URL 表**不是**同一个文件；后者关心 URL 字符串与默认 tab，本文件
 * 关心渲染时的"轨道是什么 / 有多高 / 默认长什么样"。
 */

import type { BedKind } from '../../../api/types';

/** 路由 URL `tab` 参数的合法取值集合。 */
export type TrackId =
  | 'hic' | 'rna_seq' | 'h3k4me3' | 'h3k27ac'
  | 'ab' | 'is' | 'tad' | 'pei' | 'loop' | 'sv' | 'gene';

/**
 * 单条基因组轨道的渲染描述：`TracksModel` 按 `id` → `kind` 把轨道
 * 分派到对应的 Lane 组件。
 */
export interface TrackSpec {
  id: TrackId;
  /** 渲染分类——决定调用哪个 Lane 组件（详见 `TracksModel.renderMain / renderAux`）。 */
  kind: 'hic' | 'bigwig' | 'bedGraph' | 'is' | 'tadBar' | 'pei' | 'sv' | 'gene';
  /** 标题（在 header / 弹层 tooltip 上展示）。 */
  title: string;
  /** bigwig / bedGraph 的后端 track 名；缺省时取 `id`。 */
  trackName?: string;
  /** bed 子类型（用于 `fetchBed<'ab' | 'is' | 'tad' | 'pei' | 'gene'>` 类型分发）。 */
  bedKind?: BedKind;
  /** lane 默认像素高度。 */
  defaultHeight: number;
}

/**
 * 全部 TrackSpec 的目录：`Record<TrackId, ...>` 保证 `id` 一定有定义。
 * 新增轨道时：1) 加入 `TrackId` 联合；2) 在这里加一条；3)（如新 kind）
 * 在 `TracksModel.renderMain / renderAux` 加分派分支。
 */
export const TRACK_CATALOG: Record<TrackId, TrackSpec> = {
  hic:     { id: 'hic',     kind: 'hic',      title: 'Hi-C matrix',                defaultHeight: 480 },
  rna_seq: { id: 'rna_seq', kind: 'bigwig',   title: 'RNA-seq',     trackName: 'rna_seq',  defaultHeight: 180 },
  h3k4me3: { id: 'h3k4me3', kind: 'bigwig',   title: 'H3K4me3',     trackName: 'h3k4me3',  defaultHeight: 180 },
  h3k27ac: { id: 'h3k27ac', kind: 'bigwig',   title: 'H3K27ac',     trackName: 'h3k27ac',  defaultHeight: 180 },
  ab:      { id: 'ab',      kind: 'bedGraph',  title: 'AB index',    bedKind: 'ab',        defaultHeight: 150 },
  is:      { id: 'is',      kind: 'is',        title: 'Insulation',  bedKind: 'is',        defaultHeight: 150 },
  tad:     { id: 'tad',     kind: 'tadBar',    title: 'TAD boundary', bedKind: 'tad',      defaultHeight: 120 },
  pei:     { id: 'pei',     kind: 'pei',       title: 'PEI anchors', bedKind: 'pei',       defaultHeight: 180 },
  // 特例：Hi-C lane (320px) + SVG loop overlay + gene。LoopTrack 自己接管布局，
  // 因此 kind 仍是 `'hic'` 但 TRACK_CATALOG 不直接用于渲染——见 TracksModel 对 tab==='loop' 的特殊分支。
  loop:    { id: 'loop',    kind: 'hic',       title: 'Hi-C + loops',                 defaultHeight: 320 },
  sv:      { id: 'sv',      kind: 'sv',        title: 'Structural variants',           defaultHeight: 120 },
  gene:    { id: 'gene',    kind: 'gene',      title: 'Gene model',   bedKind: 'gene',  defaultHeight: 120 },
};

/**
 * Tracks 路由的 sub-tab 描述：每条 = 主 tab + 一组固定 aux lane。
 */
export interface SubTab {
  id: TrackId;
  /** 分组标签（用于 `SubTabBar` 上的分组聚合）。 */
  group: 'sequencing' | 'structure' | 'gene';
  /** sub-tab 上显示的文本。 */
  label: string;
  /** 该 sub-tab 的固定辅助 lane id 列表（顺序敏感 = 显示顺序）。 */
  aux: TrackId[];
}

/**
 * Sub-tab 描述表：每条定义主轨道 + 固定 aux lane。
 *
 * aux 是硬编码的（如 `'rna_seq'` 永远带 `['tad', 'gene']`）——
 * 改这里会同时改变 `<SubTabBar />` 上的分组和 `<TracksModel />` 的渲染。
 */
export const SUB_TABS: SubTab[] = [
  // 测序（Sequencing）
  { id: 'rna_seq', group: 'sequencing', label: 'RNA-seq',  aux: ['tad', 'gene'] },
  { id: 'h3k4me3', group: 'sequencing', label: 'H3K4me3',  aux: ['tad', 'gene'] },
  { id: 'h3k27ac', group: 'sequencing', label: 'H3K27ac',  aux: ['tad', 'gene'] },
  // 结构（Structure）
  { id: 'ab',      group: 'structure',  label: 'AB Index', aux: ['tad', 'gene'] },
  { id: 'is',      group: 'structure',  label: 'IS',       aux: ['tad', 'gene'] },
  { id: 'tad',     group: 'structure',  label: 'TAD',      aux: ['gene'] },
  { id: 'pei',     group: 'structure',  label: 'PEI',      aux: ['tad', 'gene'] },
  { id: 'sv',      group: 'structure',  label: 'SV',       aux: ['tad', 'gene'] },
  // 基因（Gene）
  { id: 'gene',    group: 'gene',       label: 'Gene',     aux: [] },
];

/** `SubTab.group` 在 UI 上展示的标签。 */
export const GROUP_LABELS: Record<SubTab['group'], string> = {
  sequencing: 'Sequencing',
  structure: 'Structure',
  gene: 'Annotation',
};
