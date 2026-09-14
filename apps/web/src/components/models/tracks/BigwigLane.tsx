/**
 * BigwigLane 鈥斺€?鍗曟牱鏈?bigwig 淇″彿杞ㄩ亾銆? *
 * 鑱岃矗锛? *  - 鏍规嵁褰撳墠 viewport 瀹藉害鑷€傚簲璁＄畻鍒嗙鏁帮紙bins锛夛紝淇濊瘉 lane 鍦ㄧ缉鏀炬椂瀵嗗害鍚堥€傦紱
 *  - 鎷夊彇鎸囧畾 sample + trackName 鐨?bigwig 鏁版嵁锛? *  - 濮旀墭 `buildBigwig` 鐢熸垚 Plotly trace锛堜笌 multi-sample 鐨?`BigwigStacked` 鍖哄垎锛夈€? *
 * 涓?`BigwigStacked` 鐨勫叧绯伙細浠呬竴涓牱鏈椂浣跨敤鏈粍浠讹紙鍙犲姞鐗堝 N=1 閫€鍖栨垚鍗曡酱锛夛紝
 * 鐢?`<TracksModel />` 鍦?`aux` 娓叉煋鍒嗘敮閲岄€夋湰缁勪欢銆? *
 * 鏋舵瀯浣嶇疆锛歛ux 璺緞涓婂敮涓€鐨?bigwig lane锛涗富杞ㄩ亾璧?`BigwigStacked`銆? *
 * Activity proxy (Hi-C 娲剧敓)锛氬綋 trackName 灞炰簬 `ACTIVITY_PROXY_TRACKS`锛圧NA-seq /
 * H3K4me3 / H3K27ac锛夛紝鎴戜滑娌℃湁鐪熷疄娴嬪簭鏁版嵁锛屼絾 Hi-C 鐨?A/B compartment 涓庤〃杈?/
 * 缁勮泲鐧戒慨楗?/ 寮€鏀炬€ф湁寮虹浉鍏?鈥斺€?鐢?`fetchDerivedActivity` 缁欎竴涓?[0, 1] 鍖洪棿
 * 淇″彿锛孶I 鍔?`ModelSourceBadge source="ab_proxy"` 鏍囨敞銆? */

import { keepPreviousData, useQuery } from '@tanstack/react-query';
import type { JSX } from 'react';

import { fetchBigwig, fetchDerivedActivity } from '../../../api/client';
import { useViewport } from '../../../store/viewport';
import { ModelSourceBadge } from '../../feedback/ModelSourceBadge';
import { PlotlyTrack } from '../../render-kit/plotly/PlotlyTrack';
import { buildBigwig } from '../../render-kit/plotlyBuilders';
import '../../render-kit/lane.css';

const BIGWIG_LANE_HEIGHT = 180;

/** Activity proxy 閫傜敤鐨?track name 鈥斺€?Hi-C A/B 娲剧敓鐨勮〃杈?ChIP/ATAC 浠ｇ悊銆?*/
const ACTIVITY_PROXY_TRACKS = new Set(['rna_seq', 'h3k4me3', 'h3k27ac']);
const isActivityProxy = (t: string) => ACTIVITY_PROXY_TRACKS.has(t);

interface BigwigLaneProps {
  /** 褰撳墠鏍锋湰 id銆?*/
  sampleId: string;
  /** Track 鍚嶏紙濡?"rna_seq"锛夈€?*/
  trackName: string;
  /** 瑕嗙洊 lane 鍍忕礌楂樺害銆?*/
  height?: number;
}

/**
 * 鍗曟牱鏈?bigwig 杞ㄩ亾锛歊NA-seq / 缁勮泲鐧戒慨楗帮紙ChIP-seq锛夌瓑杩炵画淇″彿銆? *
 * @param sampleId 褰撳墠鏍锋湰 id
 * @param trackName 杞ㄩ亾鍚嶏紙濡?`'rna_seq'`銆乣'h3k4me3'` 绛夛級
 * @param height lane 楂樺害锛堥粯璁?180px锛? */
export function BigwigLane({
  sampleId,
  trackName,
  height = BIGWIG_LANE_HEIGHT,
}: BigwigLaneProps): JSX.Element {
  const viewport = useViewport();
  // bin 鏁伴殢 viewport 瀹藉害绾挎€у鍑忥細姣?1kb 瑙嗗彛瀹藉害 鈫?1 bin锛?  // 涓嬮檺 50 闃叉鏋佺獎瑙嗗彛涓㈠け缁嗚妭锛屼笂闄?800 閬垮厤璇锋眰浣撹繃澶с€?  const viewportWidth = viewport.end - viewport.start;
  const bins = Math.max(50, Math.min(800, Math.ceil(viewportWidth / 1000)));

  const useActivity = isActivityProxy(trackName);

  // bins 杩?queryKey鈥斺€攝oom/pan 瑙﹀彂 bins 鍙樺寲 鈫?閲嶆柊鎷夋暟鎹€?  // activity 璺緞杩斿洖 {values: number[], source}锛沚igwig 璺緞杩斿洖 {values: Float32Array, vmin, vmax}銆?  // 鏄惧紡鏍?union 璁?useQuery 涓嶆寫閿欍€?  type BigwigData =
    | { values: Float32Array; vmin: number; vmax: number; source?: undefined }
    | { values: number[]; source: string };
  const { data, isLoading, error } = useQuery<BigwigData>({
    queryKey: useActivity
      ? ['derived-activity', sampleId, trackName, viewport.chr, viewport.start, viewport.end, bins]
      : ['bigwig', sampleId, trackName, viewport.chr, viewport.start, viewport.end, bins],
    queryFn: () =>
      useActivity
        ? fetchDerivedActivity(
            sampleId,
            viewport.chr,
            viewport.start,
            viewport.end,
            viewport.bin,
            bins,
          ).then<BigwigData>((d) => ({
            values: d.records.map((r) => r.score),
            source: d.source,
          }))
        : fetchBigwig(
            sampleId,
            trackName,
            viewport.chr,
            viewport.start,
            viewport.end,
            bins,
          ),
    enabled: !!trackName,
    
    staleTime: 30_000,
  });

  // buildBigwig 鎺ュ彈 Float32Array锛沘ctivity 杩斿洖 number[]锛屼紶涔嬪墠杞?Float32Array銆?  const plotValues = data
    ? data.values instanceof Float32Array
      ? data.values
      : new Float32Array(data.values)
    : undefined;
  const plot = buildBigwig(plotValues, viewport, trackName, height);
  const source = data && 'source' in data ? data.source : undefined;

  return (
    <div className="lane" style={{ height: `${height}px` }}>
      <div className="lane-label">
        <span className="lane-sample">{sampleId}</span>
      </div>
      <div
        className="lane-content"
        data-kind={useActivity ? 'activity' : 'bigwig'}
        data-track-name={trackName}
      >
        <PlotlyTrack data={plot.data} layout={plot.layout} height={height} />
        {useActivity && <ModelSourceBadge source={source ?? 'ab_proxy'} />}
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
