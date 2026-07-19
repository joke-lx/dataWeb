import { create } from 'zustand';

export type CursorTrack =
  | 'bigwig'
  | 'ab'
  | 'tad'
  | 'pei'
  | 'gene'
  | 'hic';

interface CursorStore {
  x: number | null;
  bp: number | null;
  track: CursorTrack | null;
  setCursor: (
    x: number | null,
    bp: number | null,
    track: CursorTrack | null,
  ) => void;
}

export const useCursor = create<CursorStore>((set) => ({
  x: null,
  bp: null,
  track: null,
  setCursor: (x, bp, track) => set({ x, bp, track }),
}));
