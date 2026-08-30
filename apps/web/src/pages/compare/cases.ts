/**
 * 对比案例库 —— 预定义的 A/B 配对。
 *
 * 职责:
 *  1. 暴露 `CompareCase` 类型 + `CompareTab` / `CompareTrackType` 子联合;
 *  2. 导出 `COMPARE_CASES` 常量(8 条预设,按 id 排序显示);
 *  3. 提供 `getCase(id)` 查表函数,供 `/compare/case/:id` 路由解析。
 *
 * 为什么存在(以及为什么在前端而不是后端):
 *  本次重构前,首页的"比较模式"区只有 4 张分类标签卡(tissue / breed /
 *  cross / developmental),无法直接进入任何对比;用户必须先到
 *  `/species/...` → `/sample/:id` → 点开 Popover。用户希望直接给出两类
 *  入口:① 自己选 A/B 的工作区(`/compare`);② 现成案例直达。
 *  按用户决策,案例数据不引入新的 FastAPI 端点,直接放在代码里 —— 这样
 *  case 文案和 id 与 i18n key 共处一处,便于对照修改;将来若需远端
 *  化,只需把 `COMPARE_CASES` 替换成一次 `fetch` 调用即可,type 不变。
 *
 * 设计契约(读这一段以理解类型字段):
 *  - `sampleA` / `sampleB` 必须落在当前 species catalog 的真实 sample id
 *    集合内。否则下游 `/sample?vs=` 会落到
 *    "sample not found" 分支 —— 这是有意为之的"fail-loud",避免页面上
 *    显示一个永远打不开的卡片。
 *  - `tab` 是 `Sample.tsx` 接受的 4 种 sub-tab 之一(`hic` / `tracks` /
 *    `3d` / `ctcfMotif`)的窄化联合;`type` 只在 `tab === 'tracks'` 时
 *    有意义(对齐 `trackSpec.ts::SUB_TABS` 的合法 id)。`type` 缺失时
 *    `/compare/case/:id` 的 URL 不写 `?type=`,`Sample.tsx` 的兜底逻辑
 *    会把 `type` 默认成 `'ab'`。
 *  - `titleKey` / `subtitleKey` 是 i18n 键路径(`home.cases.<id>.title`
 *    等);新增 case 时必须在 `i18n/messages/{en,zh-CN}.json` 同步加两
 *    条。本文件不做 i18n 校验 —— 由 review + `i18n:check` 脚本兜底。
 */
import type { TrackId } from '../../components/models/tracks/trackSpec';

/** Sample 页接受的 4 种 sub-tab(来自 `Sample.tsx` 的 `TABS` 常量)。 */
export type CompareTab = 'hic' | 'tracks' | '3d' | 'ctcfMotif';

/**
 * Tracks 子模式可选值 —— `?type=` 参数的合法集合。
 *
 * 这里从 `TrackId` 联合派生,保持与 `trackSpec.ts::SUB_TABS` 一致;
 * 若 SUB_TABS 增删轨道,这里会通过 TS 联合收紧/扩张自动跟上。
 */
export type CompareTrackType = Extract<TrackId, 'rna_seq' | 'h3k4me3' | 'h3k27ac' | 'ab' | 'is' | 'tad' | 'pei' | 'loop' | 'sv' | 'gene'>;

/** 一条预设对比案例。 */
export interface CompareCase {
  /** 路由 + 卡片 key 用,稳定字符串。 */
  id: string;
  /** i18n 键:`home.cases.<id>.title`。 */
  titleKey: string;
  /** i18n 键:`home.cases.<id>.subtitle`。 */
  subtitleKey: string;
  /** 主样本 id,跳到 `/sample/${sampleA}?vs=...`。 */
  sampleA: string;
  /** 对比样本 id,写到 `?vs=`。 */
  sampleB: string;
  /** Sample 页 sub-tab。 */
  tab: CompareTab;
  /**
   * Tracks sub-tab 的子模式(`tab === 'tracks'` 时才有意义)。
   * 缺省时 URL 不写 `?type=`,Sample 页兜底为 `ab`。
   */
  type?: CompareTrackType;
}

