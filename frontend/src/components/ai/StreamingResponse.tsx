'use client';

import { useMemo, useCallback } from 'react';
import { cn } from '@/lib/utils/cn';
import { marked } from 'marked';
import hljs from 'highlight.js';
import DOMPurify from 'dompurify';
import katex from 'katex';
import 'katex/dist/katex.min.css';
import { ChartFromTable } from './ChartFromTable';
import { ThinkingPanel } from './ThinkingPanel';
import { splitIntoSegments, hasMarkdownTable } from '@/lib/utils/tableParser';
import type { PipelineStep } from '@/types/chat';

// Configure marked once
marked.use({ gfm: true, breaks: true });

// ── LaTeX rendering ───────────────────────────────────────────────────────────
// Extracts LaTeX expressions before markdown parsing to prevent marked from
// corrupting them. Returns modified text + a lookup table of rendered HTML.

function extractAndRenderLatex(text: string): { text: string; blocks: string[] } {
  const blocks: string[] = [];

  // Protect code fences first so we never touch LaTeX inside code blocks
  const codeFences: string[] = [];
  let safe = text
    .replace(/```[\s\S]*?```/g, (m) => { codeFences.push(m); return `\x00FENCE${codeFences.length - 1}\x00`; })
    .replace(/`[^`\n]+`/g,    (m) => { codeFences.push(m); return `\x00FENCE${codeFences.length - 1}\x00`; });

  // Block LaTeX: $$...$$
  safe = safe.replace(/\$\$([\s\S]+?)\$\$/g, (_, expr: string) => {
    try {
      blocks.push(katex.renderToString(expr.trim(), { displayMode: true, throwOnError: false }));
    } catch {
      blocks.push(`<span class="msg-latex-err">$$${expr}$$</span>`);
    }
    return `\x00LATEX${blocks.length - 1}\x00`;
  });

  // Inline LaTeX: $...$ (no leading/trailing spaces, single line)
  safe = safe.replace(/(?<!\$)\$(?!\s)([^$\n]+?)(?<!\s)\$(?!\$)/g, (_, expr: string) => {
    try {
      blocks.push(katex.renderToString(expr.trim(), { displayMode: false, throwOnError: false }));
    } catch {
      blocks.push(`<span class="msg-latex-err">$${expr}$</span>`);
    }
    return `\x00LATEX${blocks.length - 1}\x00`;
  });

  // Restore code fences
  safe = safe.replace(/\x00FENCE(\d+)\x00/g, (_, i) => codeFences[+i] ?? '');

  return { text: safe, blocks };
}

function restoreLatex(html: string, blocks: string[]): string {
  return html.replace(/\x00LATEX(\d+)\x00/g, (_, i) => blocks[+i] ?? '');
}

// ── Code block enhancement ────────────────────────────────────────────────────

function enhanceCodeBlocks(html: string): string {
  // Language-tagged fences
  html = html.replace(
    /<pre><code class="language-([a-zA-Z0-9_+\-:.]+)">([\s\S]*?)<\/code><\/pre>/g,
    (_, lang: string, encoded: string) => {
      const raw = decodeHtmlEntities(encoded);
      const highlighted = tryHighlight(raw, lang);
      return codeBlockHtml(lang, highlighted);
    },
  );
  // Untagged fences
  html = html.replace(
    /<pre><code(?!\s*class)(?: class="")?>([\s\S]*?)<\/code><\/pre>/g,
    (_, code: string) => codeBlockHtml('', code),
  );
  return html;
}

function decodeHtmlEntities(s: string): string {
  return s
    .replace(/&amp;/g,  '&')
    .replace(/&lt;/g,   '<')
    .replace(/&gt;/g,   '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g,  "'");
}

function tryHighlight(raw: string, lang: string): string {
  try {
    return hljs.highlight(raw, { language: lang, ignoreIllegals: true }).value;
  } catch {
    try { return hljs.highlightAuto(raw).value; } catch { return raw; }
  }
}

function codeBlockHtml(lang: string, code: string): string {
  const langClass = lang ? `language-${lang}` : '';
  const langLabel = lang || 'code';
  return `<div class="msg-code-block">
    <div class="msg-code-header">
      <span class="msg-code-lang">${langLabel}</span>
      <button class="msg-code-copy" type="button">
        <span class="msg-code-copy-text">Copy</span>
      </button>
    </div>
    <pre><code class="hljs ${langClass}">${code}</code></pre>
  </div>`;
}

function openLinksInNewTab(html: string): string {
  return html.replace(
    /<a\s+href="((?!#)[^"]*)"/g,
    '<a target="_blank" rel="noopener noreferrer" href="$1"',
  );
}

// ── Full pipeline ─────────────────────────────────────────────────────────────

function buildHtml(text: string): string {
  if (!text) return '';
  try {
    const { text: safeText, blocks } = extractAndRenderLatex(text);
    let html = marked.parse(safeText, { async: false }) as string;
    html = restoreLatex(html, blocks);
    html = enhanceCodeBlocks(html);
    html = openLinksInNewTab(html);
    return DOMPurify.sanitize(html, {
      ADD_ATTR: ['target', 'rel'],
      // Allow hljs / katex class names and the button type attr (both in default allowlist)
    });
  } catch {
    return DOMPurify.sanitize(text);
  }
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface StreamingResponseProps {
  content: string;
  isStreaming: boolean;
  steps?: PipelineStep[];
  error?: string | null;
  className?: string;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function StreamingResponse({ content, isStreaming, steps = [], error, className }: StreamingResponseProps) {
  // Single memo computes all three rendering paths to avoid redundant buildHtml calls.
  //
  //  streamingHtml — used while isStreaming=true (partial content, single-pass)
  //  staticHtml    — used when done + no tables (existing behaviour, unchanged)
  //  segments      — used when done + has tables (segmented render with ChartFromTable)
  const { streamingHtml, staticHtml, segments } = useMemo(() => {
    if (isStreaming) {
      return { streamingHtml: buildHtml(content), staticHtml: '', segments: null };
    }
    if (!content) {
      return { streamingHtml: '', staticHtml: '', segments: null };
    }
    if (hasMarkdownTable(content)) {
      return { streamingHtml: '', staticHtml: '', segments: splitIntoSegments(content) };
    }
    return { streamingHtml: '', staticHtml: buildHtml(content), segments: null };
  }, [content, isStreaming]);

  // Event delegation: copy button inside rendered HTML (works for all text segments)
  const handleClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const btn = (e.target as HTMLElement).closest('.msg-code-copy');
    if (!btn) return;
    const block = btn.closest('.msg-code-block');
    if (!block) return;
    const codeEl = block.querySelector('pre code');
    if (!codeEl) return;
    void navigator.clipboard.writeText(codeEl.textContent ?? '').then(() => {
      const label = btn.querySelector('.msg-code-copy-text');
      if (!label) return;
      label.textContent = 'Copied!';
      setTimeout(() => { label.textContent = 'Copy'; }, 2000);
    });
  }, []);

  if (error) {
    return (
      <div className={cn('msg-error-block', className)}>
        <span className="msg-error-icon" aria-hidden="true">⚠</span>
        <span>{error}</span>
      </div>
    );
  }

  return (
    <div className={cn('relative', className)} onClick={handleClick}>

      {/* Pipeline step panel — replaces the old 3-dot loader */}
      <ThinkingPanel steps={steps} isStreaming={isStreaming} />

      {/* ── Streaming: single-pass HTML (safe for partial content) ── */}
      {isStreaming && content && (
        <div
          className="msg-markdown"
          // eslint-disable-next-line react/no-danger
          dangerouslySetInnerHTML={{ __html: streamingHtml }}
        />
      )}

      {/* ── Done + has tables: segment render with ChartFromTable ── */}
      {!isStreaming && content && segments && (
        <div className="msg-markdown">
          {segments.map((seg, i) =>
            seg.type === 'table' ? (
              <ChartFromTable key={i} raw={seg.content} />
            ) : (
              <div
                key={i}
                // eslint-disable-next-line react/no-danger
                dangerouslySetInnerHTML={{ __html: buildHtml(seg.content) }}
              />
            ),
          )}
        </div>
      )}

      {/* ── Done + no tables: single-pass HTML (existing behaviour) ── */}
      {!isStreaming && content && !segments && (
        <div
          className="msg-markdown"
          // eslint-disable-next-line react/no-danger
          dangerouslySetInnerHTML={{ __html: staticHtml }}
        />
      )}

      {/* ── Empty AI response after stream ends ── */}
      {!isStreaming && !content && null}

      {/* Blinking cursor at end of streamed content */}
      {isStreaming && content && (
        <span className="msg-stream-cursor" aria-hidden="true" />
      )}
    </div>
  );
}

export default StreamingResponse;
