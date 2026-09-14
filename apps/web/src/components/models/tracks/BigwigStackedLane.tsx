/**
 * BigwigStackedLane 鈥斺€?澶氭牱鏈?bigwig 杞ㄩ亾 lane銆? *
 * 鑱岃矗锛? *  - 鐢?`useQueries` 骞惰鎷夊彇 N 涓牱鏈殑 bigwig 鏁版嵁锛? *  - N=1 鏃堕€€鍖栦负鍗曟牱鏈?`buildBigwig`锛堥伩鍏嶆棤鎰忎箟鐨勫垏鐗囧嚑浣曪級锛? *  - N鈮? 鏃剁敤 `buildBigwigStacked` 鐢熸垚 demo 椋庢牸鐨勫鍒囩墖甯冨眬锛? *  - lane 鎬婚珮鎸夋牱鏈暟绾挎€у闀匡紙`70 * N + 30`锛夛紝淇濊瘉姣忎釜鍒囩墖鑷冲皯鏈?70px銆? *
 * 棰滆壊鏉ユ簮锛氶€氳繃 `sampleMeta` 瑙ｆ瀽 tissue 鈫?`colorForTissue`锛涚己澶?meta 鏃? * 鐢ㄦ湰鍦?fallback 涓€х伆锛堜粎鍗曟牱鏈椂鍙兘鏈?meta 缂哄け锛屽洜涓?SamplePickerButton
 * 涓€瀹氫細涓哄凡閫夋牱鏈彁渚?meta锛夈€? *
 * 鏋舵瀯浣嶇疆锛歵racks 妯″瀷鐩綍涓嬬殑"澶氭牱鏈?bigwig"lane锛岃 `<TracksModel />`
 * 鍦ㄤ富杞ㄩ亾 `kind === 'bigwig'` 鍒嗘敮璋冪敤銆? *
 * Activity proxy锛氬綋 trackName 灞炰簬 RNA/ChIP/ATAC 闆嗗悎锛屾病鏈夌湡瀹炴暟鎹紝
 * 鏀圭敤 `fetchDerivedActivity`锛圚i-C A/B 娲剧敓鐨?[0,1] 淇″彿锛夆€斺€?lane 鍔? * `ModelSourceBadge source="ab_proxy"`銆? */

import { keepPreviousData, useQueries } from '@tanstack/react-query';
import type { JSX } from 'react';

import { fetchBigwig, fetchDerivedActivity } from '../../../api/client';
import type { Sample } from '../../../api/types';
import { useViewport } from '../../../store/viewport';
import { ModelSourceBadge } from '../../feedback/ModelSourceBadge';
import { PlotlyTrack } from '../../render-kit/plotly/PlotlyTrack';
import {
  buildBigwig,
} from '../../render-kit/plotlyBuilders';
import { buildBigwigStacked, type BigwigSeries } from './BigwigStacked';
import { colorForTissue, type SampleColor } from './sampleColors';
import '../../render-kit/lane.css';

/** 涓?BigwigLane 鍏变韩鐨?activity 浠ｇ悊鐧藉悕鍗曘€?*/
const ACTIVITY_PROXY_TRACKS = new Set(['rna_seq', 'h3k4me3', 'h3k27ac']);
const isActivityProxy = (t: string) => ACTIVITY_PROXY_TRACKS.has(t);

interface BigwigStackedProps {
  sampleIds: string[];
  sampleMeta?: Sample[];
  trackName: string;
  title: string;
  groupLabel?: string;
  highlightBands?: Array<{ start: number; end: number }>;
  height?: number;
}

/**
 * 澶氭牱鏈?bigwig lane锛氭瘡涓牱鏈竴涓按骞冲垏鐗囷紙鐙珛 y 杞达級锛屽叡浜?x 杞淬€? * N=1 鏃堕€€鍥?`buildBigwig` 鍗曟牱鏈竷灞€銆? *
 * @param sampleIds 鏍锋湰 id 鍒楄〃锛圲RL 鍗曚竴鏉ユ簮锛? * @param sampleMeta 鏍锋湰鍏冩暟鎹紙鐢ㄤ簬 tissue鈫抍olor 瑙ｆ瀽锛涘彲閫夛級
 * @param trackName bigwig track 鍚嶏紙濡?`'rna_seq'`锛? * @param title lane 鏍囬
 * @param groupLabel 宸︿晶鏃嬭浆缁勫悕锛堢己鐪?= title锛? * @param highlightBands 鍙€夐珮浜尯闂? * @param height 鏈熸湜鏈€灏忛珮搴︼紙瀹為檯楂樺害浼氭寜鏍锋湰鏁板闀匡級
 */
