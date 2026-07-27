import type { JSX } from 'react';
import { RouteShell } from '../../components/route/RouteShell';
import { ModelFactory } from '../../components/models';
import { useAppIntl } from '../../i18n';
import { useActiveSample } from '../../hooks/useActiveSample';
import { useViewport } from '../../store/viewport';
import { SUB_TABS } from '../trackSpec';
import type { TrackId } from '../trackSpec';
import { useSearchParams } from 'react-router-dom';
import { SubTabBar } from '../../components/models/tracks/SubTabBar';

export function TracksRoute(): JSX.Element {
  const { t } = useAppIntl();
  const [params, setParams] = useSearchParams();
  const type = (params.get('type') ?? 'ab') as TrackId;
  const sampleId = useActiveSample() ?? 'Brain_BF3';
  const viewport = useViewport();

  const tab = SUB_TABS.find((t) => t.id === type) ?? SUB_TABS[3];

  const handleTabChange = (id: string): void => {
    setParams((prev) => { prev.set('type', id); return prev; }, { replace: false });
  };

  const region = `${viewport.chr}:${viewport.start.toLocaleString()}-${viewport.end.toLocaleString()}`;
  return (
    <RouteShell title={t('tracks.subtab.' + tab.id, tab.label)} subtitle={`${tab.id} · ${region} · sample ${sampleId}`}>
      <SubTabBar tabs={SUB_TABS} value={tab.id} onChange={handleTabChange} />
      <ModelFactory type="tracks" />
    </RouteShell>
  );
}
