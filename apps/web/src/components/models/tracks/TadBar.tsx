/**
 * TadBar 鈥斺€?TAD锛圱opologically Associating Domain锛夎竟鐣屾潯杞ㄩ亾銆? *
 * 鑱岃矗锛? *  - 鎷夊彇 `'tad'` bedGraph 鏁版嵁锛? *  - 濮旀墭 `buildTadBar` 鎶婃瘡涓?TAD 鍖洪棿鐢绘垚"婊￠珮搴︾煩褰㈡潯"锛岃法鏁存潯 lane銆? *
 * 瑙嗚鐗规€э細姣忎釜 TAD 涓€鏍规弧楂樼煩褰紙娌垮熀鍥犵粍杞达級锛屾病鏈?lane 涓婁笅鐨勭┖鐧解€斺€? * 杩欎笌 hic 妯″瀷閲?`<TadBar />` 鐨勮瑙変竴鑷淬€? *
 * 鏋舵瀯浣嶇疆锛歵racks 妯″瀷鐩綍涓嬬殑"鍗曟牱鏈?TAD"lane銆? */

import { keepPreviousData, useQuery } from '@tanstack/react-query';
import type { JSX } from 'react';

import { fetchBed } from '../../../api/client';
import type { TadRecord } from '../../../api/types';
import { usePanelViewport } from '../../../hooks/usePanelViewport';
import { PlotlyTrack } from '../../render-kit/plotly/PlotlyTrack';
import { buildTadBar } from '../../render-kit/plotlyBuilders';
import '../../render-kit/lane.css';

const TAD_LANE_HEIGHT = 120;

interface TadBarProps {
  /** 瑕嗙洊褰撳墠鏍锋湰銆?*/
  sampleId?: string;
  /** 瑕嗙洊 lane 鍍忕礌楂樺害銆?*/
  height?: number;
  /** lane 鏍囬锛堝彲閫夛紝缂虹渷涓嶆樉绀烘爣棰樿锛夈€?*/
  title?: string;
}

/**
 * TAD 杈圭晫鏉¤建閬擄細姣忎釜 domain 鍖洪棿涓€鏍规弧楂樼煩褰㈡潯銆? *
 * @param sampleId 瑕嗙洊榛樿 sample锛堢己鐪佽蛋 `'Brain_BF3'` 鍏滃簳锛? * @param height lane 楂樺害锛堥粯璁?120px锛? */
export function TadBar({
  sampleId,
  height = TAD_LANE_HEIGHT,
  title,
}: TadBarProps): JSX.Element {
  const viewport = usePanelViewport();
  // gene / tad 绛?闈炴牱鏈壒寮?杞ㄩ亾鍦ㄧ己鐪?sample 鏃跺洖閫€鍒?Brain_BF3鈥斺€旇 hic 妯″瀷鍚屾绾﹀畾銆?  const resolvedSample = sampleId ?? 'Brain_BF3';

  // viewport 杩?queryKey 鈫?骞崇Щ/缂╂斁瑙﹀彂 refetch锛?0s staleTime 鎶戝埗楂橀鎶栧姩銆?  const { data, isLoading, error } = useQuery<TadRecord[]>({
    queryKey: [
      'tadBar',
      resolvedSample,
      viewport.chr,
      viewport.start,
      viewport.end,
    ],
    queryFn: () =>
      fetchBed<'tad'>(resolvedSample, 'tad', viewport.chr, viewport.start, viewport.end),
    
    staleTime: 30_000,
  });

  const plot = buildTadBar(data, viewport, 'TAD boundary', height);

  return (
    <div className="lane" style={{ height: `${height}px` }}>
      <div className="lane-label">
        {title && <span className="lane-title">{title}</span>}
        <span className="lane-sample">{resolvedSample}</span>
      </div>
      <div
        className="lane-content"
        data-kind="tadBar"
        data-track-name="tad"
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
