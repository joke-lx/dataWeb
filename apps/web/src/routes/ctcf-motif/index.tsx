import type { JSX } from 'react';
import { RouteShell } from '../../components/route/RouteShell';
import { ModelFactory } from '../../components/models';
import { useAppIntl } from '../../i18n';
import { useViewport } from '../../store/viewport';

export function CtcfMotifRoute(): JSX.Element {
  const { t } = useAppIntl();
  const viewport = useViewport();
  const region = `${viewport.chr}:${viewport.start.toLocaleString()}-${viewport.end.toLocaleString()}`;
  return (
    <RouteShell title={t('ctcf.viewer.title')} subtitle={region}>
      <ModelFactory type="ctcf-motif" />
    </RouteShell>
  );
}
