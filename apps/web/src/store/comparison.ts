import { create } from 'zustand';

export type ComparisonLayout = 'single' | 'stacked' | 'mirrored';

interface ComparisonStore {
  enabled: boolean;
  layout: ComparisonLayout;
  primarySample: string | null;
  secondarySample: string | null;
  setEnabled: (v: boolean) => void;
  toggle: () => void;
  setLayout: (l: ComparisonLayout) => void;
  setPrimary: (id: string) => void;
  setSecondary: (id: string | null) => void;
}

export const useComparison = create<ComparisonStore>((set) => ({
  enabled: false,
  layout: 'stacked',
  primarySample: null,
  secondarySample: null,
  setEnabled: (enabled) => set({ enabled }),
  toggle: () => set((s) => ({ enabled: !s.enabled })),
  setLayout: (layout) => set({ layout }),
  setPrimary: (primarySample) => set({ primarySample }),
  setSecondary: (secondarySample) => set({ secondarySample }),
}));
