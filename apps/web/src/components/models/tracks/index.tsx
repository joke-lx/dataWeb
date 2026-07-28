/**
 * Tracks 模型入口 —— `/tracks` 路由对应的 ModelFactory 组件。
 *
 * 职责：
 *  - 接收当前 sub-tab（来自路由参数 `tab`）、单样本 id、aux 辅助轨道列表，
 *    以及 bigwig 多样本叠加所需的多样本 id 与样本元数据；
 *  - 根据 `TRACK_CATALOG[tab].kind` 把"主轨道"分派到对应 Lane 组件
 *    （BigwigStacked / BedGraphLane / InsulationLane / PeiLane / TadBar / GeneLane / BigwigLane）；
 *  - 再依次为每个 aux id 渲染辅助 Lane；
 *  - `loop` 是特例：跳过本分派逻辑，直接交给 `<LoopTrack />`（Hi-C + CTCF loops 叠加）。
 *
 * 架构位置：作为 `tracks` 模型目录的业务组合层，只负责"按 kind 调度，
 * 不关心具体 lane 怎么画"——渲染细节（Plotly 数据、坐标系、tooltip）
 * 全部委托给 `render-kit/plotlyBuilders` 与各 Lane 组件。
 */

import type { JSX } from 'react';

import type { Sample } from '../../../api/types';
import type { TrackId } from './trackSpec';
import { TRACK_CATALOG } from './trackSpec';
import { BedGraphLane } from './BedGraphLane';
import { BigwigLane } from './BigwigLane';
import { BigwigStacked } from './BigwigStackedLane';
import { GeneLane } from './GeneLane';
import { InsulationLane } from './InsulationLane';
import { LoopTrack } from './LoopTrack';
import { PeiLane } from './PeiLane';
import { SvLane } from './SvLane';
import { TadBar } from './TadBar';

interface TracksModelProps {
  /** The active sub-tab id (e.g. 'rna_seq', 'ab', 'tad', ...) */
  tab: TrackId;
  /** Current single-sample id (used for non-bigwig tracks) */
  sampleId: string;
  /** Auxiliary track ids to render below the main track */
  aux: TrackId[];
  /** Multi-sample ids for bigwig overlay (undefined for non-bigwig tabs) */
  overlaySampleIds?: string[];
  /** Multi-sample metadata for coloring */
  overlayMeta?: Sample[];
}

/**
 * Tracks 模型组合组件：渲染主轨道 + 一组 aux 辅助轨道。
 *
 * 分派逻辑：
 *  - `loop` → 走 `<LoopTrack />` 独立布局；
 *  - `bigwig` 走叠加版的 `BigwigStacked`（支持多 sample 横向切片）；
 *  - 其他 kind 各对应独立 Lane 组件；
 *  - 兜底仍使用 `BigwigLane`（保守 fallback，保证至少有图可看）。
 */
export function TracksModel({
  tab,
  sampleId,
  aux,
  overlaySampleIds,
  overlayMeta,
}: TracksModelProps): JSX.Element {
  const mainSpec = TRACK_CATALOG[tab];

  // `loop` 是混合布局（Hi-C + SVG 叠加 + gene），不走 kind 分派。
  if (tab === 'loop') {
    return <LoopTrack sampleId={sampleId} />;
  }

  // 按 mainSpec.kind 决定主轨道的渲染组件。
  const renderMain = (): JSX.Element => {
    if (mainSpec.kind === 'bigwig') {
      return (
        <BigwigStacked
          sampleIds={overlaySampleIds ?? [sampleId]}
          sampleMeta={overlayMeta}
          trackName={mainSpec.trackName ?? 'rna_seq'}
          title={mainSpec.title}
          groupLabel={mainSpec.title}
          height={mainSpec.defaultHeight}
        />
      );
    }
    if (mainSpec.kind === 'bedGraph') {
      return (
        <BedGraphLane
          sampleId={sampleId}
          trackName={mainSpec.trackName ?? 'ab'}
          title={mainSpec.title}
          height={mainSpec.defaultHeight}
        />
      );
    }
    if (mainSpec.kind === 'is') {
      return (
        <InsulationLane
          sampleId={sampleId}
          trackName={mainSpec.trackName ?? 'is'}
          title={mainSpec.title}
          height={mainSpec.defaultHeight}
        />
      );
    }
    if (mainSpec.kind === 'pei') {
      return (
        <PeiLane
          sampleId={sampleId}
          trackName={mainSpec.trackName ?? 'pei'}
          title={mainSpec.title}
          height={mainSpec.defaultHeight}
        />
      );
    }
    if (mainSpec.kind === 'tadBar') {
      return <TadBar sampleId={sampleId} height={mainSpec.defaultHeight} />;
    }
    if (mainSpec.kind === 'gene') {
      return <GeneLane sampleId={sampleId} height={mainSpec.defaultHeight} />;
    }
    // 兜底分支：未知 kind 时仍尝试用 BigwigLane 渲染（保证 DOM 总有内容）
    return (
      <BigwigLane
        sampleId={sampleId}
        trackName={mainSpec.trackName ?? 'rna_seq'}
        height={mainSpec.defaultHeight}
      />
    );
  };

  // 与 renderMain 几乎同构，但额外支持 `sv`（aux 才会用到，主轨道没有 sv）。
  const renderAux = (auxId: TrackId): JSX.Element => {
    const auxSpec = TRACK_CATALOG[auxId];
    if (auxSpec.kind === 'bigwig') {
      return (
        <BigwigLane
          sampleId={sampleId}
          trackName={auxSpec.trackName ?? 'rna_seq'}
          height={auxSpec.defaultHeight}
        />
      );
    }
    if (auxSpec.kind === 'bedGraph') {
      return (
        <BedGraphLane
          sampleId={sampleId}
          trackName={auxSpec.trackName ?? 'ab'}
          title={auxSpec.title}
          height={auxSpec.defaultHeight}
        />
      );
    }
    if (auxSpec.kind === 'is') {
      return (
        <InsulationLane
          sampleId={sampleId}
          trackName={auxSpec.trackName ?? 'is'}
          title={auxSpec.title}
          height={auxSpec.defaultHeight}
        />
      );
    }
    if (auxSpec.kind === 'pei') {
      return (
        <PeiLane
          sampleId={sampleId}
          trackName={auxSpec.trackName ?? 'pei'}
          title={auxSpec.title}
          height={auxSpec.defaultHeight}
        />
      );
    }
    if (auxSpec.kind === 'tadBar') {
      return <TadBar sampleId={sampleId} height={auxSpec.defaultHeight} />;
    }
    if (auxSpec.kind === 'gene') {
      return <GeneLane sampleId={sampleId} height={auxSpec.defaultHeight} />;
    }
    if (auxSpec.kind === 'sv') {
      return <SvLane sampleId={sampleId} title={auxSpec.title} height={auxSpec.defaultHeight} />;
    }
    return (
      <BigwigLane
        sampleId={sampleId}
        trackName={auxSpec.trackName ?? 'rna_seq'}
        height={auxSpec.defaultHeight}
      />
    );
  };

  return (
    <>
      {renderMain()}
      {aux.map((auxId) => (
        <div key={auxId}>{renderAux(auxId)}</div>
      ))}
    </>
  );
}

export default TracksModel;
