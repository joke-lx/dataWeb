/**
 * GeneLane 鈥斺€?Gene model 娉ㄩ噴杞ㄩ亾銆? *
 * 鑱岃矗锛? *  - 鎷夊彇 `'gene'` bedGraph 鏁版嵁锛堝鏄惧瓙 + 鍐呭惈瀛愯褰曪級锛? *  - 濮旀墭 `buildGene` 鐢熸垚 Plotly锛氬唴鍚瓙 backbone + 澶栨樉瀛愮煩褰紙澶氳鍫嗗彔锛夈€? *
 * 涓?hic 妯″瀷閲岀殑 `<GeneLane />` 瑙嗚涓€鑷粹€斺€旀湰缁勪欢鏄?tracks 妯″瀷鐩綍涓嬬殑鐙珛鍓湰锛? * 閬垮厤璺ㄦā鍨嬪叡浜紙璇﹁ ref1 鍏充簬"鎷掔粷 `models/shared/`"鐨勫喅绛栵級銆? *
 * 鏋舵瀯浣嶇疆锛歵racks 妯″瀷鐩綍涓嬬殑"gene 娉ㄩ噴"lane锛堜富/aux 閮藉彲鑳界敤鍒帮級銆? */

import { keepPreviousData, useQuery } from '@tanstack/react-query';
import type { JSX } from 'react';

import { fetchBed } from '../../../api/client';
import type { GeneRecord } from '../../../api/types';
import { usePanelViewport } from '../../../hooks/usePanelViewport';
import { PlotlyTrack } from '../../render-kit/plotly/PlotlyTrack';
import { buildGene } from '../../render-kit/plotlyBuilders';
import '../../render-kit/lane.css';

const GENE_LANE_HEIGHT = 120;

interface GeneLaneProps {
  /** 瑕嗙洊褰撳墠鏍锋湰銆?*/
  sampleId?: string;
  /** 瑕嗙洊 lane 鍍忕礌楂樺害銆?*/
  height?: number;
  /** lane 鏍囬锛堝彲閫夛紝缂虹渷涓嶆樉绀烘爣棰樿锛夈€?*/
  title?: string;
}

/**
 * Gene model 娉ㄩ噴杞ㄩ亾锛氬唴鍚瓙 backbone + 澶栨樉瀛愮煩褰紙澶氳鍫嗗彔锛夈€? *
 * @param sampleId 瑕嗙洊榛樿 sample锛堢己鐪佽蛋 `'Brain_BF3'` 鍏滃簳锛? * @param height lane 楂樺害锛堥粯璁?120px锛? */
export function GeneLane({
  sampleId,
  height = GENE_LANE_HEIGHT,
  title,
}: GeneLaneProps): JSX.Element {
  const viewport = usePanelViewport();
  // gene 娉ㄩ噴鍦ㄦ暟鎹ā鍨嬮噷浠嶆寕鍦ㄦ煇涓?sample 涓嬶紱缂虹渷鏃跺洖閫€鍒?Brain_BF3鈥斺€斿拰 hic 妯″瀷涓€鑷淬€?  const resolvedSample = sampleId ?? 'Brain_BF3';

  // viewport 杩?queryKey 鈫?骞崇Щ/缂╂斁瑙﹀彂 refetch锛?0s staleTime 鎶戝埗楂橀鎶栧姩銆?  const { data, isLoading, error } = useQuery<GeneRecord[]>({
    queryKey: [
      'gene',
      resolvedSample,
      viewport.chr,
      viewport.start,
      viewport.end,
    ],
    queryFn: () =>
      fetchBed<'gene'>(resolvedSample, 'gene', viewport.chr, viewport.start, viewport.end),
    
    staleTime: 30_000,
  });

  const plot = buildGene(data, viewport, 'Gene model', height);

  return (
    <div className="lane" style={{ height: `${height}px` }}>
      <div className="lane-label">
        {title && <span className="lane-title">{title}</span>}
        <span className="lane-sample">{resolvedSample}</span>
      </div>
      <div
        className="lane-content"
        data-kind="gene"
        data-track-name="gene"
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
