import { useSamples } from '../store/samples';

export function useActiveSample(): string | null {
  return useSamples((state) => state.active);
}
