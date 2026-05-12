'use client';

import {
  useRef, useState, useEffect, useCallback,
  KeyboardEvent, ChangeEvent, FormEvent,
} from 'react';
import {
  Send, Square, Plus, Globe, Zap, Mic, Activity,
  Camera, Link, BookOpen, Brain, MessageSquare, FileUp,
  X, ArrowLeft, Search, ChevronRight,
} from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import { getToken } from '@/lib/auth/session';
import { getNotes } from '@/lib/api/notes';
import { searchKnowledgeBases, searchKnowledgeFilesById, type KnowledgeFileItem } from '@/lib/api/workspace';
import { getChatList } from '@/lib/api/chats';
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from '@/components/ui/Tooltip';

// ── Global speech recognition type ────────────────────────────────────────────
declare global {
  interface SpeechRecognitionAlternative {
    readonly transcript: string;
    readonly confidence: number;
  }
  interface SpeechRecognitionResult {
    readonly length: number;
    readonly isFinal: boolean;
    item(index: number): SpeechRecognitionAlternative;
    [index: number]: SpeechRecognitionAlternative;
  }
  interface SpeechRecognitionResultList {
    readonly length: number;
    item(index: number): SpeechRecognitionResult;
    [index: number]: SpeechRecognitionResult;
  }
  interface SpeechRecognitionEvent extends Event {
    readonly results: SpeechRecognitionResultList;
  }
  interface SpeechRecognition extends EventTarget {
    continuous: boolean;
    interimResults: boolean;
    lang: string;
    onresult: ((event: SpeechRecognitionEvent) => void) | null;
    onerror: ((event: Event) => void) | null;
    onend: (() => void) | null;
    start(): void;
    stop(): void;
  }
  interface Window {
    SpeechRecognition?: new () => SpeechRecognition;
    webkitSpeechRecognition?: new () => SpeechRecognition;
  }
  interface ImageCapture {
    grabFrame(): Promise<ImageBitmap>;
  }
}

// ── Types ──────────────────────────────────────────────────────────────────────

export interface AttachableItem {
  id: string;
  name: string;
  type: 'file' | 'note' | 'collection' | 'knowledge_file' | 'chat';
  description?: string;
  url?: string;
  collection_name?: string;
}

export interface PromptInputProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  onStop?: () => void;
  isStreaming?: boolean;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  // Toolbar integrations
  webSearch?: boolean;
  onWebSearchToggle?: () => void;
  onFileAttach?: (file: File) => void;
  onItemAttach?: (item: AttachableItem) => void; // for notes / knowledge / chats
  uploadingFile?: boolean;
  activeChatId?: string | null; // to exclude from reference chats
}

// ── Sub-panel item component ───────────────────────────────────────────────────

interface PanelItemProps {
  id: string;
  name: string;
  description?: string;
  descAsTooltip?: boolean;
  hasChildren?: boolean;
  attached?: boolean;
  onClick: () => void;
}

function PanelItem({ name, description, descAsTooltip, hasChildren, attached, onClick }: PanelItemProps) {
  return (
    <button
      type="button"
      className={cn('pi-panel-item', attached && 'pi-panel-item--attached')}
      title={descAsTooltip ? description : undefined}
      onClick={onClick}
    >
      <div className="pi-panel-item-info">
        <span className="pi-panel-item-name">{name}</span>
        {description && !descAsTooltip && <span className="pi-panel-item-desc">{description}</span>}
      </div>
      {hasChildren && <ChevronRight className="h-3.5 w-3.5 pi-panel-item-arrow" />}
      {attached && <span className="pi-panel-item-badge">Attached</span>}
    </button>
  );
}

// ── Notes panel ───────────────────────────────────────────────────────────────

