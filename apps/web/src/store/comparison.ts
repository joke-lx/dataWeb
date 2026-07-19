import { create } from 'zustand';

interface ComparisonStore {
  enabled: boolean;
  toggle: () => void;
}

export const useComparison = create<ComparisonStore>((set) => ({
  enabled: false,
  toggle: () => set((s) => ({ enabled: !s.enabled })),
}));