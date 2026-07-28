/**
 * dataWeb 后端 REST API 客户端。
 *
 * 职责：把所有 /api/* 端点封装成强类型的异步函数，让上层 React 代码只关心
 * （sample, 区间, 轨道）这类领域参数，不必直接拼 URL、解析 dtype header 或
 * 处理浮点 ArrayBuffer。
 *
 * 架构位置：处于 view-model 层（hooks / components）之下、数据源之上。
 * 关键的二进制端点（bigwig / hic / differential）使用 `arrayBuffer()`
 * + 自定义 `X-Genomics-*` header 传输 dtype/shape/vmin/vmax，省去 JSON
 * 序列化的成本与精度损失。
 *
 * 为什么这里：vite 把 `/api/*` 代理到后端（同源），所以 base 留空字符串。
 */

import type {
  BedKind,
  BedRecordByKind,
  CtcfGenotypeResponse,
  CtcfMotifResponse,
  Sample,
  Species,
} from './types';

const API_BASE = ''; // 通过 vite 代理

/** 一条结构变异（structural variant）记录，对应 `/api/sv` 响应。 */
export interface SVRecord {
  chrom: string;
  start: number;
  end: number;
  kind: 'DEL' | 'DUP' | 'INV' | 'TRA';
  score: number;
}

/**
 * 拉取所有可用物种（assembly + 染色体列表）。
 * 失败时抛出 `species: <status>` 形式的 Error，方便上层在 UI 中显示。
 */
export async function fetchSpecies(): Promise<Species[]> {
  const r = await fetch(`${API_BASE}/api/species`);
  if (!r.ok) throw new Error(`species: ${r.status}`);
  return r.json();
}

/**
 * 列出某个物种下的所有样本。
 * 与 `useSampleCatalog` 的 queryKey 必须保持一致，否则缓存会脱钩。
 */
export async function fetchSamples(species: string): Promise<Sample[]> {
  const r = await fetch(`${API_BASE}/api/species/${species}/samples`);
  if (!r.ok) throw new Error(`samples: ${r.status}`);
  return r.json();
}

/**
 * 从 bigwig 轨道读取指定区间的归一化分箱值。
 * 后端返回原始 `float32` ArrayBuffer，并在自定义 header 里附 dtype / shape /
 * vmin / vmax。这里直接重建 `Float32Array` 避免拷贝。
 *
 * vmin/vmax 优先用 header（后端基于全图统计），失败时才在前端从样本里推断，
 * 推断值只能用于渲染兜底，不能跨样本复用。
 */
export async function fetchBigwig(
  sample: string,
  track: string,
  chr: string,
  start: number,
  end: number,
  bins: number,
): Promise<{ values: Float32Array; vmin: number; vmax: number }> {
  const params = new URLSearchParams({
    sample,
    track,
    chr,
    start: String(Math.floor(start)),
    end: String(Math.ceil(end)),
    bins: String(Math.max(1, Math.round(bins))),
  });
  const r = await fetch(`${API_BASE}/api/bigwig/values?${params}`);
  if (!r.ok) throw new Error(`bigwig: ${r.status}`);
  const buf = await r.arrayBuffer();
  const dtype = r.headers.get('X-Genomics-Dtype') ?? 'float32';
  // 严格只接受 float32；其它 dtype 表示后端契约变更，必须 fail-loud 而不是默默 reinterpret。
  if (dtype !== 'float32') throw new Error(`unexpected dtype: ${dtype}`);

  const values = new Float32Array(buf);
  const headerVmin = r.headers.get('X-Genomics-Vmin');
  const headerVmax = r.headers.get('X-Genomics-Vmax');
  let inferredMin = 0;
  let inferredMax = 1;
  if (values.length > 0) {
    // 防止 NaN：当 header 缺失时，按区间样本计算 min/max，提供最起码的色阶参考。
    inferredMin = values[0];
    inferredMax = values[0];
    for (let index = 1; index < values.length; index += 1) {
      inferredMin = Math.min(inferredMin, values[index]);
      inferredMax = Math.max(inferredMax, values[index]);
    }
  }

  return {
    values,
    vmin: headerVmin === null ? inferredMin : Number.parseFloat(headerVmin),
    vmax: headerVmax === null ? inferredMax : Number.parseFloat(headerVmax),
  };
}

/**
 * 通用 BED 重叠查询。
 * 泛型 `K extends BedKind` + `BedRecordByKind[K]` 让每种 kind 自动返回对应的
 * 记录结构（AB / TAD / PEI / Gene / IS），无需在调用处强转。
 */
export async function fetchBed<K extends BedKind>(
  sample: string,
  kind: K,
  chr: string,
  start: number,
  end: number,
): Promise<BedRecordByKind[K][]> {
  const params = new URLSearchParams({
    sample,
    kind,
    chr,
    start: String(Math.floor(start)),
    end: String(Math.ceil(end)),
  });
  const r = await fetch(`${API_BASE}/api/bed/overlap?${params}`);
  if (!r.ok) throw new Error(`bed: ${r.status}`);
  const response = (await r.json()) as {
    records?: BedRecordByKind[K][];
  };
  // 后端允许响应里没有 records（空区间），统一兜底为 []。
  return response.records ?? [];
}

