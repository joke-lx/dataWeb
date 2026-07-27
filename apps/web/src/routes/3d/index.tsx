import type { JSX } from 'react';
import { RouteShell } from '../../components/route/RouteShell';
import { ModelFactory } from '../../components/models';
import { useAppIntl } from '../../i18n';
import { useActiveSample } from '../../hooks/useActiveSample';

export function ThreeDChromatinRoute(): JSX.Element {
  const { t } = useAppIntl();
  const activeSample = useActiveSample() ?? 'Brain_BF3';
  return (
    <RouteShell title={t('3d.viewer.title')} subtitle={t('3d.viewer.desc', { id: activeSample })}>
      <ModelFactory type="3d" />
    </RouteShell>
  );
}
