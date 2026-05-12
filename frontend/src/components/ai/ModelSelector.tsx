'use client';

import { useState, useRef, useEffect, useCallback, useLayoutEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useTheme } from 'next-themes';
import {
  ChevronDown, Check, Info,
  MoreHorizontal, Pin, PinOff, Copy, Star, Pencil, Search, X,
} from 'lucide-react';
import { useWorkspaceStore } from '@/store/workspaceStore';
import { useAuthStore } from '@/store/authStore';
import { updateUserSettings } from '@/lib/api/users';
import { getToken } from '@/lib/auth/session';
import { cn } from '@/lib/utils/cn';
import type { Model } from '@/types/models';

// ── Info tooltip ───────────────────────────────────────────────────────────────

function ModelInfoTip({ description }: { description: string }) {
  const [show, setShow] = useState(false);
  return (
    <span
      className="ms-info-wrap"
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
    >
      <Info className="h-3 w-3 ms-info-icon" />
      {show && <span className="ms-info-popup">{description}</span>}
    </span>
  );
}

// ── Avatar ─────────────────────────────────────────────────────────────────────

function ModelAvatar({ model, size = 'sm' }: { model?: Model; size?: 'sm' | 'md' }) {
  const { resolvedTheme } = useTheme();
  const [errored, setErrored] = useState(false);

  const isLight = resolvedTheme === 'bodhion-light';
  const fallbackIcon = isLight
    ? '/static/bodhion_favicon_light.svg'
    : '/static/bodhion_favicon_dark.svg';

  const src = !errored ? (model?.info?.meta?.profile_image_url ?? null) : null;
  const iconSize = size === 'md' ? 'h-6 w-6' : 'h-4 w-4';

  return (
    <div className={cn('ms-avatar', size === 'md' ? 'ms-avatar--md' : 'ms-avatar--sm')}>
      {src
        // eslint-disable-next-line @next/next/no-img-element
        ? <img src={src} alt={model?.name ?? 'model'} className="ms-avatar-img" onError={() => setErrored(true)} />
        // eslint-disable-next-line @next/next/no-img-element
        : <img src={fallbackIcon} alt="Bodhion" className={cn('ms-avatar-img object-contain', iconSize)} />}
    </div>
  );
}

// ── Fixed context menu (escapes overflow: hidden on ms-list) ───────────────────

interface ModelCtxMenuProps {
  model: Model;
  anchor: DOMRect;
  isPinned: boolean;
  communityEnabled: boolean;
  onPin: () => void;
  onEdit: () => void;
  onCopyLink: () => void;
  onCommunityReview: () => void;
  onClose: () => void;
}

function ModelCtxMenu({
  model: _model, anchor, isPinned, communityEnabled,
  onPin, onEdit, onCopyLink, onCommunityReview, onClose,
}: ModelCtxMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  // Prevent viewport overflow
  useLayoutEffect(() => {
    const el = menuRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    if (rect.right > window.innerWidth - 8)
      el.style.left = `${window.innerWidth - rect.width - 8}px`;
    if (rect.bottom > window.innerHeight - 8)
      el.style.top = `${anchor.top - rect.height - 4}px`;
  }, [anchor]);

  return (
    <div
      ref={menuRef}
      className="ms-ctx-menu ms-ctx-menu--fixed"
      style={{ top: anchor.bottom + 4, left: anchor.left }}
    >
      <button type="button" className="ms-ctx-item" onClick={onEdit}>
        <Pencil className="h-3 w-3" /> Edit
      </button>
      <button type="button" className="ms-ctx-item" onClick={onPin}>
        {isPinned
          ? <><PinOff className="h-3 w-3" /> Unpin from sidebar</>
          : <><Pin className="h-3 w-3" /> Keep in sidebar</>}
      </button>
      <button type="button" className="ms-ctx-item" onClick={onCopyLink}>
        <Copy className="h-3 w-3" /> Copy link
      </button>
      {communityEnabled && (
        <button type="button" className="ms-ctx-item" onClick={onCommunityReview}>
          <Star className="h-3 w-3" /> Community Review
        </button>
      )}
    </div>
  );
}