/**
 * 8 条预设案例 —— 全部基于现有 6 个 catalog sample,无虚构 id。
 *
 * 排序保持 "组织 → 品种 → 发育 → 轨道" 的认知分组;前端会按数组顺序
 * 渲染卡片网格。
 */
export const COMPARE_CASES: ReadonlyArray<CompareCase> = [
  // ── 跨组织 ──
  {
    id: 'tissue-berkshire-f',
    titleKey: 'home.cases.tissue-berkshire-f.title',
    subtitleKey: 'home.cases.tissue-berkshire-f.subtitle',
    sampleA: 'Liver_BF3',
    sampleB: 'Brain_BF3',
    tab: 'hic',
    type: 'ab',
  },
  {
    id: 'tissue-berkshire-m',
    titleKey: 'home.cases.tissue-berkshire-m.title',
    subtitleKey: 'home.cases.tissue-berkshire-m.subtitle',
    sampleA: 'Liver_BF3',
    sampleB: 'Muscle_BM4',
    tab: 'hic',
    type: 'ab',
  },
  // ── 品种间 ──
  {
    id: 'breed-brain',
    titleKey: 'home.cases.breed-brain.title',
    subtitleKey: 'home.cases.breed-brain.subtitle',
    sampleA: 'Brain_BF3',
    sampleB: 'Brain_TM4',
    tab: 'hic',
    type: 'ab',
  },
  {
    id: 'breed-muscle',
    titleKey: 'home.cases.breed-muscle.title',
    subtitleKey: 'home.cases.breed-muscle.subtitle',
    sampleA: 'Muscle_BM4',
    sampleB: 'Muscle_TM3',
    tab: 'hic',
    type: 'ab',
  },
  // ── 3D 结构 ──
  {
    id: 'organ-3d-brain',
    titleKey: 'home.cases.organ-3d-brain.title',
    subtitleKey: 'home.cases.organ-3d-brain.subtitle',
    sampleA: 'Brain_BF3',
    sampleB: 'Brain_TM4',
    tab: '3d',
  },
  // ── 发育阶段 ──
  {
    id: 'dev-liver-28d-vs-adult',
    titleKey: 'home.cases.dev-liver-28d-vs-adult.title',
    subtitleKey: 'home.cases.dev-liver-28d-vs-adult.subtitle',
    sampleA: 'Liver_TF2_28d',
    sampleB: 'Liver_BF3',
    tab: 'hic',
    type: 'ab',
  },
  // ── 信号轨道并排 ──
  {
    id: 'tracks-rna-brain-vs-liver',
    titleKey: 'home.cases.tracks-rna-brain-vs-liver.title',
    subtitleKey: 'home.cases.tracks-rna-brain-vs-liver.subtitle',
    sampleA: 'Brain_BF3',
    sampleB: 'Liver_BF3',
    tab: 'tracks',
    type: 'rna_seq',
  },
  {
    id: 'tracks-ab-brain-vs-liver',
    titleKey: 'home.cases.tracks-ab-brain-vs-liver.title',
    subtitleKey: 'home.cases.tracks-ab-brain-vs-liver.subtitle',
    sampleA: 'Brain_BF3',
    sampleB: 'Liver_BF3',
    tab: 'tracks',
    type: 'ab',
  },
];

/**
 * 按 id 查表;找不到时返回 `undefined`(`/compare/case/:id` 据此 fallback)。
 *
 * 用 `Array.prototype.find` 而非 `Map`:8 条数据下 O(n) 与 O(1) 几乎无差,
 * 且保持数组是单一 source of truth,避免两份同步问题。
 */
export function getCase(id: string): CompareCase | undefined {
  return COMPARE_CASES.find((c) => c.id === id);
}
