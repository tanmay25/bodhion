'use client';

// ── FilePreviewModal ──────────────────────────────────────────────────────────
// React port of src/lib/components/common/FileItemModal.svelte
// Triggered by clicking a file chip in MessageBubble or the ChatWindow input area.
// Fetches full file metadata + extracted text from GET /api/v1/files/{id},
// then renders the appropriate preview based on file type.

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { X, Download, FileIcon, Loader2, ChevronDown, ChevronUp } from 'lucide-react';
import { marked } from 'marked';
import DOMPurify from 'dompurify';
import hljs from 'highlight.js';
import { cn } from '@/lib/utils/cn';
import { getFileById, getFileContentById } from '@/lib/api/files';
import { getToken } from '@/lib/auth/session';
import { WEBUI_API_BASE } from '@/lib/api/client';
import {
  detectFileType,
  formatFileSize,
  getLineCount,
  getCodeLanguage,
  type FilePreviewType,
} from '@/lib/utils/filePreview';
import type { UserFile } from '@/lib/api/files';

// Configure marked once (same settings as StreamingResponse)
marked.use({ gfm: true, breaks: true });

const CONTENT_PREVIEW_LIMIT = 10_000;

// ── Helpers ───────────────────────────────────────────────────────────────────

function renderMarkdown(text: string): string {
  try {
    const html = marked.parse(text, { async: false }) as string;
    return DOMPurify.sanitize(html);
  } catch {
    return DOMPurify.sanitize(text);
  }
}

function highlightCode(code: string, lang: string): string {
  try {
    return hljs.highlight(code, { language: lang, ignoreIllegals: true }).value;
  } catch {
    try { return hljs.highlightAuto(code).value; } catch { return code; }
  }
}

// ── Props ─────────────────────────────────────────────────────────────────────

export interface FilePreviewModalProps {
  /** Raw file ID (the value stored in `ChatFile.url` / `AttachedFile.url`) */
  fileId: string;
  /** Display name shown in the header */
  fileName: string;
  /** Content type hint — may be empty; detectFileType also checks extension */
  contentType?: string;
  onClose: () => void;
}

// ── Excel preview (lazy) ─────────────────────────────────────────────────────

interface ExcelState {
  sheetNames: string[];
  selectedSheet: string;
  html: string;
  rowCount: number;
  error: string;
}

async function loadExcel(
  token: string,
  fileId: string,
): Promise<ExcelState> {
  try {
    const [arrayBuffer, { read, utils }] = await Promise.all([
      getFileContentById(token, fileId),
      import('xlsx'),
    ]);
    const workbook = read(arrayBuffer, { type: 'array' });
    const sheetNames = workbook.SheetNames;
    if (sheetNames.length === 0) {
      return { sheetNames: [], selectedSheet: '', html: '', rowCount: 0, error: 'No sheets found.' };
    }
    const selectedSheet = sheetNames[0];
    const worksheet = workbook.Sheets[selectedSheet];
    const range = utils.decode_range(worksheet['!ref'] ?? 'A1:A1');
    const rowCount = range.e.r - range.s.r + 1;
    const html = DOMPurify.sanitize(
      utils.sheet_to_html(worksheet, { id: 'fpm-excel-table', editable: false, header: '' }),
    );
    return { sheetNames, selectedSheet, html, rowCount, error: '' };
  } catch {
    return { sheetNames: [], selectedSheet: '', html: '', rowCount: 0, error: 'Failed to load file. Try downloading it instead.' };
  }
}

// ── Component ─────────────────────────────────────────────────────────────────

