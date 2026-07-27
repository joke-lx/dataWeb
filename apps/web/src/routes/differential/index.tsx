import type { JSX } from 'react';
import { RouteShell } from '../../components/route/RouteShell';
import { ModelFactory } from '../../components/models';
import { useAppIntl } from '../../i18n';
import { useViewport } from '../../store/viewport';
import { useActiveSample } from '../../hooks/useActiveSample';
import { useSamples } from '../../store/samples';

export function DifferentialHicRoute(): JSX.Element {
  const { t } = useAppIntl();
  const viewport = useViewport();
  const activeId = useActiveSample();
  const samples = useSamples((s) => s.samples);
  const sampleA = activeId ?? 'Brain_BF3';
  const sampleB = samples.find((s) => s.id !== sampleA)?.id ?? 'Liver_BF3';
  const region = `${viewport.chr}:${viewport.start.toLocaleString()}-${viewport.end.toLocaleString()}`;
  return (
    <RouteShell title={t('differential.viewer.title')} subtitle={t('differential.viewer.desc', { a: sampleA, b: sampleB, region })}>
      <ModelFactory type="differential" />
    </RouteShell>
  );
}
