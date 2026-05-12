'use client';

import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useTheme } from 'next-themes';
import {
  Copy,
  Check,
  Pencil,
  RefreshCw,
  Trash2,
  Volume2,
  VolumeX,
  ThumbsUp,
  ThumbsDown,
  Info,
  ChevronRight,
  FileIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/Avatar';
import { StreamingResponse } from './StreamingResponse';
import { FilePreviewModal } from './FilePreviewModal';
import { WEBUI_API_BASE } from '@/lib/api/client';
import { useAuthStore } from '@/store/authStore';
import type { ChatMessage, PipelineStep } from '@/types/chat';
import type { Model } from '@/types/models';

// ── URL helpers ───────────────────────────────────────────────────────────────

/**
 * A UUID from the backend RAG pipeline is stored verbatim in source.url.
 * It is NOT a navigable URL — window.open("uuid") resolves it as a relative
 * path, hitting Next.js middleware which clears the session and redirects to /login.
 *
 * This function converts:
 *   - Proper absolute URLs (http/https)  → returned as-is
 *   - Internal absolute paths (/api/...) → returned as-is
 *   - Raw UUID / file-ID strings         → /api/v1/files/{id}/content  (file download)
 *   - Empty / undefined                  → undefined (renders as plain text)
 */
function resolveSourceUrl(raw: string | undefined): string | undefined {
  if (!raw) return undefined;
  if (raw.startsWith('http://') || raw.startsWith('https://')) return raw;
  if (raw.startsWith('/')) return raw;
  // UUID pattern: hex groups separated by dashes (8-4-4-4-12)
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(raw);
  if (isUuid) return `${WEBUI_API_BASE}/files/${raw}/content`;
  // Short alphanumeric IDs (no slashes, no dots) — also treat as file IDs
  if (/^[a-z0-9_-]{8,}$/i.test(raw) && !raw.includes('.')) {
    return `${WEBUI_API_BASE}/files/${raw}/content`;
  }
  // Unknown format — don't linkify to avoid triggering router navigation
  return undefined;
}

// ── Action tooltip (portal, matches info panel style) ────────────────────────

function ActionTooltip({ label, children }: { label: string; children: React.ReactNode }) {
  const [visible, setVisible] = useState(false);
  const [pos, setPos]         = useState({ top: 0, left: 0 });
  const wrapRef               = useRef<HTMLSpanElement>(null);

  const show = useCallback(() => {
    if (!wrapRef.current) return;
    const r = wrapRef.current.getBoundingClientRect();
    setPos({
      top:  r.bottom + 6,
      left: Math.min(r.left + r.width / 2, window.innerWidth - 100),
    });
    setVisible(true);
  }, []);

  const hide = useCallback(() => setVisible(false), []);

  return (
    <span ref={wrapRef} className="msg-tooltip-wrap" onMouseEnter={show} onMouseLeave={hide}>
      {children}
      {visible && typeof document !== 'undefined' &&
        createPortal(
          <div className="msg-action-tooltip" style={{ top: pos.top, left: pos.left }}>
            {label}
          </div>,
          document.body,
        )
      }
    </span>
  );
}

// ── Info row helper ───────────────────────────────────────────────────────────

function MessageInfoRow({ label, value }: { label: string; value: unknown }) {
  if (value === null || value === undefined) return null;

  if (typeof value === 'object' && !Array.isArray(value)) {
    return (
      <>
        <div className="msg-info-row">
          <span className="msg-info-key">{label}</span>
          <span className="msg-info-val msg-info-val--obj">{'{'}</span>
        </div>
        {Object.entries(value as Record<string, unknown>).map(([k, v]) => (
          <div key={k} className="msg-info-row msg-info-row--nested">
            <span className="msg-info-key">{k}</span>
            <span className="msg-info-val">{String(v)}</span>
          </div>
        ))}
        <div className="msg-info-row">
          <span className="msg-info-val msg-info-val--obj">{'}'}</span>
        </div>
      </>
    );
  }

  return (
    <div className="msg-info-row">
      <span className="msg-info-key">{label}</span>
      <span className="msg-info-val">{String(value)}</span>
    </div>
  );
}

// ── Citations ─────────────────────────────────────────────────────────────────

function Citations({ sources }: { sources: unknown[] }) {
  const [open, setOpen] = useState(false);
  //TODO (TANMAY): print Debug
  //console.log('[CITATIONS DEBUG]', JSON.stringify(sources, null, 2));
  const items = useMemo(() => {
    const seen = new Set<string>();
    const result: Array<{ id: string; name: string; url?: string }> = [];
    for (const src of sources) {
      const s = src as {
        source?: { name?: string; url?: string; id?: string };
        document?: string[];
        metadata?: Array<{ source?: string; name?: string }>;
      };
      if (!s?.document?.length) continue;
      s.document.forEach((_, i) => {
        const meta = s.metadata?.[i];
        const rawId = meta?.source ?? s.source?.id ?? `src-${result.length}`;
        const id = String(rawId);
        if (seen.has(id)) return;
        seen.add(id);
        let name: string = meta?.name ?? s.source?.name ?? id;
        // If the metadata source ID itself is an absolute URL, use it as the link
        // (e.g. web-search results where meta.source = "https://...")
        const idIsUrl = id.startsWith('http://') || id.startsWith('https://');
        if (idIsUrl) name = id;
        // resolveSourceUrl validates raw values — UUIDs become /api/v1/files/{id}/content
        // so clicking them downloads the file instead of triggering router navigation
        const rawUrl = idIsUrl ? id : s.source?.url;
        const url = resolveSourceUrl(rawUrl);
        result.push({ id, name, url });
      });
    }
    return result;
  }, [sources]);

  if (items.length === 0) return null;

  return (
    <div className="msg-citations">
      <button
        type="button"
        className="msg-citations-toggle"
        onClick={() => setOpen((v) => !v)}
      >
        {items.length} {items.length === 1 ? 'Source' : 'Sources'}
        <span className={cn('msg-citations-chevron', open && 'msg-citations-chevron--open')}>›</span>
      </button>
      {open && (
        <div className="msg-citations-list">
          {items.map((item) => (
            <div key={item.id} className="msg-citations-item">
              {item.url ? (
                // Use window.open instead of <a href> to bypass Next.js router
                // interception, which can trigger clearSession() on same-origin
                // API paths that return 401 without a bearer token.
                <button
                  type="button"
                  className="msg-citations-link"
                  onClick={() => window.open(item.url, '_blank', 'noopener,noreferrer')}
                >
                  {item.name}
                </button>
              ) : (
                <span className="msg-citations-name">{item.name}</span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────

interface MessageBubbleProps {
  message: ChatMessage;
  model?: Model;
  isStreaming?: boolean;
  streamContent?: string;
  steps?: PipelineStep[];
  sources?: unknown[];
  onEdit?: (newContent: string) => void;
  onRegenerate?: () => void;
  onDelete?: () => void;
  onContinue?: () => void;
  followUpQuestions?: string[];
  onFollowUpClick?: (q: string) => void;
}

export function MessageBubble({
  message,
  model,
  isStreaming = false,
  streamContent,
  steps,
  sources,
  onEdit,
  onRegenerate,
  onDelete,
  onContinue,
  followUpQuestions,
  onFollowUpClick,
}: MessageBubbleProps) {
  const isUser = message.role === 'user';
  const authUser = useAuthStore((s) => s.user);
  const { resolvedTheme } = useTheme();
  const [aiAvatarErrored, setAiAvatarErrored] = useState(false);

  const isLight = resolvedTheme === 'bodhion-light';
  const bodhionIcon = isLight
    ? '/static/bodhion_favicon_light.svg'
    : '/static/bodhion_favicon_dark.svg';
  const aiAvatarSrc = !aiAvatarErrored
    ? (model?.info?.meta?.profile_image_url ?? bodhionIcon)
    : bodhionIcon;
  const displayContent =
    isStreaming && streamContent !== undefined ? streamContent : message.content;

  const [copied, setCopied] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState(message.content);
  const [speaking, setSpeaking] = useState(false);
  const [rating, setRating] = useState<'good' | 'bad' | null>(null);
  const [infoVisible, setInfoVisible] = useState(false);
  const [infoPos, setInfoPos] = useState({ top: 0, left: 0 });
  const [previewFile, setPreviewFile] = useState<{ id: string; name: string; contentType?: string } | null>(null);
  const infoButtonRef = useRef<HTMLSpanElement>(null);
  const editTextareaRef = useRef<HTMLTextAreaElement>(null);

  const handleInfoEnter = useCallback(() => {
    if (!infoButtonRef.current) return;
    const rect = infoButtonRef.current.getBoundingClientRect();
    setInfoPos({
      top: rect.bottom + 6,
      left: Math.min(rect.left, window.innerWidth - 376),
    });
    setInfoVisible(true);
  }, []);

  const handleInfoLeave = useCallback(() => setInfoVisible(false), []);

  // Auto-resize textarea to fit content
  useEffect(() => {
    if (!editing || !editTextareaRef.current) return;
    const el = editTextareaRef.current;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }, [editing, editValue]);

  // ── Copy ──────────────────────────────────────────────────────────────────

  const copy = useCallback(async () => {
    const text = typeof displayContent === 'string' ? displayContent : '';
    await navigator.clipboard.writeText(text).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [displayContent]);

  // ── Read Aloud ────────────────────────────────────────────────────────────

  const toggleReadAloud = useCallback(() => {
    if (typeof window === 'undefined' || !window.speechSynthesis) return;
    if (speaking) {
      window.speechSynthesis.cancel();
      setSpeaking(false);
    } else {
      const text = typeof displayContent === 'string' ? displayContent : '';
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.onend = () => setSpeaking(false);
      utterance.onerror = () => setSpeaking(false);
      window.speechSynthesis.speak(utterance);
      setSpeaking(true);
    }
  }, [speaking, displayContent]);

  // ── Edit ──────────────────────────────────────────────────────────────────

  const handleEditSave = useCallback(() => {
    if (editValue.trim() && onEdit) {
      onEdit(editValue.trim());
    }
    setEditing(false);
  }, [editValue, onEdit]);

  const handleEditCancel = useCallback(() => {
    setEditValue(message.content);
    setEditing(false);
  }, [message.content]);

  // ── Format timestamp ──────────────────────────────────────────────────────

  const formattedTime = message.timestamp
    ? new Date(message.timestamp).toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
      })
    : '';

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className={cn('msg-row group', isUser ? 'msg-row--user' : 'msg-row--ai')}>

      {/* AI avatar */}
      {!isUser && (
        <div className="msg-avatar">
          <Avatar className="h-7 w-7 msg-ai-avatar">
            <AvatarImage
              src={aiAvatarSrc}
              alt={model?.name ?? 'AI'}
              onError={() => setAiAvatarErrored(true)}
            />
            <AvatarFallback className="msg-avatar-fallback">AI</AvatarFallback>
          </Avatar>
        </div>
      )}

      <div className={cn('msg-content', isUser ? 'msg-content--user' : 'msg-content--ai')}>

        {/* Attached files */}
        {!isStreaming && message.files && message.files.length > 0 && (
          <div className="msg-files">
            {message.files.map((f, i) => {
              const isImage =
                f.type === 'image' || f.mimeType?.startsWith('image/');
              // url field holds the raw file ID; build the content URL for display
              const src = f.url?.startsWith('http')
                ? f.url
                : `/api/v1/files/${f.url ?? f.id}/content`;
              return isImage ? (
                <a
                  key={f.id ?? i}
                  href={src}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="msg-file-image-wrap"
                >
                  <img src={src} alt={f.name ?? 'Attachment'} className="msg-file-image" />
                </a>
              ) : (
                <button
                  key={f.id ?? i}
                  type="button"
                  className="msg-file-chip"
                  onClick={() => setPreviewFile({
                    id: f.url ?? f.id ?? '',
                    name: f.name ?? 'Attachment',
                    contentType: f.mimeType,
                  })}
                >
                  <FileIcon className="h-4 w-4 shrink-0" />
                  <span className="msg-file-chip-name">{f.name ?? 'Attachment'}</span>
                </button>
              );
            })}
          </div>
        )}

        {/* Inline edit mode */}
        {editing ? (
          <div className={cn('msg-edit-wrap', isUser ? 'msg-edit-wrap--user' : 'msg-edit-wrap--ai')}>
            <textarea
              ref={editTextareaRef}
              className="msg-edit-input"
              value={editValue}
              onChange={(e) => {
                setEditValue(e.target.value);
              }}
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleEditSave();
                }
                if (e.key === 'Escape') handleEditCancel();
              }}
            />
            <div className="msg-edit-actions">
              <button type="button" className="msg-edit-save-btn" onClick={handleEditSave}>
                Save &amp; Submit
              </button>
              <button type="button" className="msg-edit-cancel-btn" onClick={handleEditCancel}>
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <div className={cn('msg-bubble', isUser ? 'msg-bubble--user' : 'msg-bubble--ai')}>
            {/* All messages rendered via StreamingResponse for consistent markdown */}
            <StreamingResponse
              content={displayContent as string}
              isStreaming={isStreaming}
              steps={steps}
            />
          </div>
        )}

        {/* Sources/Citations — AI messages only */}
        {!isUser && !editing && sources && sources.length > 0 && (
          <Citations sources={sources} />
        )}

        {/* Inline timestamp — fades in on row hover */}
        {!isStreaming && formattedTime && (
          <div className={cn('msg-timestamp', isUser ? 'msg-timestamp--user' : 'msg-timestamp--ai')}>
            {formattedTime}
          </div>
        )}

        {/* ── Action row ────────────────────────────────────────────────────── */}
        {!isStreaming && !editing && (
          <div className={cn(
            'msg-actions',
            isUser ? 'msg-actions--user' : 'msg-actions--ai',
          )}>

            {/* Edit */}
            {onEdit && (
              <ActionTooltip label={isUser ? 'Edit message' : 'Edit response'}>
                <button
                  type="button"
                  className="msg-action-btn"
                  onClick={() => { setEditValue(message.content); setEditing(true); }}
                >
                  <Pencil className="h-3.5 w-3.5" />
                </button>
              </ActionTooltip>
            )}

            {/* Copy */}
            <ActionTooltip label={copied ? 'Copied!' : 'Copy'}>
              <button
                type="button"
                className="msg-action-btn"
                onClick={() => void copy()}
              >
                {copied
                  ? <Check className="h-3.5 w-3.5 msg-action-check" />
                  : <Copy className="h-3.5 w-3.5" />}
              </button>
            </ActionTooltip>

            {/* Read Aloud — AI only */}
            {!isUser && (
              <ActionTooltip label={speaking ? 'Stop reading' : 'Read aloud'}>
                <button
                  type="button"
                  className={cn('msg-action-btn', speaking && 'msg-action-btn--active')}
                  onClick={toggleReadAloud}
                >
                  {speaking
                    ? <VolumeX className="h-3.5 w-3.5" />
                    : <Volume2 className="h-3.5 w-3.5" />}
                </button>
              </ActionTooltip>
            )}

            {/* Info — rich portal tooltip */}
            <span
              ref={infoButtonRef}
              className="msg-tooltip-wrap"
              onMouseEnter={handleInfoEnter}
              onMouseLeave={handleInfoLeave}
            >
              <button type="button" className="msg-action-btn">
                <Info className="h-3.5 w-3.5" />
              </button>
              {infoVisible && !isStreaming && typeof document !== 'undefined' &&
                createPortal(
                  <div className="msg-info-panel" style={{ top: infoPos.top, left: infoPos.left }}>
                    {formattedTime && (
                      <div className="msg-info-row">
                        <span className="msg-info-key">time</span>
                        <span className="msg-info-val">
                          {formattedTime}{message.role === 'assistant' ? ' · AI' : ' · You'}
                        </span>
                      </div>
                    )}
                    {message.usage && Object.entries(message.usage).map(([key, val]) => (
                      <MessageInfoRow key={key} label={key} value={val} />
                    ))}
                  </div>,
                  document.body,
                )
              }
            </span>

            {/* Good response — AI only */}
            {!isUser && (
              <ActionTooltip label="Good response">
                <button
                  type="button"
                  className={cn('msg-action-btn', rating === 'good' && 'msg-action-btn--good')}
                  onClick={() => setRating((r) => r === 'good' ? null : 'good')}
                >
                  <ThumbsUp className="h-3.5 w-3.5" />
                </button>
              </ActionTooltip>
            )}

            {/* Bad response — AI only */}
            {!isUser && (
              <ActionTooltip label="Bad response">
                <button
                  type="button"
                  className={cn('msg-action-btn', rating === 'bad' && 'msg-action-btn--bad')}
                  onClick={() => setRating((r) => r === 'bad' ? null : 'bad')}
                >
                  <ThumbsDown className="h-3.5 w-3.5" />
                </button>
              </ActionTooltip>
            )}

            {/* Continue — AI only */}
            {!isUser && onContinue && (
              <ActionTooltip label="Continue response">
                <button
                  type="button"
                  className="msg-action-btn"
                  onClick={onContinue}
                >
                  <ChevronRight className="h-3.5 w-3.5" />
                </button>
              </ActionTooltip>
            )}

            {/* Regenerate — AI only */}
            {!isUser && onRegenerate && (
              <ActionTooltip label="Regenerate">
                <button
                  type="button"
                  className="msg-action-btn"
                  onClick={onRegenerate}
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                </button>
              </ActionTooltip>
            )}

            {/* Delete */}
            {onDelete && (
              <ActionTooltip label="Delete">
                <button
                  type="button"
                  className="msg-action-btn msg-action-btn--danger"
                  onClick={onDelete}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </ActionTooltip>
            )}
          </div>
        )}

        {/* ── Follow-up questions (last AI message only) ────────────────────── */}
        {!isUser && !isStreaming && followUpQuestions && followUpQuestions.length > 0 && (
          <div className="msg-followup">
            <span className="msg-followup-label">Follow up</span>
            <div className="msg-followup-chips">
              {followUpQuestions.map((q) => (
                <button
                  key={q}
                  type="button"
                  className="msg-followup-chip"
                  onClick={() => onFollowUpClick?.(q)}
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* User avatar */}
      {isUser && (
        <div className="msg-avatar">
          <Avatar className="h-7 w-7 msg-user-avatar">
            <AvatarImage
              src={authUser?.profile_image_url ?? undefined}
              alt={authUser?.name ?? 'You'}
            />
            <AvatarFallback className="msg-avatar-fallback">
              {authUser?.name ? authUser.name.charAt(0).toUpperCase() : 'U'}
            </AvatarFallback>
          </Avatar>
        </div>
      )}

      {/* File preview modal — portal, rendered outside the message row */}
      {previewFile && previewFile.id && (
        <FilePreviewModal
          fileId={previewFile.id}
          fileName={previewFile.name}
          contentType={previewFile.contentType}
          onClose={() => setPreviewFile(null)}
        />
      )}
    </div>
  );
}

export default MessageBubble;
