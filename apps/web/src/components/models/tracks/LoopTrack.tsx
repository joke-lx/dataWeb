/**
 * LoopTrack —— "loops" sub-tab 的特殊复合布局。
 *
 * 职责：把 Hi-C 矩阵 + SVG 叠加（CTCF loops）+ Gene 注释按垂直顺序拼接。
 *
 * 与普通 tracks 的差异：
 *  - 不是按 `kind` 分派的 lane 组合，而是自带 overlay 容器；
 *  - 监听 `resize` 调整 SVG 宽度（容器比 lane 多一个 left-gutter，差 240px）。
 *
 * 架构位置：tracks 模型目录下的"复合轨道"，被 `<TracksModel />` 在
 * `tab === 'loop'` 时直接渲染，绕开 kind 分派。
 */

import { useEffect, useState } from 'react';
import type { JSX } from 'react';

import { CTCFLoops } from '../../../components/overlay/CTCFLoops';
import { GeneLane } from './GeneLane';
import { HiCMatrix } from './HiCMatrix';
import './tracks.css';

const LOOP_HIC_HEIGHT = 320;

interface LoopTrackProps {
  sampleId: string;
}

/**
 * "loops" sub-tab 的特殊布局：Hi-C(320) + SVG CTCF loops overlay(60) + gene。
 *
 * @param sampleId 当前样本 id（同时驱动 Hi-C / CTCFLoops / Gene 三个子组件）
 */
export function LoopTrack({ sampleId }: LoopTrackProps): JSX.Element {
  // SVG overlay 宽度跟视窗宽度走：右侧空出 240px（left-gutter + 边距），
  // 下限 320 防止极窄窗口把 SVG 挤成竖条。
  const [overlayWidth, setOverlayWidth] = useState<number>(() =>
    typeof window === 'undefined' ? 800 : window.innerWidth - 240,
  );

  useEffect(() => {
    const onResize = () => setOverlayWidth(Math.max(320, window.innerWidth - 240));
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  return (
    <div className="loop-track">
      <HiCMatrix sampleId={sampleId} height={LOOP_HIC_HEIGHT} />
      <div className="loop-track__overlay" style={{ width: '100%', height: 60 }}>
        <CTCFLoops sampleId={sampleId} height={60} width={overlayWidth} />
      </div>
      <GeneLane sampleId={sampleId} />
    </div>
  );
}