/** 区间内的结构变异列表，调用约定与 `fetchBed` 类似。 */
export async function fetchSV(
  sample: string,
  chr: string,
  start: number,
  end: number,
): Promise<SVRecord[]> {
  const params = new URLSearchParams({
    sample,
    chr,
    start: String(Math.floor(start)),
    end: String(Math.ceil(end)),
  });
  const r = await fetch(`${API_BASE}/api/sv?${params}`);
  if (!r.ok) throw new Error(`sv: ${r.status}`);
  const response = (await r.json()) as { records?: SVRecord[] };
  return response.records ?? [];
}

/** Hi-C 矩阵响应：行优先 float32 平面数组 + shape + 全局色阶范围。 */
export interface HicMatrixResponse {
  matrix: Float32Array;
  shape: [number, number];
  vmin: number;
  vmax: number;
}

/**
 * 拉取 Hi-C 接触矩阵。
 * 与 bigwig 相同：使用 arrayBuffer + 自定义 header 传输 dtype/shape/vmin/vmax，
 * 不做 JSON 序列化。
 */
export async function fetchHicMatrix(
  sample: string,
  chr: string,
  start: number,
  end: number,
  bin: number,
): Promise<HicMatrixResponse> {
  const params = new URLSearchParams({
    sample,
    chr,
    start: String(Math.floor(start)),
    end: String(Math.ceil(end)),
    bin: String(Math.max(1, Math.round(bin))),
  });
  const r = await fetch(`${API_BASE}/api/hic/matrix?${params}`);
  if (!r.ok) throw new Error(`hic: ${r.status}`);
  const buf = await r.arrayBuffer();
  const dtype = r.headers.get('X-Genomics-Dtype') ?? 'float32';
  if (dtype !== 'float32') throw new Error(`unexpected dtype: ${dtype}`);
  // shape 形如 "h,w"；后端不传则退回 0x0，由调用方识别为无数据。
  const shapeStr = r.headers.get('X-Genomics-Shape') ?? '0,0';
  const [h, w] = shapeStr.split(',').map(Number);
  const vmin = parseFloat(r.headers.get('X-Genomics-Vmin') ?? '0');
  const vmax = parseFloat(r.headers.get('X-Genomics-Vmax') ?? '1');
  return { matrix: new Float32Array(buf), shape: [h, w], vmin, vmax };
}

/**
 * CTCF motif PWM：用于 /ctcf-motif viewer 的某一区间。
 * `sample` 默认值为 'default'，因为 motif 矩阵与样本无关，但接口仍保留参数以
 * 方便未来按物种/品种做特异性 motif。
 */
export async function fetchCtcfMotif(
  chr: string,
  start: number,
  end: number,
  sample: string = 'default',
): Promise<CtcfMotifResponse> {
  const params = new URLSearchParams({
    sample,
    chr,
    start: String(Math.floor(start)),
    end: String(Math.ceil(end)),
  });
  const r = await fetch(`${API_BASE}/api/ctcf/motif?${params}`);
  if (!r.ok) throw new Error(`ctcf/motif: ${r.status}`);
  return r.json() as Promise<CtcfMotifResponse>;
}

/**
 * 群体级别的 CTCF 结合位点 SNP 基因型分布。
 * `population` 默认 'global'，约定为第一个内置 panel（用于演示）。
 */
export async function fetchCtcfGenotype(
  population: string = 'global',
): Promise<CtcfGenotypeResponse> {
  const params = new URLSearchParams({ population });
  const r = await fetch(`${API_BASE}/api/ctcf/genotype?${params}`);
  if (!r.ok) throw new Error(`ctcf/genotype: ${r.status}`);
  return r.json() as Promise<CtcfGenotypeResponse>;
}

/**
 * Differential Hi-C：两个样本之间的 log2 差异矩阵。
 * 与 `fetchHicMatrix` 走同一条二进制路径，区别仅在请求参数多了一对 sample id。
 */
export async function fetchDifferentialHic(
  sampleA: string,
  sampleB: string,
  chr: string,
  start: number,
  end: number,
  bin: number,
): Promise<HicMatrixResponse> {
  const params = new URLSearchParams({
    sample_a: sampleA,
    sample_b: sampleB,
    chr,
    start: String(Math.floor(start)),
    end: String(Math.ceil(end)),
    bin: String(Math.max(1, Math.round(bin))),
  });
  const r = await fetch(`${API_BASE}/api/differential/matrix?${params}`);
  if (!r.ok) throw new Error(`differential: ${r.status}`);
  const buf = await r.arrayBuffer();
  const dtype = r.headers.get('X-Genomics-Dtype') ?? 'float32';
  if (dtype !== 'float32') throw new Error(`unexpected dtype: ${dtype}`);
  const shapeStr = r.headers.get('X-Genomics-Shape') ?? '0,0';
  const [h, w] = shapeStr.split(',').map(Number);
  const vmin = parseFloat(r.headers.get('X-Genomics-Vmin') ?? '0');
  const vmax = parseFloat(r.headers.get('X-Genomics-Vmax') ?? '1');
  return { matrix: new Float32Array(buf), shape: [h, w], vmin, vmax };
}