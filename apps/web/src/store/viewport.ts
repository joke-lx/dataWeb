import { create } from 'zustand';

export interface Viewport {
  chr: string;
  start: number;
  end: number;
  bin: number;
}

interface ViewportStore extends Viewport {
  setViewport: (viewport: Partial<Viewport>) => void;
  zoom: (factor: number, centerBp?: number) => void;
  pan: (deltaBp: number) => void;
  setChrom: (chr: string) => void;
  setBin: (bin: number) => void;
}

const INITIAL: Viewport = {
  chr: 'chr1',
  start: 1_000_000,
  end: 2_000_000,
  bin: 50_000,
};

export const MIN_VIEWPORT_WIDTH_BP = 1_000;
export const MAX_VIEWPORT_WIDTH_BP = 300_000_000;

export const BIN_STEPS = [
  1_000_000,
  250_000,
  100_000,
  50_000,
  25_000,
  10_000,
  5_000,
];

export const useViewport = create<ViewportStore>((set, get) => ({
  ...INITIAL,
  setViewport: (viewport) => set((state) => ({ ...state, ...viewport })),
  zoom: (factor, centerBp) => {
    const { start, end } = get();
    const center = centerBp ?? (start + end) / 2;
    const width = end - start;
    const newWidth = Math.max(
      MIN_VIEWPORT_WIDTH_BP,
      Math.min(MAX_VIEWPORT_WIDTH_BP, width / factor),
    );
    const newStart = Math.max(0, center - newWidth / 2);
    set({ start: newStart, end: newStart + newWidth });
  },
  pan: (deltaBp) => {
    const { start, end } = get();
    const width = end - start;
    const newStart = Math.max(0, start + deltaBp);
    set({ start: newStart, end: newStart + width });
  },
  setChrom: (chr) =>
    set({ chr, start: 0, end: 1_000_000, bin: 50_000 }),
  setBin: (bin) => set({ bin }),
}));
