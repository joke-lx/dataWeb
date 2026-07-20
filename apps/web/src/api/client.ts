import type {
  BedKind,
  BedRecordByKind,
  Sample,
  Species,
} from './types';

const API_BASE = ''; // proxied via vite

export async function fetchSpecies(): Promise<Species[]> {
  const r = await fetch(`${API_BASE}/api/species`);
  if (!r.ok) throw new Error(`species: ${r.status}`);
  return r.json();
}

export async function fetchSamples(species: string): Promise<Sample[]> {
  const r = await fetch(`${API_BASE}/api/species/${species}/samples`);
  if (!r.ok) throw new Error(`samples: ${r.status}`);
  return r.json();
}

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
  if (dtype !== 'float32') throw new Error(`unexpected dtype: ${dtype}`);

  const values = new Float32Array(buf);
  const headerVmin = r.headers.get('X-Genomics-Vmin');
  const headerVmax = r.headers.get('X-Genomics-Vmax');
  let inferredMin = 0;
  let inferredMax = 1;
  if (values.length > 0) {
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
  return response.records ?? [];
}

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

export interface HicMatrixResponse {
  matrix: Float32Array;
  shape: [number, number];
  vmin: number;
  vmax: number;
}

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
  const shapeStr = r.headers.get('X-Genomics-Shape') ?? '0,0';
  const [h, w] = shapeStr.split(',').map(Number);
  const vmin = parseFloat(r.headers.get('X-Genomics-Vmin') ?? '0');
  const vmax = parseFloat(r.headers.get('X-Genomics-Vmax') ?? '1');
  return { matrix: new Float32Array(buf), shape: [h, w], vmin, vmax };
}

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