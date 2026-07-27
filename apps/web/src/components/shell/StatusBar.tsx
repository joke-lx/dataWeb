import type { JSX } from 'react';

import { useAppIntl } from '../../i18n';
import { formatBp } from '../../genomics/coords';
import { useViewport } from '../../store/viewport';

export function StatusBar(): JSX.Element {
  const { t } = useAppIntl();
  const chr = useViewport((state) => state.chr);
  const start = useViewport((state) => state.start);
  const end = useViewport((state) => state.end);

  return (
    <footer className="statusbar">
      <div className="statusbar__region">
        {chr}:{formatBp(start)}-{formatBp(end)}
      </div>
      <div className="statusbar__source">{t('status.dataSource')}</div>
    </footer>
  );
}