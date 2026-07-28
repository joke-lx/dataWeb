/**
 * 基因组坐标 ↔ 屏幕像素的纯函数转换。
 *
 * 职责：所有 viewer 共享的"坐标系"——给定 viewport 与容器宽度，把 bp 映射到
 * px 或反过来。是 d3-zoom、RegionInput、cursor 反馈条等都依赖的"真理"。
 *
 * 为什么纯函数：放进 zustand store 会引入 react 生命周期；保持纯函数方便
 * 在 test / canvas / d3 transform 数学中复用。
 */

import type { Viewport } from '../store/viewport';

/**
 * 把一个 bp 坐标投影到容器内的像素 x。
 * 线性映射，viewport 区间当作 [0, widthPx] 的全宽。
 */
export function bpToPx(
  bp: number,
  viewport: Viewport,
  widthPx: number,
): number {
  return (
    ((bp - viewport.start) / (viewport.end - viewport.start)) * widthPx
  );
}

/**
 * 反向：把容器内的像素 x 转回 bp。
 * 与 `bpToPx` 互为反函数——d3-zoom 拿到的平移增量会在这里被解释回碱基偏移。
 */
export function pxToBp(
  px: number,
  viewport: Viewport,
  widthPx: number,
): number {
  return (
    viewport.start +
    (px / widthPx) * (viewport.end - viewport.start)
  );
}

/**
 * 把 bp 数值格式化为人类可读（Mb / kb / bp）。
 * 用于 region breadcrumb、tooltip、status bar 等所有文本显示。
 */
export function formatBp(bp: number): string {
  if (bp >= 1_000_000) return `${(bp / 1_000_000).toFixed(2)} Mb`;
  if (bp >= 1_000) return `${(bp / 1_000).toFixed(1)} kb`;
  return `${bp} bp`;
}
