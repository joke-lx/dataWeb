/**
 * InsulationLane 鈥斺€?Insulation Score锛堣竟鐣屽己搴︼級杞ㄩ亾銆? *
 * 鑱岃矗锛? *  - 鎷夊彇 Hi-C 娲剧敓 insulation 鏁版嵁锛坄/api/derived/insulation`锛屽惈 `source`锛夛紱
 *  - 濮旀墭 `buildInsulationScore` 鐢熸垚 Plotly锛氬钩婊戞洸绾?+ 娣″～鍏咃紙涓?demo 瀵归綈锛夛紱
 *  - 鍦?lane 瑙掕惤娓叉煋 `ModelSourceBadge`锛屾爣娉ㄧ湡瀹炴暟鎹?/ mock 闄嶇骇銆? *
 * 鏋舵瀯浣嶇疆锛歵racks 妯″瀷鐩綍涓嬬殑"鍗曟牱鏈?IS"lane锛岀敱 `<TracksModel />` 鍦? * `kind === 'is'` 鍒嗘敮璋冪敤銆? */

import { keepPreviousData, useQuery } from '@tanstack/react-query';
import type { JSX } from 'react';

import {
  fetchDerivedInsulation,
  type DerivedRecordsResponse,
  type DerivedScoreRecord,
} from '../../../api/client';
import { useViewport } from '../../../store/viewport';
import { ModelSourceBadge } from '../../feedback/ModelSourceBadge';
import { PlotlyTrack } from '../../render-kit/plotly/PlotlyTrack';
import { buildInsulationScore } from '../../render-kit/plotlyBuilders';
import '../../render-kit/lane.css';

const INSULATION_LANE_HEIGHT = 150;
/** 娲剧敓 insulation 鐨勮緭鍑哄垎绠辨暟锛堝悗绔粯璁?100锛屼笌 demo 瀵嗗害涓€鑷达級銆?*/
const INSULATION_N_BINS = 100;

interface InsulationLaneProps {
  sampleId: string;
  trackName: string;
  title: string;
  height?: number;
}

/**
 * Insulation Score 杞ㄩ亾锛氬钩婊戞洸绾?+ 娣″～鍏咃紙涓?demo.html 瑙嗚涓€鑷达級銆? *
 * @param sampleId 褰撳墠鏍锋湰 id
 * @param trackName track 鍚嶏紙鐩墠鍥哄畾 `'is'`锛? * @param title 鏍囬
 * @param height lane 楂樺害锛堥粯璁?150px锛? */
export function InsulationLane({
  sampleId,
  trackName,
  title,
  height = INSULATION_LANE_HEIGHT,
}: InsulationLaneProps): JSX.Element {
  const viewport = useViewport();

  // viewport + bin 杩?queryKey 鈫?骞崇Щ/缂╂斁/鎹?bin 瑙﹀彂 refetch锛?0s staleTime 鎶戝埗楂橀鎶栧姩銆?  const { data, isLoading, error } = useQuery<
    DerivedRecordsResponse<DerivedScoreRecord>
  >({
    queryKey: [
      'derived-insulation',
      sampleId,
      trackName,
      viewport.chr,
      viewport.start,
      viewport.end,
      viewport.bin,
    ],
    queryFn: () =>
      fetchDerivedInsulation(
        sampleId,
        viewport.chr,
        viewport.start,
        viewport.end,
        viewport.bin,
        INSULATION_N_BINS,
      ),
    
    staleTime: 30_000,
  });

  // records 缁撴瀯锛坈hrom/start/end/score锛変笌 BedGraphRecord 瀹屽叏涓€鑷达紝鐩存帴澶嶇敤 builder銆?  const plot = buildInsulationScore(data?.records, viewport, title, height);

  return (
    <div className="lane" style={{ height: `${height}px` }}>
      <div className="lane-label">
        <span className="lane-sample">{sampleId}</span>
      </div>
      <div
        className="lane-content"
        data-kind="is"
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