export function FilePreviewModal({ fileId, fileName, contentType, onClose }: FilePreviewModalProps) {
  const [fileDetail, setFileDetail]   = useState<UserFile | null>(null);
  const [loading, setLoading]         = useState(true);
  const [tab, setTab]                 = useState<'content' | 'preview'>('content');
  const [expanded, setExpanded]       = useState(false);
  const [excel, setExcel]             = useState<ExcelState | null>(null);
  const [excelSheet, setExcelSheet]   = useState('');

  const overlayRef = useRef<HTMLDivElement>(null);

  const fileType: FilePreviewType = useMemo(
    () => detectFileType(fileName, fileDetail?.meta?.content_type ?? contentType),
    [fileName, contentType, fileDetail],
  );

  const hasPreviewTab = ['pdf', 'audio', 'excel', 'code', 'markdown'].includes(fileType);

  // ── Load file metadata ────────────────────────────────────────────────────
  useEffect(() => {
    const token = getToken();
    if (!token) return;

    setLoading(true);
    setTab('content');
    setExpanded(false);
    setExcel(null);

    getFileById(token, fileId)
      .then(async (file) => {
        setFileDetail(file);
        if (detectFileType(fileName, file.meta?.content_type ?? contentType) === 'excel') {
          const excelData = await loadExcel(token, fileId);
          setExcel(excelData);
          setExcelSheet(excelData.selectedSheet);
        }
      })
      .catch(() => { /* show no content */ })
      .finally(() => setLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fileId]);

  // ── Sheet switch for Excel ────────────────────────────────────────────────
  useEffect(() => {
    if (!excel || !excelSheet || excelSheet === excel.selectedSheet) return;

    const token = getToken();
    if (!token) return;

    (async () => {
      try {
        const [arrayBuffer, { read, utils }] = await Promise.all([
          getFileContentById(token, fileId),
          import('xlsx'),
        ]);
        const workbook = read(arrayBuffer, { type: 'array' });
        const worksheet = workbook.Sheets[excelSheet];
        if (!worksheet) return;
        const range = utils.decode_range(worksheet['!ref'] ?? 'A1:A1');
        const rowCount = range.e.r - range.s.r + 1;
        const html = DOMPurify.sanitize(
          utils.sheet_to_html(worksheet, { id: 'fpm-excel-table', editable: false, header: '' }),
        );
        setExcel((prev) => prev ? { ...prev, selectedSheet: excelSheet, html, rowCount } : prev);
      } catch { /* keep old content */ }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [excelSheet]);

  // ── Close on backdrop click ───────────────────────────────────────────────
  const handleOverlayClick = useCallback((e: React.MouseEvent) => {
    if (e.target === overlayRef.current) onClose();
  }, [onClose]);

  // ── Close on Escape ───────────────────────────────────────────────────────
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  // ── Derived content values ────────────────────────────────────────────────
  const extractedText = fileDetail?.data?.content ?? '';
  const size          = fileDetail?.meta?.size;
  const lineCount     = extractedText ? getLineCount(extractedText) : 0;
  const isTruncated   = !expanded && extractedText.length > CONTENT_PREVIEW_LIMIT;
  const displayText   = isTruncated ? extractedText.slice(0, CONTENT_PREVIEW_LIMIT) : extractedText;
  const contentUrl    = `${WEBUI_API_BASE}/files/${fileId}/content`;

  // ── Portal render ─────────────────────────────────────────────────────────
  if (typeof document === 'undefined') return null;

  return createPortal(
    <div
      ref={overlayRef}
      className="fpm-overlay"
      onClick={handleOverlayClick}
      role="dialog"
      aria-modal="true"
      aria-label={fileName}
    >
      <div className="fpm-panel">

        {/* ── Header ───────────────────────────────────────────────────── */}
        <div className="fpm-header">
          <div className="fpm-header-left">
            {fileType === 'pdf' ? (
              <span className="fpm-filename">{fileName}</span>
            ) : (
              <a
                href={contentUrl}
                download={fileName}
                className="fpm-filename fpm-filename--link"
                title="Download file"
              >
                {fileName}
                <Download className="fpm-filename-icon" />
              </a>
            )}
          </div>
          <button type="button" className="fpm-close" onClick={onClose} aria-label="Close">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* ── Metadata strip ───────────────────────────────────────────── */}
        <div className="fpm-meta">
          {size !== undefined && size > 0 && (
            <span className="fpm-meta-item">{formatFileSize(size)}</span>
          )}
          {lineCount > 0 && (
            <>
              {size !== undefined && <span className="fpm-meta-sep">·</span>}
              <span className="fpm-meta-item">
                {fileType === 'excel' && excel && tab === 'preview'
                  ? `${excel.rowCount} rows`
                  : `${lineCount} extracted lines`}
              </span>
              <span className="fpm-meta-sep">·</span>
              <span className="fpm-meta-item fpm-meta-item--muted">Formatting may be inconsistent from source.</span>
            </>
          )}
        </div>

        {/* ── Tab bar ──────────────────────────────────────────────────── */}
        {hasPreviewTab && (
          <div className="fpm-tabs">
            <button
              type="button"
              className={cn('fpm-tab', tab === 'content' && 'fpm-tab--active')}
              onClick={() => setTab('content')}
            >
              Content
            </button>
            <button
              type="button"
              className={cn('fpm-tab', tab === 'preview' && 'fpm-tab--active')}
              onClick={() => setTab('preview')}
            >
              Preview
            </button>
          </div>
        )}

        {/* ── Body ─────────────────────────────────────────────────────── */}
        <div className="fpm-body">
          {loading ? (
            <div className="fpm-loading">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          ) : (
            <>
              {/* ── Image (no tabs) ─────────────────────────────────── */}
              {fileType === 'image' && (
                <div className="fpm-image-wrap">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={contentUrl}
                    alt={fileName}
                    className="fpm-image"
                    loading="lazy"
                    draggable={false}
                  />
                </div>
              )}

              {/* ── Content tab ─────────────────────────────────────── */}
              {fileType !== 'image' && tab === 'content' && (
                <div className="fpm-content-tab">
                  {extractedText ? (
                    <>
                      <div
                        className="fpm-markdown msg-markdown"
                        // eslint-disable-next-line react/no-danger
                        dangerouslySetInnerHTML={{ __html: renderMarkdown(displayText) }}
                      />
                      {isTruncated && (
                        <button
                          type="button"
                          className="fpm-show-all"
                          onClick={() => setExpanded(true)}
                        >
                          <ChevronDown className="h-3.5 w-3.5" />
                          Show all ({extractedText.length.toLocaleString()} characters)
                        </button>
                      )}
                      {expanded && extractedText.length > CONTENT_PREVIEW_LIMIT && (
                        <button
                          type="button"
                          className="fpm-show-all"
                          onClick={() => setExpanded(false)}
                        >
                          <ChevronUp className="h-3.5 w-3.5" />
                          Collapse
                        </button>
                      )}
                    </>
                  ) : (
                    <div className="fpm-no-content">
                      <FileIcon className="h-8 w-8 mb-2 opacity-30" />
                      <p>No extracted content available.</p>
                      <a href={contentUrl} download={fileName} className="fpm-download-link">
                        Download file
                      </a>
                    </div>
                  )}
                </div>
              )}

              {/* ── Preview tab ─────────────────────────────────────── */}
              {fileType !== 'image' && tab === 'preview' && (
                <div className="fpm-preview-tab">

                  {/* PDF */}
                  {fileType === 'pdf' && (
                    <iframe
                      src={contentUrl}
                      className="fpm-pdf-iframe"
                      title={fileName}
                    />
                  )}

                  {/* Audio */}
                  {fileType === 'audio' && (
                    // eslint-disable-next-line jsx-a11y/media-has-caption
                    <audio
                      src={contentUrl}
                      controls
                      className="fpm-audio"
                    />
                  )}

                  {/* Excel / CSV */}
                  {fileType === 'excel' && (
                    excel?.error ? (
                      <p className="fpm-excel-error">{excel.error}</p>
                    ) : excel ? (
                      <>
                        {excel.sheetNames.length > 1 && (
                          <div className="fpm-sheet-tabs">
                            {excel.sheetNames.map((name) => (
                              <button
                                key={name}
                                type="button"
                                className={cn('fpm-sheet-tab', excelSheet === name && 'fpm-sheet-tab--active')}
                                onClick={() => setExcelSheet(name)}
                              >
                                {name}
                              </button>
                            ))}
                          </div>
                        )}
                        <div
                          className="fpm-excel-wrap"
                          // eslint-disable-next-line react/no-danger
                          dangerouslySetInnerHTML={{ __html: excel.html || '<p class="fpm-no-content-text">No content</p>' }}
                        />
                      </>
                    ) : (
                      <div className="fpm-loading"><Loader2 className="h-5 w-5 animate-spin" /></div>
                    )
                  )}

                  {/* Code */}
                  {fileType === 'code' && extractedText && (
                    <div className="fpm-code-wrap">
                      <pre>
                        <code
                          className={`hljs language-${getCodeLanguage(fileName)}`}
                          // eslint-disable-next-line react/no-danger
                          dangerouslySetInnerHTML={{
                            __html: highlightCode(extractedText, getCodeLanguage(fileName)),
                          }}
                        />
                      </pre>
                    </div>
                  )}

                  {/* Markdown rendered */}
                  {fileType === 'markdown' && extractedText && (
                    <div
                      className="fpm-markdown msg-markdown"
                      // eslint-disable-next-line react/no-danger
                      dangerouslySetInnerHTML={{ __html: renderMarkdown(extractedText) }}
                    />
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}

export default FilePreviewModal;
