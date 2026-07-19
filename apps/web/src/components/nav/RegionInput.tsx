import { useEffect, useState } from 'react';
import type { JSX } from 'react';

import { useViewport } from '../../store/viewport';
import './nav.css';

export function RegionInput(): JSX.Element {
  const chr = useViewport((state) => state.chr);
  const start = useViewport((state) => state.start);
  const end = useViewport((state) => state.end);
  const [text, setText] = useState(`${chr}:${start}-${end}`);

  useEffect(() => {
    setText(`${chr}:${Math.round(start)}-${Math.round(end)}`);
  }, [chr, start, end]);

  const onSubmit = (): void => {
    const match = text.match(/^(\S+):(\d+(?:,\d+)*)-(\d+(?:,\d+)*)$/);
    if (!match) return;

    const nextStart = Number.parseInt(match[2].replace(/,/g, ''), 10);
    const nextEnd = Number.parseInt(match[3].replace(/,/g, ''), 10);
    if (nextEnd <= nextStart) return;

    useViewport.setState({
      chr: match[1],
      start: nextStart,
      end: nextEnd,
    });
  };

  return (
    <div className="region-input">
      <input
        aria-label="Genomic region"
        type="text"
        value={text}
        onChange={(event) => setText(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter') onSubmit();
        }}
        placeholder="chr1:1,000,000-2,000,000"
      />
      <button type="button" onClick={onSubmit}>
        Go
      </button>
    </div>
  );
}
