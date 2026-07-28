/**
 * CtcfModel — CTCF motif + 基因型 viewer 的 ModelFactory 入口。
 *
 * 架构位置：
 * - 由 `components/models/registry.ts` 通过 `lazy()` 加载，对应 `ModelType = 'ctcf-motif'`
 * - 业务组件层（不是 render-kit）：自己拉数、自己组织两块面板
 *
 * 职责：
 * - 拉取当前 viewport 的 CTCF motif PWM 矩阵（随区间变化）
 * - 拉取"全局"genotype 分布（与 viewport 无关，仅在 mount 时拉一次）
 * - 把数据分别下发给 CtcfMotifLogo（SVG sequence logo）和 CtcfGenotypePie（饼图）
 *
 * 设计取舍：
 * - 两个 useEffect 各自管理一个独立的数据源 + AbortController，便于单边重试/取消
 * - 错误状态通过 `t('ctcf.viewer.error', ...)` 走 i18n，不直接硬编码英文
 * - 用 `if (...) return null` 之前已经写好 loading / error / success 三态分支，
 *   避免在 success 后又被 loading 状态覆盖（React render 顺序）
 */
import { useEffect, useState } from 'react';
import type { JSX } from 'react';

import { useAppIntl } from '../../../i18n';
import { fetchCtcfGenotype, fetchCtcfMotif } from '../../../api/client';
import type { CtcfGenotypeResponse, CtcfMotifResponse } from '../../../api/types';
import { CtcfGenotypePie } from './CtcfGenotypePie';
import { CtcfMotifLogo } from './CtcfMotifLogo';
import { useViewport } from '../../../store/viewport';

/**
 * CTCF motif viewer 根组件。包含两块面板：
 *   1. CTCF motif logo（基于当前 viewport 的 PWM 矩阵）
 *   2. Genotype distribution（基于全样本 SNP 基因型）
 */
export function CtcfModel(): JSX.Element {
  const { t } = useAppIntl();
  const viewport = useViewport();

  // 各自维护独立的"loading / error / data"三态，便于渲染时按状态分支
  const [motif, setMotif] = useState<CtcfMotifResponse | null>(null);
  const [motifLoading, setMotifLoading] = useState(false);
  const [motifError, setMotifError] = useState<string | null>(null);

  const [geno, setGeno] = useState<CtcfGenotypeResponse | null>(null);
  const [genoLoading, setGenoLoading] = useState(false);
  const [genoError, setGenoError] = useState<string | null>(null);

  // Motif 数据依赖 viewport：用户拖动/缩放时刷新
  useEffect(() => {
    const ctrl = new AbortController();
    setMotifLoading(true);
    setMotifError(null);
    // 'default' 是后端约定的 motif 集合名（不是物种/sample）；保留扩展位
    fetchCtcfMotif(viewport.chr, viewport.start, viewport.end, 'default')
      .then((res) => {
        if (!ctrl.signal.aborted) setMotif(res);
      })
      .catch((err: Error) => {
        if (!ctrl.signal.aborted) setMotifError(err.message);
      })
      .finally(() => {
        if (!ctrl.signal.aborted) setMotifLoading(false);
      });
    return () => ctrl.abort();
  }, [viewport.chr, viewport.start, viewport.end]);

  // Genotype 是全样本统计，与 viewport 无关——只在 mount 时拉一次
  useEffect(() => {
    const ctrl = new AbortController();
    setGenoLoading(true);
    setGenoError(null);
    fetchCtcfGenotype('global')
      .then((res) => {
        if (!ctrl.signal.aborted) setGeno(res);
      })
      .catch((err: Error) => {
        if (!ctrl.signal.aborted) setGenoError(err.message);
      })
      .finally(() => {
        if (!ctrl.signal.aborted) setGenoLoading(false);
      });
    return () => ctrl.abort();
  }, []);

  return (
    <div className="ctcf-motif-content">
      {/* 每块面板独立的三态分支：loading > error > success */}
      {motifLoading && <div className="ctcf-motif-panel"><p>{t('ctcf.viewer.loadingMotif')}</p></div>}
      {motifError && <div className="ctcf-motif-panel"><p>{t('ctcf.viewer.error', { message: motifError })}</p></div>}
      {motif && !motifLoading && !motifError && (
        <CtcfMotifLogo
          matrix={motif.matrix}
          consensus={motif.consensus}
        />
      )}

      {genoLoading && <div className="ctcf-motif-panel"><p>{t('ctcf.viewer.loadingGenotype')}</p></div>}
      {genoError && <div className="ctcf-motif-panel"><p>{t('ctcf.viewer.error', { message: genoError })}</p></div>}
      {geno && !genoLoading && !genoError && (
        <CtcfGenotypePie records={geno.records} />
      )}
    </div>
  );
}

export default CtcfModel;
