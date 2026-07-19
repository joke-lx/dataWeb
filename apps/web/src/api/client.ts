import type { Species, Sample } from './types';

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
  const r = await fetch(
    `${API_BASE}/api/hic/matrix?sample=${encodeURIComponent(sample)}&chr=${encodeURIComponent(chr)}&start=${start}&end=${end}&bin=${bin}`,
  );
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