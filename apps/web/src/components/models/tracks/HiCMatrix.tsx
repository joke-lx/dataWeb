/**
 * HiCMatrix —— Hi-C 接触矩阵 lane（tracks 模型专用）。
 *
 * 职责：
 *  - 拉取当前视口范围内的 Hi-C 矩阵；
 *  - 自适应选择合适的 bin 大小（不超过 `MAX_MATRIX_DIM`）；
 *  - 渲染 ColormapBar + WebGL 渲染的 `<HiCMatrix2D />`。
 *
 * 与 hic 模型下的同名组件视觉一致——本组件是 tracks 模型目录下的独立副本，
 * 避免跨模型共享（详见 ref1 决策）。
 *
 * 架构位置：被 `<LoopTrack />`、`<GenomeBrowserView />` 调用。
 *
 * 面板增强（Compare 工作区 / 一体化视图）：
 *  - `colorMap` / `onColorMapChange`：色标受控（工具栏下拉），不再走本地状态；
 *  - `hideColorBar`：工具栏已带色标下拉时，隐藏 lane 内的 ColormapBar；
 *  - `triangle`：Triangle Mode，只显示上三角；
 *  - `colorMode`：`'auto'` = 用 API 返回的 vmin/vmax（自动色标），
 *    `'full'` = 固定 [0, 矩阵最大值]（关闭 Auto，全量程着色）；
 *  - `normalization`：后端显示归一化（log2 / raw / ice）；
 *  - `lockResolution`：true = 固定用户选的 bin，缩放不自动变粗；
 *    false（默认）= 宽视口时自动把 bin 变粗以控制矩阵维度。
 */

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
  /** 覆盖当前样本。 */
  sampleId?: string;
  /** 覆盖 lane 像素高度。 */
  height?: number;
  /** 受控色标（缺省走本地状态，缺省 'ref'）。 */
  colorMap?: ColormapName;
  /** 色标变更回调（与 `colorMap` 同时传入即为受控模式）。 */
  onColorMapChange?: (cm: ColormapName) => void;
  /** 隐藏 lane 内的 ColormapBar（色标下拉已放到面板工具栏时用）。 */
  hideColorBar?: boolean;
  /** Triangle Mode：只显示上三角。 */
  triangle?: boolean;
  /** 色标量程：'auto' = API vmin/vmax；'full' = [0, 矩阵最大值]。 */
  colorMode?: 'auto' | 'full';
  /** 后端显示归一化：log2 / raw / ice。 */
  normalization?: HicNormalization;
  /** 锁定分辨率：true 时缩放不自动把 bin 变粗。 */
  lockResolution?: boolean;
  /** 手动色阶上界缩放：1.0=Auto/full 全上界，0.1=压到 10%。 */
  vmaxScale?: number;
}

/**
 * Hi-C 接触矩阵 lane：左侧 ColormapBar + WebGL 渲染的 2D 热图。
 *
 * bin 自适应：保证矩阵像素不超过 `MAX_MATRIX_DIM`，bin 向上对齐到 1000 的倍数
 * （匹配后端 cache key 的离散化粒度）。
 *
 * @param sampleId 覆盖默认 sample（缺省走 activeSample，再缺省 Brain_BF3）
 * @param height lane 高度（默认 480px，LoopTrack 用 320px）
 */
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

  // 本地色标兜底：未受控时本 lane 内自选，不写 URL。
  const [localMap, setLocalMap] = useState<ColormapName>('ref');
  const colorMap = colorMapProp ?? localMap;
  const setColorMap = onColorMapChange ?? setLocalMap;

  // colorMode='full' 时需要的矩阵最大值（关闭 Auto 的全量程上界）。
  const [matrixMax, setMatrixMax] = useState<number | null>(null);

  const viewportWidth = viewport.end - viewport.start;
  const targetBin = Math.ceil(viewportWidth / MAX_MATRIX_DIM);
  // bin 必须不小于当前 viewport 自带的 bin（防止过采样），同时向上对齐 1000 倍数
  // ——后端按这个粒度缓存，命中 cache 比精确粒度更省时。
  // lockResolution=true 时跳过自动变粗，严格用用户选的 viewport.bin。
  const hicBin = lockResolution
    ? viewport.bin
    : Math.max(viewport.bin, Math.ceil(targetBin / 1000) * 1000);

  // hicBin / normalization 进 queryKey → zoom / 切归一化时重新拉数据。
  const { data, isLoading, error } = useQuery<HicMatrixResponse>({
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
    placeholderData: keepPreviousData,
    staleTime: 30_000,
  });

  // colorMode='full' 时统计矩阵最大值（依赖 data，须在 useQuery 之后声明）。
  useEffect(() => {
    if (colorMode !== 'full' || !data) return;
    let max = 0;
    const arr = data.matrix;
    for (let i = 0; i < arr.length; i += 1) {
      if (arr[i] > max) max = arr[i];
    }
    setMatrixMax(max);
  }, [colorMode, data]);

  // Auto 开 = 用 API 返回的 vmin/vmax；Auto 关 = [0, 矩阵最大值]。
  // vmaxScale 是手动色阶滑杆：对选中的上界再乘一个比例（压暗高值/提亮低值）。
  const baseVmax =
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
