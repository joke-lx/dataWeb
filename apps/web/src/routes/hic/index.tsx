import type { JSX } from 'react';
import { RouteShell } from '../../components/route/RouteShell';
import { ModelFactory } from '../../components/models';
import { useAppIntl } from '../../i18n';
import { useViewport } from '../../store/viewport';
import { useActiveSample } from '../../hooks/useActiveSample';

export function HicRoute(): JSX.Element {
  const { t } = useAppIntl();
  const viewport = useViewport();
  const sampleId = useActiveSample() ?? 'Brain_BF3';
  const region = `${viewport.chr}:${viewport.start.toLocaleString()}-${viewport.end.toLocaleString()}`;
  return (
    <RouteShell title={t('hic.viewer.title')} subtitle={t('hic.viewer.desc', { sampleId, region })}>
      <ModelFactory type="hic" />
    </RouteShell>
  );
}
