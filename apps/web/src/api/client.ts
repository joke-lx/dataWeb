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