function NotesPanel({ onSelect }: { onSelect: (item: AttachableItem) => void }) {
  const [items, setItems] = useState<AttachableItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    const token = getToken();
    if (!token) { setLoading(false); return; }
    getNotes(token)
      .then((notes) => {
        setItems(
          notes.map((n) => ({
            id: n.id,
            name: n.title ?? 'Untitled note',
            type: 'note' as const,
            description: n.updated_at
              ? new Date(n.updated_at / 1_000_000).toLocaleDateString()
              : undefined,
          }))
        );
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const filtered = items.filter(
    (i) => !search || i.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="pi-panel-body">
      <div className="pi-panel-search-wrap">
        <Search className="h-3 w-3 pi-panel-search-icon" />
        <input
          type="text"
          className="pi-panel-search"
          placeholder="Search notes…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          autoFocus
        />
      </div>
      {loading ? (
        <div className="pi-panel-loading">Loading…</div>
      ) : filtered.length === 0 ? (
        <div className="pi-panel-empty">No notes found</div>
      ) : (
        filtered.map((item) => (
          <PanelItem key={item.id} {...item} onClick={() => onSelect(item)} />
        ))
      )}
    </div>
  );
}

// ── Knowledge panel ────────────────────────────────────────────────────────────

function KnowledgePanel({ onSelect }: { onSelect: (item: AttachableItem) => void }) {
  type Collection = { id: string; name: string; description?: string };

  const [collections, setCollections] = useState<Collection[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [files, setFiles] = useState<Record<string, KnowledgeFileItem[]>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [loadingFiles, setLoadingFiles] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  useEffect(() => {
    const token = getToken();
    if (!token) { setLoading(false); return; }
    searchKnowledgeBases(token, {})
      .then((res) => {
        const cols = res?.items ?? [];
        setCollections(cols.map((c) => ({ id: c.id, name: c.name, description: c.description })));
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, []);

  const toggleCollection = useCallback(async (colId: string) => {
    if (expandedId === colId) { setExpandedId(null); return; }
    setExpandedId(colId);
    if (files[colId] !== undefined) return; // already loaded
    const token = getToken();
    if (!token) return;
    setLoadingFiles(colId);
    try {
      const res = await searchKnowledgeFilesById(token, colId, { page: 1 });
      setFiles((prev) => ({ ...prev, [colId]: res?.items ?? [] }));
    } catch {
      setFiles((prev) => ({ ...prev, [colId]: [] }));
    } finally {
      setLoadingFiles(null);
    }
  }, [expandedId, files]);

  const filteredCols = collections.filter(
    (c) => !search || c.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="pi-panel-body">
      <div className="pi-panel-search-wrap">
        <Search className="h-3 w-3 pi-panel-search-icon" />
        <input
          type="text"
          className="pi-panel-search"
          placeholder="Search knowledge…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          autoFocus
        />
      </div>

      {loading ? (
        <div className="pi-panel-loading">Loading…</div>
      ) : error ? (
        <div className="pi-panel-empty">Failed to load knowledge bases</div>
      ) : filteredCols.length === 0 ? (
        <div className="pi-panel-empty">No knowledge bases found</div>
      ) : (
        <TooltipProvider delayDuration={400}>
        {filteredCols.map((col) => (
          <div key={col.id}>
            {/* Collection row */}
            <div className="pi-kd-row">
              {/* Name with Radix tooltip for description */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    className="pi-kd-col-btn"
                    onClick={() =>
                      onSelect({ id: col.id, name: col.name, type: 'collection', description: col.description })
                    }
                  >
                    <span className="pi-kd-col-name">{col.name}</span>
                  </button>
                </TooltipTrigger>
                {col.description && (
                  <TooltipContent side="right" align="start" className="pi-kd-radix-tooltip">
                    {col.description}
                  </TooltipContent>
                )}
              </Tooltip>

              {/* Expand/collapse chevron */}
              <button
                type="button"
                className="pi-kd-expand-btn"
                onClick={() => void toggleCollection(col.id)}
                title={expandedId === col.id ? 'Hide files' : 'Show files'}
              >
                <ChevronRight
                  className={cn('h-3 w-3 pi-kd-chevron', expandedId === col.id && 'pi-kd-chevron--open')}
                />
              </button>
            </div>

            {/* Files list */}
            {expandedId === col.id && (
              <div className="pi-kd-files">
                {loadingFiles === col.id ? (
                  <div className="pi-panel-loading">Loading files…</div>
                ) : (files[col.id] ?? []).length === 0 ? (
                  <div className="pi-panel-empty">No files in this collection</div>
                ) : (
                  (files[col.id] ?? []).map((f) => {
                    const fileName = f.meta?.name || f.filename || f.id;
                    return (
                      <button
                        key={f.id}
                        type="button"
                        className="pi-kd-file-btn"
                        onClick={() =>
                          onSelect({
                            id: f.id,
                            name: String(fileName),
                            type: 'knowledge_file',
                            collection_name: col.name,
                          })
                        }
                      >
                        <span className="pi-kd-file-dot" />
                        <span className="pi-kd-file-name">{String(fileName)}</span>
                      </button>
                    );
                  })
                )}
              </div>
            )}
          </div>
        ))}
        </TooltipProvider>
      )}
    </div>
  );
}

// ── Reference Chats panel ─────────────────────────────────────────────────────

function ChatsPanel({
  activeChatId,
  onSelect,
}: {
  activeChatId?: string | null;
  onSelect: (item: AttachableItem) => void;
}) {
  const [items, setItems] = useState<AttachableItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    const token = getToken();
    if (!token) { setLoading(false); return; }
    getChatList(token, 1)
      .then((chats) => {
        setItems(
          chats
            .filter((c) => c.id !== activeChatId)
            .map((c) => ({
              id: c.id,
              name: c.title ?? 'Untitled chat',
              type: 'chat' as const,
              description: c.updated_at
                ? new Date(c.updated_at * 1000).toLocaleDateString()
                : undefined,
            }))
        );
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [activeChatId]);

  const filtered = items.filter(
    (i) => !search || i.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="pi-panel-body">
      <div className="pi-panel-search-wrap">
        <Search className="h-3 w-3 pi-panel-search-icon" />
        <input
          type="text"
          className="pi-panel-search"
          placeholder="Search chats…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          autoFocus
        />
      </div>
      {loading ? (
        <div className="pi-panel-loading">Loading…</div>
      ) : filtered.length === 0 ? (
        <div className="pi-panel-empty">No chats found</div>
      ) : (
        filtered.map((item) => (
          <PanelItem key={item.id} {...item} onClick={() => onSelect(item)} />
        ))
      )}
    </div>
  );
}

// ── Plus menu items ────────────────────────────────────────────────────────────

const PLUS_MAIN_ITEMS = [
  { id: 'upload',    icon: FileUp,        label: 'Upload Files' },
  { id: 'capture',   icon: Camera,        label: 'Capture Screen' },
  { id: 'webpage',   icon: Link,          label: 'Attach Webpage' },
  { id: 'notes',     icon: BookOpen,      label: 'Attach Notes' },
  { id: 'knowledge', icon: Brain,         label: 'Attach Knowledge' },
  { id: 'chats',     icon: MessageSquare, label: 'Reference Chats' },
] as const;

type PlusTab = '' | 'notes' | 'knowledge' | 'chats';

// ── Main component ─────────────────────────────────────────────────────────────

export function PromptInput({
  value,
  onChange,
  onSubmit,
  onStop,
  isStreaming = false,
  placeholder = 'Ask anything…',
  disabled = false,
  className,
  webSearch = false,
  onWebSearchToggle,
  onFileAttach,
  onItemAttach,
  uploadingFile: _uploadingFile = false,
  activeChatId,
}: PromptInputProps) {
  const textareaRef   = useRef<HTMLTextAreaElement>(null);
  const fileInputRef  = useRef<HTMLInputElement>(null);
  const plusMenuRef   = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<SpeechRecognition | null>(null);

  const [plusOpen, setPlusOpen]     = useState(false);
  const [plusTab, setPlusTab]       = useState<PlusTab>('');
  const [isListening, setIsListening] = useState(false);
  const [voiceMode, setVoiceMode]   = useState(false);
  const [urlInputVisible, setUrlInputVisible] = useState(false);
  const [urlValue, setUrlValue]     = useState('');

  // Close + menu on outside click
  useEffect(() => {
    if (!plusOpen) return;
    const handler = (e: MouseEvent) => {
      if (plusMenuRef.current && !plusMenuRef.current.contains(e.target as Node)) {
        setPlusOpen(false);
        setPlusTab('');
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [plusOpen]);

  // Auto-resize
  function autoResize(el: HTMLTextAreaElement) {
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
  }

  function handleChange(e: ChangeEvent<HTMLTextAreaElement>) {
    onChange(e.target.value);
    autoResize(e.target);
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (!disabled && !isStreaming && value.trim()) onSubmit();
    }
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (isStreaming) { onStop?.(); } else if (value.trim()) { onSubmit(); }
  }

  // ── Voice input ────────────────────────────────────────────────────────────
  function toggleVoice() {
    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
      return;
    }
    const SR = window.SpeechRecognition ?? window.webkitSpeechRecognition;
    if (!SR) { alert('Speech recognition is not supported in this browser.'); return; }
    const rec = new SR();
    rec.continuous = false;
    rec.interimResults = true;
    rec.onresult = (event: SpeechRecognitionEvent) => {
      const transcript = Array.from(event.results).map((r) => r[0].transcript).join('');
      onChange(transcript);
      if (textareaRef.current) autoResize(textareaRef.current);
    };
    rec.onend = () => setIsListening(false);
    rec.onerror = () => setIsListening(false);
    rec.start();
    recognitionRef.current = rec;
    setIsListening(true);
  }

  // ── Screen capture ─────────────────────────────────────────────────────────
  async function handleCapture() {
    setPlusOpen(false);
    setPlusTab('');
    if (!onFileAttach) return;
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({ video: true });
      const track = stream.getVideoTracks()[0];
      if (typeof ImageCapture !== 'undefined') {
        const capture = new ImageCapture(track);
        const bitmap = await capture.grabFrame();
        const canvas = document.createElement('canvas');
        canvas.width = bitmap.width;
        canvas.height = bitmap.height;
        canvas.getContext('2d')?.drawImage(bitmap, 0, 0);
        canvas.toBlob((blob) => {
          if (blob) onFileAttach(new File([blob], `capture-${Date.now()}.png`, { type: 'image/png' }));
          track.stop();
        }, 'image/png');
      } else { track.stop(); }
    } catch { /* user cancelled */ }
  }

  // ── Attach webpage ─────────────────────────────────────────────────────────
  function handleWebpageSubmit() {
    const url = urlValue.trim();
    if (!url) return;
    if (onItemAttach) {
      onItemAttach({ id: url, name: url, type: 'file', url });
    } else {
      onChange(value ? `${value}\n${url}` : url);
    }
    setUrlValue('');
    setUrlInputVisible(false);
    setPlusOpen(false);
  }

  // ── Item attach ────────────────────────────────────────────────────────────
  const handleItemSelect = useCallback((item: AttachableItem) => {
    onItemAttach?.(item);
    setPlusOpen(false);
    setPlusTab('');
  }, [onItemAttach]);

  // ── Plus menu item click ───────────────────────────────────────────────────
  function handlePlusItem(id: typeof PLUS_MAIN_ITEMS[number]['id']) {
    switch (id) {
      case 'upload':
        setPlusOpen(false);
        fileInputRef.current?.click();
        break;
      case 'capture':
        void handleCapture();
        break;
      case 'webpage':
        setUrlInputVisible(true);
        setPlusOpen(false);
        break;
      case 'notes':
      case 'knowledge':
      case 'chats':
        setPlusTab(id);
        break;
    }
  }

  const panelTitle =
    plusTab === 'notes'     ? 'Attach Notes'      :
    plusTab === 'knowledge' ? 'Attach Knowledge'   :
    plusTab === 'chats'     ? 'Reference Chats'    : '';

  const [isDragging, setIsDragging] = useState(false);

  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    if (!e.currentTarget.contains(e.relatedTarget as Node)) setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    if (!onFileAttach) return;
    Array.from(e.dataTransfer.files).forEach((f) => onFileAttach(f));
  }, [onFileAttach]);

  const handlePaste = useCallback((e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const fileItem = Array.from(e.clipboardData.items).find((i) => i.kind === 'file');
    if (fileItem && onFileAttach) {
      const f = fileItem.getAsFile();
      if (f) { e.preventDefault(); onFileAttach(f); }
    }
  }, [onFileAttach]);

  return (
    <div
      className={cn('pi-wrap', isDragging && 'pi-wrap--dragging', className)}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >

      {/* URL input row */}
      {urlInputVisible && (
        <div className="pi-url-row">
          <input
            type="url"
            className="pi-url-input"
            placeholder="Paste a URL…"
            value={urlValue}
            onChange={(e) => setUrlValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') { e.preventDefault(); handleWebpageSubmit(); }
              if (e.key === 'Escape') { setUrlInputVisible(false); setUrlValue(''); }
            }}
            autoFocus
          />
          <button type="button" className="pi-url-submit" onClick={handleWebpageSubmit}>Attach</button>
          <button type="button" className="pi-url-cancel" onClick={() => { setUrlInputVisible(false); setUrlValue(''); }}>
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      <form onSubmit={handleSubmit} className="pi-form">
        {/* Textarea */}
        <textarea
          ref={textareaRef}
          value={value}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          placeholder={placeholder}
          disabled={disabled}
          rows={1}
          className="pi-textarea"
          style={{ maxHeight: '200px', overflowY: 'auto' }}
        />

        {/* Bottom action bar */}
        <div className="pi-bar">
          <div className="pi-bar-left">

            {/* + dropdown */}
            <div className="pi-plus-wrap" ref={plusMenuRef}>
              <button
                type="button"
                className={cn('pi-btn pi-btn--plus', plusOpen && 'pi-btn--active')}
                onClick={() => { setPlusOpen((v) => !v); if (plusOpen) setPlusTab(''); }}
                title="Add attachment"
                disabled={disabled}
              >
                <Plus className="h-4 w-4" />
              </button>

              {plusOpen && (
                <div className="pi-plus-menu">
                  {/* Sub-panel header */}
                  {plusTab !== '' && (
                    <div className="pi-panel-header">
                      <button
                        type="button"
                        className="pi-panel-back"
                        onClick={() => setPlusTab('')}
                      >
                        <ArrowLeft className="h-3.5 w-3.5" />
                      </button>
                      <span className="pi-panel-title">{panelTitle}</span>
                    </div>
                  )}

                  {/* Main items */}
                  {plusTab === '' && PLUS_MAIN_ITEMS.map(({ id, icon: Icon, label }) => (
                    <button
                      key={id}
                      type="button"
                      className="pi-plus-item"
                      onClick={() => handlePlusItem(id)}
                    >
                      <Icon className="h-3.5 w-3.5 pi-plus-item-icon" />
                      <span>{label}</span>
                      {(id === 'notes' || id === 'knowledge' || id === 'chats') && (
                        <ChevronRight className="h-3 w-3 pi-plus-item-arrow" />
                      )}
                    </button>
                  ))}

                  {/* Sub-panels */}
                  {plusTab === 'notes' && (
                    <NotesPanel onSelect={handleItemSelect} />
                  )}
                  {plusTab === 'knowledge' && (
                    <KnowledgePanel onSelect={handleItemSelect} />
                  )}
                  {plusTab === 'chats' && (
                    <ChatsPanel activeChatId={activeChatId} onSelect={handleItemSelect} />
                  )}
                </div>
              )}
            </div>

            {/* Web Search */}
            {onWebSearchToggle && (
              <button
                type="button"
                className={cn('pi-btn pi-btn--tool', webSearch && 'pi-btn--active')}
                onClick={onWebSearchToggle}
                title={webSearch ? 'Disable web search' : 'Enable web search'}
                disabled={disabled}
              >
                <Globe className="h-3.5 w-3.5" />
                <span className="pi-btn-label">Search</span>
              </button>
            )}

            {/* Tools */}
            <button
              type="button"
              className="pi-btn pi-btn--tool"
              title="Tools"
              disabled={disabled}
            >
              <Zap className="h-3.5 w-3.5" />
              <span className="pi-btn-label">Tools</span>
            </button>
          </div>

          <div className="pi-bar-right">
            {/* Voice input */}
            <button
              type="button"
              className={cn('pi-btn pi-btn--icon', isListening && 'pi-btn--recording')}
              onClick={toggleVoice}
              title={isListening ? 'Stop listening' : 'Voice input'}
              disabled={disabled}
            >
              <Mic className="h-4 w-4" />
            </button>

            {/* Voice mode */}
            <button
              type="button"
              className={cn('pi-btn pi-btn--icon', voiceMode && 'pi-btn--active')}
              onClick={() => setVoiceMode((v) => !v)}
              title={voiceMode ? 'Exit voice mode' : 'Voice mode'}
              disabled={disabled}
            >
              <Activity className="h-4 w-4" />
            </button>

            {/* Send / Stop */}
            <button
              type="submit"
              className={cn(
                'pi-btn pi-btn--send',
                isStreaming && 'pi-btn--stop',
                !isStreaming && !value.trim() && 'pi-btn--send-disabled',
              )}
              disabled={disabled || (!isStreaming && !value.trim())}
              aria-label={isStreaming ? 'Stop generation' : 'Send message'}
            >
              {isStreaming
                ? <Square className="h-3.5 w-3.5 fill-current" />
                : <Send className="h-3.5 w-3.5" />}
            </button>
          </div>
        </div>
      </form>

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="*/*"
        multiple
        hidden
        onChange={(e) => {
          const files = Array.from(e.target.files ?? []);
          e.target.value = '';
          if (onFileAttach) files.forEach((f) => onFileAttach(f));
        }}
      />
    </div>
  );
}

export default PromptInput;