export function BigwigStacked({
  sampleIds,
  sampleMeta,
  trackName,
  title,
  groupLabel,
  highlightBands,
  height,
}: BigwigStackedProps): JSX.Element {
  const viewport = useViewport();
  // bin 鏁伴殢 viewport 瀹藉害绾挎€у彉鍖栵細50~800 涔嬮棿銆備笅闄?50 闃茶繃鐤忥紝涓婇檺 800 闃茶姹傜垎鐐搞€?  const viewportWidth = viewport.end - viewport.start;
  const bins = Math.max(50, Math.min(800, Math.ceil(viewportWidth / 1000)));

  const useActivity = isActivityProxy(trackName);

  // 鐢?useQueries 骞惰鎷夊彇鈥斺€斿涓?query 鍏变韩 React Query 鐨?cache / dedup / retry 绛栫暐銆?  const queries = useQueries({
    queries: sampleIds.map((id) => ({
      queryKey: useActivity
        ? ['derived-activity', id, trackName, viewport.chr, viewport.start, viewport.end, bins]
        : ['bigwig-stacked', id, trackName, viewport.chr, viewport.start, viewport.end, bins],
      queryFn: () =>
        useActivity
          ? fetchDerivedActivity(
              id,
              viewport.chr,
              viewport.start,
              viewport.end,
              viewport.bin,
              bins,
            ).then((d) => ({ values: d.records.map((r) => r.score), source: d.source }))
          : fetchBigwig(
              id,
              trackName,
              viewport.chr,
              viewport.start,
              viewport.end,
              bins,
            ),
      enabled: !!trackName,
      
    staleTime: 30_000,
    })),
  });

  // 缂?meta 鏃舵湰鍦?fallback锛堜笌 sampleColors.ts 鐨?FALLBACK 淇濇寔涓€鑷达紱杩欓噷鏄惧紡閲嶅啓閬垮厤寰幆渚濊禆锛?  const fallback: SampleColor = {
    line: '#666666',
    fill: 'rgba(102, 102, 102, 0.60)',
  };
  // 鎸?sampleIds 椤哄簭鏋勯€?series鈥斺€斾繚璇佹渶缁?Plotly 鍒囩墖椤哄簭 = URL 閫夋嫨椤哄簭銆?  // activity 璺緞杩斿洖 number[]锛岀粺涓€杞?Float32Array 婊¤冻 BigwigSeries.values 绫诲瀷銆?  const series: BigwigSeries[] = sampleIds.map((id, i) => {
    const meta = sampleMeta?.[i];
    const c = meta ? colorForTissue(meta.tissue) : fallback;
    const raw = queries[i]?.data?.values;
    const values =
      raw === undefined
        ? undefined
        : raw instanceof Float32Array
          ? raw
          : new Float32Array(raw);
    return {
      id,
      values,
      line: c.line,
      fill: c.fill,
    };
  });

  // 鍗曟牱鏈?鈫?鍗曚釜 bigwig锛涒墺2 鏍锋湰 鈫?demo 椋庢牸鍙犲姞鍒囩墖銆?  // lane 楂樺害闅忔牱鏈暟澧為暱锛氭瘡鐗囨渶灏?70px锛屽浐瀹?30px 浣欓噺锛堥《閮ㄦ爣棰?+ 搴曢儴 margin锛夈€?  const stackedLaneHeight =
    series.length === 1
      ? height ?? 180
      : Math.max(height ?? 180, 70 * series.length + 30);
  const plot =
    series.length === 1
      ? buildBigwig(series[0].values, viewport, title, stackedLaneHeight)
      : buildBigwigStacked(
          series,
          viewport,
          title,
          stackedLaneHeight,
          groupLabel ?? title,
          highlightBands,
        );

  // 浠讳竴 query 澶辫触 鈫?鍦ㄥ彸涓婅鏄剧ず閿欒鏍囪锛堜絾涓嶉樆鏂叾瀹冨凡灏辩华鐨?trace锛?  const overlayError = queries.find((q) => q.error)?.error ?? null;
  const overlayLoading = queries.some((q) => q.isLoading);
  // activity 浠ｇ悊鏃舵墍鏈?sample 鍏变韩鍚屼竴 source锛坅b_proxy锛?  const activitySource = queries[0]?.data && 'source' in queries[0].data
    ? (queries[0].data as { source: string }).source
    : undefined;

  return (
    <div
      className="lane lane--stacked"
      style={{ height: `${stackedLaneHeight}px` }}
    >
      <div className="lane-label lane-label--stacked">
        <span className="lane-title">{title}</span>
        <span className="lane-sample">
          {sampleIds.length > 2
            ? `${sampleIds.slice(0, 2).join(', ')} +${sampleIds.length - 2}`
            : sampleIds.join(', ')}
        </span>
      </div>
      <div
        className="lane-content"
        data-kind={useActivity ? 'activity' : 'bigwig'}
        data-track-name={trackName}
      >
        {series.every((s) => !s.values) ? (
          <span className="placeholder">No samples selected</span>
        ) : (
          <PlotlyTrack data={plot.data} layout={plot.layout} height={stackedLaneHeight} />
        )}
        {useActivity && <ModelSourceBadge source={activitySource ?? 'ab_proxy'} />}
        {overlayLoading && <span className="track-loading">Loading鈥?/span>}
        {overlayError && (
          <span className="track-error" title={overlayError.message}>
            !
          </span>
        )}
      </div>
    </div>
  );
}
