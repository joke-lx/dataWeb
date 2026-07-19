import { create } from 'zustand';
import type { Sample } from '../api/types';

interface SamplesStore {
  samples: Sample[];
  setSamples: (s: Sample[]) => void;
  active: string | null;
  setActive: (id: string) => void;
}

export const useSamples = create<SamplesStore>((set) => ({
  samples: [],
  setSamples: (samples) => set({ samples }),
  active: null,
  setActive: (active) => set({ active }),
}));