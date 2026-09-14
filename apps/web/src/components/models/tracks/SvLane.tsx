/**
 * SvLane 鈥斺€?Structural Variants锛堢粨鏋勫彉寮傦級杞ㄩ亾銆? *
 * 鑱岃矗锛? *  - 鎷夊彇 SV 鏁版嵁锛圖EL / DUP / INV / TRA 鍥涚 kind锛夛紱
 *  - 濮旀墭 `buildSv` 鐢熸垚 Plotly锛氭寜 kind 涓婅壊鐨?marker锛屾枃瀛楁爣绛惧悓鑹层€? *
 * 浠呭湪 aux 璺緞涓婁娇鐢紙涓昏建閬撴病鏈?SV 鍏ュ彛锛夛紝鐢?`<TracksModel />` 鍦? * `kind === 'sv'` 鍒嗘敮璋冪敤銆? *
 * 鏋舵瀯浣嶇疆锛歵racks 妯″瀷鐩綍涓嬬殑"鍗曟牱鏈?SV"lane銆? */

import { keepPreviousData, useQuery } from '@tanstack/react-query';
import type { JSX } from 'react';

import { fetchSV, type SVRecord } from '../../../api/client';
import { useViewport } from '../../../store/viewport';
import { PlotlyTrack } from '../../render-kit/plotly/PlotlyTrack';
import { buildSv } from '../../render-kit/plotlyBuilders';
import '../../render-kit/lane.css';

const SV_LANE_HEIGHT = 120;

interface SvLaneProps {
  sampleId: string;
  title: string;
  height?: number;
}

/**
 * 缁撴瀯鍙樺紓杞ㄩ亾锛氭寜 kind 涓婅壊鐨?marker锛孌EL/DUP/INV/TRA 鏂囧瓧鏍囩鍚岃壊銆? *
 * @param sampleId 褰撳墠鏍锋湰 id
 * @param title 鏍囬
 * @param height lane 楂樺害锛堥粯璁?120px锛? */
export function SvLane({
  sampleId,
  title,
  height = SV_LANE_HEIGHT,
}: SvLaneProps): JSX.Element {
  const viewport = useViewport();

  // viewport 杩?queryKey 鈫?骞崇Щ/缂╂斁瑙﹀彂 refetch锛?0s staleTime 鎶戝埗楂橀鎶栧姩銆?  const { data, isLoading, error } = useQuery<SVRecord[]>({
    queryKey: [
      'sv',
      sampleId,
      viewport.chr,
      viewport.start,
      viewport.end,
    ],
    queryFn: () =>
      fetchSV(sampleId, viewport.chr, viewport.start, viewport.end),
    
    staleTime: 30_000,
  });

  const plot = buildSv(data, viewport, title, height);

  return (
    <div className="lane" style={{ height: `${height}px` }}>
      <div className="lane-label">
        <span className="lane-sample">{sampleId}</span>
      </div>
      <div
        className="lane-content"
        data-kind="sv"
        data-track-name="sv"
      >
        <PlotlyTrack data={plot.data} layout={plot.layout} height={height} />
        {isLoading && <span className="track-loading">Loading鈥?/span>}
        {error && (
          <span className="track-error" title={error.message}>
            !
          </span>
        )}
      </div>
    </div>
  );
}
