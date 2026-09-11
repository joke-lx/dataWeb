/**
 * ExportPdfButton —— 把 Hi-C 综合区块导出为 PDF 的按钮。
 *
 * 实现：浏览器原生打印导出。点击后在 `<body>` 上加 `printing-hic` 类，
 * 配套 `@media print` 规则只保留 Hi-C 区块（隐藏导航 / 侧栏 / 工具栏 /
 * 其他区块），随后调用 `window.print()`，用户在打印对话框选择"另存为 PDF"。
 *
 * 为什么不用 html2canvas + jsPDF：区块内含 WebGL（Hi-C 矩阵、3D 结构）
 * 与大型 Plotly SVG，html2canvas 复绘时会让 Chrome 标签页崩溃（本环境
 * 实测两次）。浏览器打印对 canvas 位图与 SVG 是原生支持，稳定可靠。
 *
 * 架构位置：通用反馈/导出组件，被 Sample 详情页的 Hi-C 区块标题栏调用。
 */

import { useCallback, useState } from 'react';
import type { JSX } from 'react';

interface ExportPdfButtonProps {
  /** 按钮文案（缺省英文 `Export PDF`）。 */
  label?: string;
  /** 导出中按钮文案（缺省 `…`）。 */
  busyLabel?: string;
}

/**
 * 打印导出按钮（目标区块由 CSS 的 `.printing-hic` 规则决定）。
 *
 * @param label 按钮文案
 */
export function ExportPdfButton({
  label = 'Export PDF',
  busyLabel = '…',
}: ExportPdfButtonProps): JSX.Element {
  const [busy, setBusy] = useState(false);

  const handleExport = useCallback((): void => {
    if (busy) return;
    setBusy(true);
    // 挂载 afterprint 清理（打印对话框关闭后移除类）；setTimeout 兜底，
    // 防止个别浏览器不派发 afterprint 导致页面停留在打印样式。
    const cleanup = (): void => {
      document.body.classList.remove('printing-hic');
      setBusy(false);
    };
    window.addEventListener('afterprint', cleanup, { once: true });
    document.body.classList.add('printing-hic');
    // window.print() 在部分浏览器同步阻塞直到对话框关闭；这里用 rAF
    // 确保类已写入后再触发，避免样式未生效。
    requestAnimationFrame(() => {
      window.print();
      setTimeout(cleanup, 1500);
    });
  }, [busy]);

  return (
    <button
      type="button"
      className="export-pdf-btn"
      onClick={handleExport}
      disabled={busy}
    >
      {busy ? busyLabel : label}
    </button>
  );
}