// ── Props ──────────────────────────────────────────────────────────────────────

export interface ModelSelectorProps {
  value: string;
  onChange: (modelId: string) => void;
  onRemove?: () => void; // show an X to remove this model slot
}

// ── Main component ─────────────────────────────────────────────────────────────

export function ModelSelector({ value, onChange, onRemove }: ModelSelectorProps) {
  const router = useRouter();
  const { models, settings, patchSettings } = useWorkspaceStore();
  const { config } = useAuthStore();

  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [tab, setTab] = useState<'all' | 'local'>('all');
  const [ctxState, setCtxState] = useState<{ model: Model; anchor: DOMRect } | null>(null);

  const wrapRef   = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const pinnedModels: string[] = settings?.pinnedModels ?? [];
  const communityEnabled = config?.features?.enable_community_sharing ?? false;
  const selectedModel = models.find((m) => m.id === value);

  // ── Close dropdown on outside click ──────────────────────────────────────
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
        setCtxState(null);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  // ── Focus search on open ──────────────────────────────────────────────────
  useEffect(() => {
    if (open) setTimeout(() => searchRef.current?.focus(), 50);
    else setSearch('');
  }, [open]);

  // ── Filter ────────────────────────────────────────────────────────────────
  const filtered = models
    .filter((m) => (tab === 'local' ? m.owned_by === 'ollama' : true))
    .filter((m) => {
      if (!search.trim()) return true;
      const q = search.toLowerCase();
      return (
        m.name.toLowerCase().includes(q) ||
        m.id.toLowerCase().includes(q) ||
        m.info?.meta?.tags?.some((t) => t.name.toLowerCase().includes(q))
      );
    });

  // ── Actions ───────────────────────────────────────────────────────────────
  const handlePin = useCallback(async (modelId: string) => {
    const next = pinnedModels.includes(modelId)
      ? pinnedModels.filter((id) => id !== modelId)
      : [...pinnedModels, modelId];
    const newSettings = { ...settings, pinnedModels: next };
    patchSettings({ pinnedModels: next });
    const token = getToken();
    if (token) {
      await updateUserSettings(token, { ui: newSettings }).catch(() => {});
    }
    setCtxState(null);
  }, [pinnedModels, patchSettings, settings]);

  const handleCopyLink = useCallback((modelId: string) => {
    const url = `${window.location.origin}/models?id=${encodeURIComponent(modelId)}`;
    navigator.clipboard.writeText(url).catch(() => {});
    setCtxState(null);
  }, []);

  const handleEdit = useCallback((modelId: string) => {
    router.push(`/workspace/models/edit?id=${encodeURIComponent(modelId)}`);
    setOpen(false);
    setCtxState(null);
  }, [router]);

  const handleCommunityReview = useCallback(() => {
    window.open('https://openwebui.com/models/', '_blank');
    setCtxState(null);
  }, []);

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="ms-wrap" ref={wrapRef}>

      {/* Trigger */}
      <div className="ms-trigger-group">
        <button
          type="button"
          className={cn('ms-trigger', open && 'ms-trigger--open')}
          onClick={() => setOpen((v) => !v)}
          aria-haspopup="listbox"
          aria-expanded={open}
        >
          <ModelAvatar model={selectedModel} size="sm" />
          <span className="ms-trigger-label">
            {selectedModel?.name ?? (value || 'Select model')}
          </span>
          <ChevronDown className={cn('ms-chevron', open && 'ms-chevron--open')} />
        </button>

        {/* Remove slot button */}
        {onRemove && (
          <button
            type="button"
            className="ms-remove-btn"
            onClick={onRemove}
            title="Remove model"
          >
            <X className="h-3 w-3" />
          </button>
        )}
      </div>

      {/* Dropdown */}
      {open && (
        <div className="ms-dropdown" role="listbox">

          {/* Search */}
          <div className="ms-search-wrap">
            <Search className="h-3.5 w-3.5 ms-search-icon" />
            <input
              ref={searchRef}
              type="text"
              className="ms-search-input"
              placeholder="Search models…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {search && (
              <button type="button" className="ms-search-clear" onClick={() => setSearch('')}>
                <X className="h-3 w-3" />
              </button>
            )}
          </div>

          {/* All / Local tabs */}
          <div className="ms-tabs" role="tablist">
            {(['all', 'local'] as const).map((t) => (
              <button
                key={t}
                type="button"
                role="tab"
                aria-selected={tab === t}
                className={cn('ms-tab', tab === t && 'ms-tab--active')}
                onClick={() => setTab(t)}
              >
                {t === 'all' ? 'All' : 'Local'}
              </button>
            ))}
          </div>

          {/* Model list */}
          <div className="ms-list">
            {filtered.length === 0 ? (
              <div className="ms-empty">No models found</div>
            ) : (
              filtered.map((model) => {
                const paramSize = (model as { details?: { parameter_size?: string } })
                  .details?.parameter_size;
                const metaTags: string[] = (model as { info?: { meta?: { tags?: string[] } } })
                  .info?.meta?.tags ?? [];
                const ctxWindow: number | undefined = (model as { info?: { meta?: { context_window?: number } } })
                  .info?.meta?.context_window;
                const ctxLabel = ctxWindow
                  ? ctxWindow >= 1000 ? `${Math.round(ctxWindow / 1000)}k ctx` : `${ctxWindow} ctx`
                  : undefined;
                const hasVision = metaTags.some((t) => t.toLowerCase() === 'vision');
                const hasTools = metaTags.some((t) => t.toLowerCase() === 'tools');
                return (
                  <div
                    key={model.id}
                    className={cn('ms-option', model.id === value && 'ms-option--selected')}
                  >
                    {/* Clickable main area */}
                    <button
                      type="button"
                      className="ms-option-main"
                      role="option"
                      aria-selected={model.id === value}
                      onClick={() => { onChange(model.id); setOpen(false); setSearch(''); }}
                    >
                      <ModelAvatar model={model} size="md" />
                      <div className="ms-option-info">
                        <span className="ms-option-name">{model.name}</span>
                        <div className="ms-option-badges">
                          {paramSize && <span className="ms-option-tag">{paramSize}</span>}
                          {hasVision && <span className="ms-option-tag ms-option-tag--vision">Vision</span>}
                          {hasTools && <span className="ms-option-tag ms-option-tag--tools">Tools</span>}
                          {ctxLabel && <span className="ms-option-tag ms-option-tag--ctx">{ctxLabel}</span>}
                        </div>
                      </div>
                      {model.id === value && (
                        <Check className="h-3.5 w-3.5 ms-option-check flex-shrink-0" />
                      )}
                    </button>

                    {/* Right: info icon + context menu trigger */}
                    <div className="ms-option-actions">
                      {model.info?.meta?.description && (
                        <ModelInfoTip description={model.info.meta.description} />
                      )}
                      <button
                        type="button"
                        className={cn('ms-ctx-btn', ctxState?.model.id === model.id && 'ms-ctx-btn--open')}
                        onClick={(e) => {
                          e.stopPropagation();
                          const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                          setCtxState(ctxState?.model.id === model.id ? null : { model, anchor: rect });
                        }}
                        title="More options"
                      >
                        <MoreHorizontal className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* Context menu — rendered outside ms-dropdown to escape overflow clipping */}
      {ctxState && (
        <ModelCtxMenu
          model={ctxState.model}
          anchor={ctxState.anchor}
          isPinned={pinnedModels.includes(ctxState.model.id)}
          communityEnabled={communityEnabled}
          onPin={() => handlePin(ctxState.model.id)}
          onEdit={() => handleEdit(ctxState.model.id)}
          onCopyLink={() => handleCopyLink(ctxState.model.id)}
          onCommunityReview={handleCommunityReview}
          onClose={() => setCtxState(null)}
        />
      )}
    </div>
  );
}

export default ModelSelector;
