// ── File preview utilities ────────────────────────────────────────────────────
// Mirrors the detection/formatting logic from:
//   src/lib/components/common/FileItemModal.svelte (lines 69-129)
//   src/lib/utils/index.ts (formatFileSize, getLineCount)

export type FilePreviewType =
  | 'pdf'
  | 'image'
  | 'audio'
  | 'excel'
  | 'code'
  | 'markdown'
  | 'text';

const CODE_EXTENSIONS = new Set([
  'py', 'js', 'ts', 'jsx', 'tsx', 'java', 'html', 'css', 'json',
  'cpp', 'c', 'h', 'sh', 'bash', 'yaml', 'yml', 'xml', 'sql',
  'go', 'rs', 'php', 'rb',
]);

const IMAGE_EXTENSIONS = new Set([
  'png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp', 'ico',
]);

const AUDIO_EXTENSIONS = new Set(['mp3', 'wav', 'ogg', 'm4a', 'webm']);

const EXCEL_EXTENSIONS = new Set(['xls', 'xlsx', 'csv']);

const EXCEL_MIME = new Set([
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/csv',
  'application/csv',
]);

function ext(filename: string): string {
  return filename.split('.').pop()?.toLowerCase() ?? '';
}

export function detectFileType(
  name: string,
  contentType?: string,
): FilePreviewType {
  const e = ext(name);
  const ct = contentType ?? '';

  if (ct === 'application/pdf' || e === 'pdf') return 'pdf';
  if (ct.startsWith('image/') || IMAGE_EXTENSIONS.has(e)) return 'image';
  if (ct.startsWith('audio/') || AUDIO_EXTENSIONS.has(e)) return 'audio';
  if (EXCEL_MIME.has(ct) || EXCEL_EXTENSIONS.has(e)) return 'excel';
  if (e === 'md' || e === 'markdown' || e === 'mdx' || ct === 'text/markdown') return 'markdown';
  if (CODE_EXTENSIONS.has(e)) return 'code';
  return 'text';
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

export function getLineCount(text: string): number {
  if (!text) return 0;
  return text.split('\n').length;
}

export function getCodeLanguage(filename: string): string {
  return ext(filename);
}
