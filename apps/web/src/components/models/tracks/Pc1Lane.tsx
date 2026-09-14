/**
 * Pc1Lane 鈥斺€?PC1锛堢涓€涓绘垚鍒嗭級淇″彿杞ㄩ亾銆? *
 * 鑱岃矗锛? *  - 鎷夊彇 Hi-C 娲剧敓 PC1 鏁版嵁锛坄/api/derived/pc1`锛屽惈 `source`锛夛紱
 *  - 濮旀墭 `buildPc1Score` 鐢熸垚 Plotly锛氬钩婊戞洸绾?+ 娣″～鍏?+ 闆剁嚎
 *    锛堜笌鍙傝€冪珯鐐硅缁嗛〉鐨?PC1 杞ㄩ亾褰㈡€佷竴鑷达紝accent 涓婚鑹插尯鍒嗚涔夛級锛? *  - 鍦?lane 瑙掕惤娓叉煋 `ModelSourceBadge`锛屾爣娉ㄧ湡瀹炴暟鎹?/ mock 闄嶇骇銆? *
 * 鏋舵瀯浣嶇疆锛歵racks 妯″瀷鐩綍涓嬬殑"鍗曟牱鏈?PC1"lane锛岀敱
 * `<GenomeBrowserView />` 鍦?Hi-C 涓€浣撳寲瑙嗗浘涓皟鐢ㄣ€? */

import { keepPreviousData, useQuery } from '@tanstack/react-query';
import type { JSX } from 'react';

import {
  fetchDerivedPc1,
  type DerivedRecordsResponse,
  type DerivedScoreRecord,
} from '../../../api/client';
import { usePanelViewport } from '../../../hooks/usePanelViewport';
import { ModelSourceBadge } from '../../feedback/ModelSourceBadge';
import { PlotlyTrack } from '../../render-kit/plotly/PlotlyTrack';
import { buildPc1Score } from '../../render-kit/plotlyBuilders';
import '../../render-kit/lane.css';

const PC1_LANE_HEIGHT = 140;
/** 娲剧敓 PC1 鐨勮緭鍑哄垎绠辨暟锛堜笌 insulation 涓€鑷达紝淇濊瘉鏇茬嚎骞虫粦搴︼級銆?*/
const PC1_N_BINS = 100;

interface Pc1LaneProps {
  sampleId: string;
  trackName?: string;
  title?: string;
  height?: number;
}

/**
 * PC1 淇″彿杞ㄩ亾锛氬钩婊戞洸绾?+ 娣″～鍏咃紙鍙傝€冪珯鐐硅缁嗛〉褰㈡€侊級銆? *
 * @param sampleId 褰撳墠鏍锋湰 id
 * @param trackName track 鍚嶏紙鐩墠鍥哄畾 `'pc1'`锛岀己鐪佸彇 `'pc1'`锛? * @param title 鏍囬锛堢己鐪?`'PC1'`锛? * @param height lane 楂樺害锛堥粯璁?140px锛? */
export function Pc1Lane({
  sampleId,
  trackName = 'pc1',
  title = 'PC1',
  height = PC1_LANE_HEIGHT,
}: Pc1LaneProps): JSX.Element {
  const viewport = usePanelViewport();

  // viewport + bin 杩?queryKey 鈫?骞崇Щ/缂╂斁/鎹?bin 瑙﹀彂 refetch锛?0s staleTime 鎶戝埗楂橀鎶栧姩銆?  const { data, isLoading, error } = useQuery<
    DerivedRecordsResponse<DerivedScoreRecord>
  >({
    queryKey: [
      'derived-pc1',
      sampleId,
      trackName,
      viewport.chr,
      viewport.start,
      viewport.end,
      viewport.bin,
    ],
    queryFn: () =>
      fetchDerivedPc1(
        sampleId,
        viewport.chr,
        viewport.start,
        viewport.end,
        viewport.bin,
        PC1_N_BINS,
      ),
    
    staleTime: 30_000,
  });

  // records 缁撴瀯锛坈hrom/start/end/score锛変笌 BedGraphRecord 瀹屽叏涓€鑷达紝鐩存帴澶嶇敤 builder銆?  const plot = buildPc1Score(data?.records, viewport, title, height);

  return (
    <div className="lane" style={{ height: `${height}px` }}>
      <div className="lane-label">
        <span className="lane-title">{title}</span>
        <span className="lane-sample">{sampleId}</span>
      </div>
      <div
        className="lane-content"
        data-kind="pc1"
        data-track-name={trackName}
      >
        <PlotlyTrack data={plot.data} layout={plot.layout} height={height} />
        <ModelSourceBadge source={data?.source} />
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

