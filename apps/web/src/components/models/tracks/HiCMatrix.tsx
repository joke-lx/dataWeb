/**
 * HiCMatrix 鈥斺€?Hi-C 鎺ヨЕ鐭╅樀 lane锛坱racks 妯″瀷涓撶敤锛夈€? *
 * 鑱岃矗锛? *  - 鎷夊彇褰撳墠瑙嗗彛鑼冨洿鍐呯殑 Hi-C 鐭╅樀锛? *  - 鑷€傚簲閫夋嫨鍚堥€傜殑 bin 澶у皬锛堜笉瓒呰繃 `MAX_MATRIX_DIM`锛夛紱
 *  - 娓叉煋 ColormapBar + WebGL 娓叉煋鐨?`<HiCMatrix2D />`銆? *
 * 涓?hic 妯″瀷涓嬬殑鍚屽悕缁勪欢瑙嗚涓€鑷粹€斺€旀湰缁勪欢鏄?tracks 妯″瀷鐩綍涓嬬殑鐙珛鍓湰锛? * 閬垮厤璺ㄦā鍨嬪叡浜紙璇﹁ ref1 鍐崇瓥锛夈€? *
 * 鏋舵瀯浣嶇疆锛氳 `<LoopTrack />`銆乣<GenomeBrowserView />` 璋冪敤銆? *
 * 闈㈡澘澧炲己锛圕ompare 宸ヤ綔鍖?/ 涓€浣撳寲瑙嗗浘锛夛細
 *  - `colorMap` / `onColorMapChange`锛氳壊鏍囧彈鎺э紙宸ュ叿鏍忎笅鎷夛級锛屼笉鍐嶈蛋鏈湴鐘舵€侊紱
 *  - `hideColorBar`锛氬伐鍏锋爮宸插甫鑹叉爣涓嬫媺鏃讹紝闅愯棌 lane 鍐呯殑 ColormapBar锛? *  - `triangle`锛歍riangle Mode锛屽彧鏄剧ず涓婁笁瑙掞紱
 *  - `colorMode`锛歚'auto'` = 鐢?API 杩斿洖鐨?vmin/vmax锛堣嚜鍔ㄨ壊鏍囷級锛? *    `'full'` = 鍥哄畾 [0, 鐭╅樀鏈€澶у€糫锛堝叧闂?Auto锛屽叏閲忕▼鐫€鑹诧級锛? *  - `normalization`锛氬悗绔樉绀哄綊涓€鍖栵紙log2 / raw / ice锛夛紱
 *  - `lockResolution`锛歵rue = 鍥哄畾鐢ㄦ埛閫夌殑 bin锛岀缉鏀句笉鑷姩鍙樼矖锛? *    false锛堥粯璁わ級= 瀹借鍙ｆ椂鑷姩鎶?bin 鍙樼矖浠ユ帶鍒剁煩闃电淮搴︺€? */

import { useEffect, useState } from 'react';
import type { JSX } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';

import {
  fetchHicMatrix,
  type HicMatrixResponse,
  type HicNormalization,
} from '../../../api/client';
import { useActiveSample } from '../../../hooks/useActiveSample';
import { usePanelViewport } from '../../../hooks/usePanelViewport';
import { ColormapBar, type ColormapName } from '../../render-kit/hic/ColormapBar';
import { HiCMatrix2D } from '../../render-kit/hic/HiCMatrix2D';
import '../../render-kit/hic/hic.css';

const MAX_MATRIX_DIM = 512;
const HIC_LANE_HEIGHT = 480;

interface HiCMatrixProps {
  /** 瑕嗙洊褰撳墠鏍锋湰銆?*/
  sampleId?: string;
  /** 瑕嗙洊 lane 鍍忕礌楂樺害銆?*/
  height?: number;
  /** 鍙楁帶鑹叉爣锛堢己鐪佽蛋鏈湴鐘舵€侊紝缂虹渷 'ref'锛夈€?*/
  colorMap?: ColormapName;
  /** 鑹叉爣鍙樻洿鍥炶皟锛堜笌 `colorMap` 鍚屾椂浼犲叆鍗充负鍙楁帶妯″紡锛夈€?*/
  onColorMapChange?: (cm: ColormapName) => void;
  /** 闅愯棌 lane 鍐呯殑 ColormapBar锛堣壊鏍囦笅鎷夊凡鏀惧埌闈㈡澘宸ュ叿鏍忔椂鐢級銆?*/
  hideColorBar?: boolean;
  /** Triangle Mode锛氬彧鏄剧ず涓婁笁瑙掋€?*/
  triangle?: boolean;
  /** 鑹叉爣閲忕▼锛?auto' = API vmin/vmax锛?full' = [0, 鐭╅樀鏈€澶у€糫銆?*/
  colorMode?: 'auto' | 'full';
  /** 鍚庣鏄剧ず褰掍竴鍖栵細log2 / raw / ice銆?*/
  normalization?: HicNormalization;
  /** 閿佸畾鍒嗚鲸鐜囷細true 鏃剁缉鏀句笉鑷姩鎶?bin 鍙樼矖銆?*/
  lockResolution?: boolean;
  /** 鎵嬪姩鑹查樁涓婄晫缂╂斁锛?.0=Auto/full 鍏ㄤ笂鐣岋紝0.1=鍘嬪埌 10%銆?*/
  vmaxScale?: number;
}

