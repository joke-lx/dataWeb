/**
 * File System Access API 的最小 ambient 声明。
 *
 * TypeScript 5.4 的 lib.dom 尚未包含 File System Access API
 * （showSaveFilePicker / FileSystemWritableFileStream 等）。这里只声明
 * useChunkedDownload 用到的极小表面，避免引入额外类型依赖。
 */

interface FileSystemWritableFileStream {
  write(data: unknown): Promise<void>;
  close(): Promise<void>;
  abort(): Promise<void>;
}

interface FileSystemFileHandle {
  createWritable(options?: { keepExistingData?: boolean }): Promise<FileSystemWritableFileStream>;
}

interface Window {
  showSaveFilePicker?: (options?: {
    suggestedName?: string;
    types?: Array<{ description?: string; accept: Record<string, string[]> }>;
  }) => Promise<FileSystemFileHandle>;
}
