/**
 * BedGraphLane 鈥斺€?AB compartment 鎸囨暟杞ㄩ亾銆? *
 * 鑱岃矗锛? *  - 鎷夊彇鎸囧畾 sample + trackName 鐨?bedGraph 鍖洪棿鏁版嵁锛? *  - 濮旀墭 `plotlyBuilders.buildBedGraph` 鐢熸垚 Plotly 鏁版嵁锛? *  - 娓叉煋鎴愮粺涓€鐨?`.lane` 琛岋細宸︿晶 sample 鏍囩 + 鍙充晶 Plotly 鍥俱€? *
 * 瑙嗚鐗规€э細A compartment 鍦ㄩ浂绾夸箣涓婏紙绾㈣壊锛夛紝B 鍦ㄤ笅锛堣摑鑹诧級鈥斺€旇 `buildBedGraph`銆? *
 * 鏋舵瀯浣嶇疆锛歵racks 妯″瀷鐩綍涓嬬殑"鍗曟牱鏈?bedGraph"杞ㄩ亾 lane锛? * 閫氳繃 `<TracksModel />` 鎸?kind 鍒嗘淳鏃惰皟鐢ㄣ€? */

import { keepPreviousData, useQuery } from '@tanstack/react-query';
import type { JSX } from 'react';

import { fetchBed } from '../../../api/client';
import type { BedGraphRecord } from '../../../api/types';
import { useViewport } from '../../../store/viewport';
import { PlotlyTrack } from '../../render-kit/plotly/PlotlyTrack';
import { buildBedGraph } from '../../render-kit/plotlyBuilders';
import '../../render-kit/lane.css';

const BEDGRAPH_LANE_HEIGHT = 150;

interface BedGraphLaneProps {
  sampleId: string;
  trackName: string;
  title: string;
  height?: number;
}

/**
 * AB compartment 鎸囨暟杞ㄩ亾锛氬甫绗﹀彿鏇茬嚎锛孉 鍦ㄩ浂绾夸箣涓娿€丅 鍦ㄤ笅銆? *
 * @param sampleId 褰撳墠鏍锋湰 id
 * @param trackName bedGraph track 鍚嶏紙鐩墠鍥哄畾 `'ab'`锛屼絾绛惧悕鐣欐墿灞曠┖闂达級
 * @param title 鏍囬
 * @param height lane 楂樺害锛堥粯璁?150px锛? */
export function BedGraphLane({
  sampleId,
  trackName,
  title,
  height = BEDGRAPH_LANE_HEIGHT,
}: BedGraphLaneProps): JSX.Element {
  const viewport = useViewport();

  // viewport 杩涘叆 queryKey 鈫?骞崇Щ/缂╂斁浼氳嚜鍔ㄨЕ鍙?refetch锛?  // 30s staleTime 闃叉楂橀婊氳疆 zoom 鏃跺弽澶嶆墦鍚庣銆?  const { data, isLoading, error } = useQuery<BedGraphRecord[]>({
    queryKey: [
      'bedGraph',
      sampleId,
      trackName,
      viewport.chr,
      viewport.start,
      viewport.end,
    ],
    queryFn: () =>
      fetchBed<'ab'>(sampleId, 'ab', viewport.chr, viewport.start, viewport.end),
    
    staleTime: 30_000,
  });

  const plot = buildBedGraph(data, viewport, title, height);

  return (
    <div className="lane" style={{ height: `${height}px` }}>
      <div className="lane-label">
        <span className="lane-sample">{sampleId}</span>
      </div>
      <div
        className="lane-content"
        data-kind="bedGraph"
        data-track-name={trackName}
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
