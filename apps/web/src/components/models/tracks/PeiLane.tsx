/**
 * PeiLane 鈥斺€?Promoter-Enhancer Interaction 閿氱偣杞ㄩ亾銆? *
 * 鑱岃矗锛? *  - 鎷夊彇 `'pei'` bedGraph 鏁版嵁锛堟瘡鏉¤褰曚唬琛ㄤ竴瀵?P-E 閿氱偣锛夛紱
 *  - 濮旀墭 `buildPei` 鎶婃瘡涓氦浜掔敾鎴愯法瓒?lane 鐨勪簩娆″姬绾裤€? *
 * 瑙嗚鐗规€э細姣忔潯 PEI 涓€鏍?妗?鈥斺€斾粠 interval start 璺ㄥ埌 interval end锛? * 寮х嚎楂樺害鐢?lane 楂樺害鍐冲畾锛屼笉甯︽偓鍋滀氦浜掞紙hover 鐢?Plotly 榛樿锛夈€? *
 * 鏋舵瀯浣嶇疆锛歵racks 妯″瀷鐩綍涓嬬殑"鍗曟牱鏈?PEI"lane銆? */

import { keepPreviousData, useQuery } from '@tanstack/react-query';
import type { JSX } from 'react';

import { fetchBed } from '../../../api/client';
import type { PeiRecord } from '../../../api/types';
import { useViewport } from '../../../store/viewport';
import { PlotlyTrack } from '../../render-kit/plotly/PlotlyTrack';
import { buildPei } from '../../render-kit/plotlyBuilders';
import '../../render-kit/lane.css';

const PEI_LANE_HEIGHT = 180;

interface PeiLaneProps {
  sampleId: string;
  trackName: string;
  title: string;
  height?: number;
}

/**
 * PEI锛圥romoter-Enhancer Interaction锛夐敋鐐硅建閬擄細璺?lane 鐨勪簩娆″姬绾裤€? *
 * @param sampleId 褰撳墠鏍锋湰 id
 * @param trackName track 鍚嶏紙鐩墠鍥哄畾 `'pei'`锛? * @param title 鏍囬
 * @param height lane 楂樺害锛堥粯璁?180px锛? */
export function PeiLane({
  sampleId,
  trackName,
  title,
  height = PEI_LANE_HEIGHT,
}: PeiLaneProps): JSX.Element {
  const viewport = useViewport();

  // viewport 杩?queryKey 鈫?骞崇Щ/缂╂斁瑙﹀彂 refetch锛?0s staleTime 鎶戝埗楂橀鎶栧姩銆?  const { data, isLoading, error } = useQuery<PeiRecord[]>({
    queryKey: [
      'pei',
      sampleId,
      trackName,
      viewport.chr,
      viewport.start,
      viewport.end,
    ],
    queryFn: () =>
      fetchBed<'pei'>(sampleId, 'pei', viewport.chr, viewport.start, viewport.end),
    
    staleTime: 30_000,
  });

  const plot = buildPei(data, viewport, title, height);

  return (
    <div className="lane" style={{ height: `${height}px` }}>
      <div className="lane-label">
        <span className="lane-sample">{sampleId}</span>
      </div>
      <div
        className="lane-content"
        data-kind="pei"
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
