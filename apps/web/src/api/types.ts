/**
 * API 响应 / 请求类型集合。
 *
 * 职责：纯类型层，定义 `/api/*` 端点使用的领域模型（物种、样本、BED 记录、
 * CTCF motif / genotype）。这些类型同时被 `api/client.ts` 反序列化结果和
 * 上层 hooks / 组件消费，因此放在独立的 `types.ts` 以避免循环依赖。
 *
 * 为什么这里：因为浏览器端没有 Python 风格的 schema 校验契约，
 * 这里的 interface 就是后端 ↔ 前端事实上的协议。
 */

/** 一个物种（assembly + 染色体列表），对应 `/api/species` 返回。 */
export interface Species {
  id: string;
  assembly: string;
  chromosomes: { name: string; length: number }[];
}

/** 一个多组学样本（RNA-seq / Hi-C / ChIP-seq 等共用的元数据）。 */
export interface Sample {
  id: string;
  species: string;
  tissue: string;
  breed: string;
  sex: string;
  individual: number;
  dev_stage: string;
}

/** 一个可下载的文件（后端 /api/download/files 返回项）。 */
export interface SampleFileMeta {
  file: string;
  format: string;
  size_bytes: number;
  description?: string;
}

/** BED 类记录共有的区间字段（chrom / start / end）。 */
interface IntervalRecord {
  chrom: string;
  start: number;
  end: number;
}

/** AB index / 类似打分轨道的 bedGraph 记录 = 区间 + score。 */
export interface BedGraphRecord extends IntervalRecord {
  score: number;
}

/** TAD 边界记录（区间 + 强度）。 */
export interface TadRecord extends IntervalRecord {
  score: number;
}

/** PEI（启动子-增强子互作）记录，多带一个 `gene_id` 与距离。 */
export interface PeiRecord extends IntervalRecord {
  gene_id: string;
  distance_kb: number;
  score: number;
}

/** 基因模型记录（外显子/内含子着色、链方向）。 */
export interface GeneRecord extends IntervalRecord {
  gene_name: string;
  exon_index: number;
  strand: string;
  is_exon: boolean;
}

/** BED 查询支持的子类型集合 —— 每种对应不同的字段集合。 */
export type BedKind = 'ab' | 'tad' | 'pei' | 'gene' | 'is';

/**
 * 把 `BedKind` 映射到对应记录类型的查找表。
 * `fetchBed` 的泛型依赖此表实现类型安全的返回。
 */
export interface BedRecordByKind {
  ab: BedGraphRecord;
  tad: TadRecord;
  pei: PeiRecord;
  gene: GeneRecord;
  is: BedGraphRecord;
}

/** CTCF motif PWM 响应：PWM 矩阵 + 一致性序列 + motif 锚点位置。 */
export interface CtcfMotifResponse {
  matrix: number[][];
  consensus: string;
  anchor_pos: number;
}

/** 单个 CTCF 群体 SNP：参考/可变等位基因 + 三种基因型的分布。 */
export interface CtcfGenotypeRecord {
  snp_id: string;
  chrom: string;
  pos: number;
  ref_allele: string;
  alt_allele: string;
  distribution: {
    ref_hom: number;
    het: number;
    alt_hom: number;
  };
}

/** `/api/ctcf/genotype` 的顶层响应：SNP 列表。 */
export interface CtcfGenotypeResponse {
  records: CtcfGenotypeRecord[];
}