/**
 * Hi-C 鎺ヨЕ鐭╅樀 lane锛氬乏渚?ColormapBar + WebGL 娓叉煋鐨?2D 鐑浘銆? *
 * bin 鑷€傚簲锛氫繚璇佺煩闃靛儚绱犱笉瓒呰繃 `MAX_MATRIX_DIM`锛宐in 鍚戜笂瀵归綈鍒?1000 鐨勫€嶆暟
 * 锛堝尮閰嶅悗绔?cache key 鐨勭鏁ｅ寲绮掑害锛夈€? *
 * @param sampleId 瑕嗙洊榛樿 sample锛堢己鐪佽蛋 activeSample锛屽啀缂虹渷 Brain_BF3锛? * @param height lane 楂樺害锛堥粯璁?480px锛孡oopTrack 鐢?320px锛? */
export function HiCMatrix({
  sampleId: sampleIdOverride,
  height = HIC_LANE_HEIGHT,
  colorMap: colorMapProp,
  onColorMapChange,
  hideColorBar = false,
  triangle = false,
  colorMode = 'auto',
  normalization = 'log2',
  lockResolution = false,
  vmaxScale = 1,
}: HiCMatrixProps): JSX.Element {
  const viewport = usePanelViewport();
  const activeSample = useActiveSample();
  const sampleId = sampleIdOverride ?? activeSample ?? 'Brain_BF3';

  // 鏈湴鑹叉爣鍏滃簳锛氭湭鍙楁帶鏃舵湰 lane 鍐呰嚜閫夛紝涓嶅啓 URL銆?  const [localMap, setLocalMap] = useState<ColormapName>('ref');
  const colorMap = colorMapProp ?? localMap;
  const setColorMap = onColorMapChange ?? setLocalMap;

  // colorMode='full' 鏃堕渶瑕佺殑鐭╅樀鏈€澶у€硷紙鍏抽棴 Auto 鐨勫叏閲忕▼涓婄晫锛夈€?  const [matrixMax, setMatrixMax] = useState<number | null>(null);

  const viewportWidth = viewport.end - viewport.start;
  const targetBin = Math.ceil(viewportWidth / MAX_MATRIX_DIM);
  // bin 蹇呴』涓嶅皬浜庡綋鍓?viewport 鑷甫鐨?bin锛堥槻姝㈣繃閲囨牱锛夛紝鍚屾椂鍚戜笂瀵归綈 1000 鍊嶆暟
  // 鈥斺€斿悗绔寜杩欎釜绮掑害缂撳瓨锛屽懡涓?cache 姣旂簿纭矑搴︽洿鐪佹椂銆?  // lockResolution=true 鏃惰烦杩囪嚜鍔ㄥ彉绮楋紝涓ユ牸鐢ㄧ敤鎴烽€夌殑 viewport.bin銆?  const hicBin = lockResolution
    ? viewport.bin
    : Math.max(viewport.bin, Math.ceil(targetBin / 1000) * 1000);

  // hicBin / normalization 杩?queryKey 鈫?zoom / 鍒囧綊涓€鍖栨椂閲嶆柊鎷夋暟鎹€?  const { data, isLoading, error } = useQuery<HicMatrixResponse>({
    queryKey: [
      'hic',
      sampleId,
      viewport.chr,
      viewport.start,
      viewport.end,
      viewport.bin,
      hicBin,
      normalization,
    ],
    queryFn: () =>
      fetchHicMatrix(
        sampleId,
        viewport.chr,
        viewport.start,
        viewport.end,
        hicBin,
        normalization,
      ),
    
    staleTime: 30_000,
  });

  // colorMode='full' 鏃剁粺璁＄煩闃垫渶澶у€硷紙渚濊禆 data锛岄』鍦?useQuery 涔嬪悗澹版槑锛夈€?  useEffect(() => {
    if (colorMode !== 'full' || !data) return;
    let max = 0;
    const arr = data.matrix;
    for (let i = 0; i < arr.length; i += 1) {
      if (arr[i] > max) max = arr[i];
    }
    setMatrixMax(max);
  }, [colorMode, data]);

  // Auto 寮€ = 鐢?API 杩斿洖鐨?vmin/vmax锛汚uto 鍏?= [0, 鐭╅樀鏈€澶у€糫銆?  // vmaxScale 鏄墜鍔ㄨ壊闃舵粦鏉嗭細瀵归€変腑鐨勪笂鐣屽啀涔樹竴涓瘮渚嬶紙鍘嬫殫楂樺€?鎻愪寒浣庡€硷級銆?  const baseVmax =
    colorMode === 'full' ? (matrixMax ?? data?.vmax ?? 1) : (data?.vmax ?? 1);
  const vmin = colorMode === 'full' ? 0 : data?.vmin;
  const vmax = baseVmax * vmaxScale;

  return (
    <div className="lane" style={{ height: `${height}px` }}>
      <div className="lane-label">
        <span className="lane-title">Hi-C matrix</span>
        <span className="lane-sample">{sampleId}</span>
      </div>
      <div
        className="hic-lane"
        style={{
          display: 'flex',
          flexDirection: 'row',
          alignItems: 'stretch',
          flex: '1 1 auto',
          minWidth: 0,
        }}
      >
        {!hideColorBar && (
          <ColormapBar
            vmin={vmin ?? 0}
            vmax={vmax ?? 1}
            colorMap={colorMap}
            onChange={setColorMap}
          />
        )}
        <HiCMatrix2D
          sampleId={sampleId}
          data={data}
          loading={isLoading}
          error={error}
          colorMap={colorMap}
          vmin={vmin}
          vmax={vmax}
          bin={hicBin}
          height={height - 32}
          triangle={triangle}
        />
      </div>
    </div>
  );
}

