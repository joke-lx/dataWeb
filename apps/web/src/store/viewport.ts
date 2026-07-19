import { create } from 'zustand';

interface Viewport {
  chr: string;
  start: number;
  end: number;
  bin: number;
}

interface ViewportStore {
  viewport: Viewport;
  setViewport: (v: Viewport) => void;
}

export const useViewport = create<ViewportStore>((set) => ({
  viewport: { chr: 'chr1', start: 1_000_000, end: 2_000_000, bin: 50_000 },
  setViewport: (viewport) => set({ viewport }),
}));