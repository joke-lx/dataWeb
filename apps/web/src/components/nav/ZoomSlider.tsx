import type { ChangeEvent, JSX } from 'react';

import { BIN_STEPS, useViewport } from '../../store/viewport';
import './nav.css';

export function ZoomSlider(): JSX.Element {
  const bin = useViewport((state) => state.bin);

  const onChange = (event: ChangeEvent<HTMLSelectElement>): void => {
    useViewport.getState().setBin(Number.parseInt(event.target.value, 10));
  };

  return (
    <select
      aria-label="Hi-C bin size"
      className="zoom-slider"
      value={bin}
      onChange={onChange}
    >
      {BIN_STEPS.map((step) => (
        <option key={step} value={step}>
          {(step / 1000).toLocaleString()} kb
        </option>
      ))}
    </select>
  );
}
