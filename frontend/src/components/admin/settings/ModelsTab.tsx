'use client';

// Admin Settings → Models tab
// Full-parity port of src/lib/components/admin/Settings/Models.svelte
// Features: model list (all providers merged), view filters, search, pagination,
// toggle active, hide/show, bulk actions, import/export, create, model editor drawer.

import { useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react';
import {
  ChevronDown, Copy, Download, Eye, EyeOff, MoreHorizontal,
  Plus, Search, Upload,
} from 'lucide-react';
import { toast } from 'sonner';
import { getToken } from '@/lib/auth/session';
import { Switch } from '@/components/ui/Switch';
import { Button } from '@/components/ui/Button';
import { apiFetch, API_BASE_URL } from '@/lib/api/client';
import { getWorkspaceModelConfigs } from '@/lib/api/admin/settings';
import {
  createModel, exportModels, importModels, toggleModelById, updateModel,
} from '@/lib/api/models';
import { ModelEditorDrawer }   from './ModelEditorDrawer';
import { ManageOllamaPanel }   from './models/ManageOllamaPanel';
import { ModelSettingsPanel }  from './models/ModelSettingsPanel';
import { AdminLoadingSplash }  from '@/components/admin/AdminLoadingSplash';

// ── Types ─────────────────────────────────────────────────────────────────────
interface AccessGrant { principal_type: string; principal_id: string; permission: string; }

interface AdminModel {
  id: string;
  name: string;
  owned_by?: string;
  is_active?: boolean;
  base_model_id?: string | null;
  meta?: {
    hidden?: boolean;
    description?: string;
    profile_image_url?: string;
    tags?: Array<{ name: string }>;
    capabilities?: Record<string, boolean>;
  };
  params?: Record<string, unknown>;
  access_grants?: AccessGrant[];
  info?: unknown;
}

// ── Constants ─────────────────────────────────────────────────────────────────
const PAGE_SIZE = 30;

const VIEW_OPTIONS = [
  { value: '', label: 'All' },
  { value: 'enabled', label: 'Enabled' },
  { value: 'disabled', label: 'Disabled' },
  { value: 'visible', label: 'Visible' },
  { value: 'hidden', label: 'Hidden' },
  { value: 'public', label: 'Public' },
  { value: 'private', label: 'Private' },
];

const SECTION_TABS = [
  { id: 'catalog', label: 'Catalog' },
  { id: 'tools', label: 'Admin Tools' },
] as const;
type SectionTab = (typeof SECTION_TABS)[number]['id'];

const TOOLS_TABS = [
  { id: 'ollama', label: 'Ollama Models' },
  { id: 'settings', label: 'Global Defaults' },
] as const;
type ToolsTab = (typeof TOOLS_TABS)[number]['id'];

// ── Helpers ───────────────────────────────────────────────────────────────────
const isPublicModel = (m: AdminModel) =>
  (m.access_grants ?? []).some(
    (g) => g.principal_type === 'user' && g.principal_id === '*' && g.permission === 'read',
  );

// ── Avatar ────────────────────────────────────────────────────────────────────
function ModelAvatar({ model }: { model: AdminModel }) {
  const [errored, setErrored] = useState(false);
  const label = (model.name ?? model.id).charAt(0).toUpperCase();
  const src = !errored && model.meta?.profile_image_url
    ? model.meta.profile_image_url
    : !errored
      ? `${API_BASE_URL}/api/v1/models/model/profile/image?id=${encodeURIComponent(model.id)}&lang=en`
      : null;

  if (!src) {
    return (
      <div className="admin-model-avatar-fallback">{label}</div>
    );
  }
  return (
    <img
      src={src}
      alt={model.name ?? model.id}
      className="admin-model-avatar-img"
      onError={() => setErrored(true)}
    />
  );
}

// ── Per-row menu ──────────────────────────────────────────────────────────────
function ModelMenu({
  model,
  onHideShow,
  onExport,
  onClone,
}: {
  model: AdminModel;
  onHideShow: () => void;
  onExport: () => void;
  onClone: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, right: 0 });
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close when clicking outside — use contains() check instead of stopPropagation.
  // stopPropagation is unreliable in React 18 app-router: the native document
  // mousedown fires before React processes the synthetic event at root, so the
  // dropdown unmounts before onClick on items can execute.
  useEffect(() => {
    if (!open) return;
    const handleOutside = (e: MouseEvent) => {
      if (dropdownRef.current?.contains(e.target as Node)) return;
      if (triggerRef.current?.contains(e.target as Node)) return;
      setOpen(false);
    };
    const handleScroll = () => setOpen(false);
    document.addEventListener('mousedown', handleOutside);
    window.addEventListener('scroll', handleScroll, true);
    return () => {
      document.removeEventListener('mousedown', handleOutside);
      window.removeEventListener('scroll', handleScroll, true);
    };
  }, [open]);

  const handleOpen = () => {
    if (triggerRef.current) {
      const r = triggerRef.current.getBoundingClientRect();
      setPos({ top: r.bottom + 4, right: window.innerWidth - r.right });
    }
    setOpen((v) => !v);
  };

  const hidden = model.meta?.hidden ?? false;

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className="admin-model-menu-trigger"
        onClick={handleOpen}
        aria-label="Model actions"
      >
        <MoreHorizontal className="h-4 w-4" />
      </button>
      {open && (
        <div
          ref={dropdownRef}
          className="admin-model-menu-dropdown"
          style={{ top: pos.top, right: pos.right }}
        >
          <button type="button" className="admin-model-menu-item" onClick={() => { setOpen(false); onHideShow(); }}>
            {hidden ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
            {hidden ? 'Show' : 'Hide'}
          </button>
          <button type="button" className="admin-model-menu-item" onClick={() => {
            const url = `${window.location.origin}/?model=${encodeURIComponent(model.id)}`;
            navigator.clipboard.writeText(url).then(() => toast.success('Link copied'));
            setOpen(false);
          }}>
            <Copy className="h-3.5 w-3.5" />Copy Link
          </button>
          <button type="button" className="admin-model-menu-item" onClick={() => { setOpen(false); onClone(); }}>
            <Plus className="h-3.5 w-3.5" />Clone
          </button>
          <button type="button" className="admin-model-menu-item" onClick={() => { setOpen(false); onExport(); }}>
            <Download className="h-3.5 w-3.5" />Export
          </button>
        </div>
      )}
    </>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export function ModelsTab() {
  const [models, setModels] = useState<AdminModel[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);

  const [query, setQuery] = useState('');
  const [viewOption, setViewOption] = useState('');
  const [page, setPage] = useState(1);
  const [activeSection, setActiveSection] = useState<SectionTab>('catalog');
  const [toolsTab, setToolsTab] = useState<ToolsTab>('ollama');
  const [editorModelId, setEditorModelId] = useState<string | null>(null);

  const importInputRef = useRef<HTMLInputElement>(null);

  // ── Load all models — mirrors Svelte admin init() exactly ────────────────
  // 1. GET /api/models/base  → ALL provider models from Ollama/OpenAI connections
  //    (ignores is_active; admins need to see disabled models too)
  // 2. GET /api/v1/models/base → workspace config overlay per model
  //    (contains is_active, hidden, meta, params for configured models)
  // 3. Merge: for each provider model, spread workspace config on top.
  //    Provider models with no workspace entry default to is_active=true.
  // Workspace CUSTOM models (base_model_id !== null) are intentionally excluded —
  // they live in /workspace/models, not the admin catalog.
  const loadModels = async () => {
    const token = getToken();
    if (!token) return;
    setLoading(true);
    try {
      const [providerRes, workspaceConfigs] = await Promise.all([
        apiFetch<{ data: AdminModel[] }>(`${API_BASE_URL}/api/models/base`, { token }),
        getWorkspaceModelConfigs(token).catch(() => [] as Array<Record<string, unknown>>),
      ]);

      const providerModels: AdminModel[] = Array.isArray(providerRes?.data) ? providerRes.data : [];

      const merged: AdminModel[] = providerModels.map((m) => {
        const wm = workspaceConfigs.find((w) => w.id === m.id);
        if (wm) return { ...m, ...(wm as Partial<AdminModel>) };
        return { ...m, is_active: true }; // no workspace entry yet → default active
      });

      setModels(merged);
    } catch {
      toast.error('Failed to load models');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void loadModels(); }, []);

  // Debounce search
  useEffect(() => {
    setPage(1);
  }, [query, viewOption]);

  // ── Filtering ─────────────────────────────────────────────────────────────
  const filteredModels = useMemo(() => {
    const lq = query.toLowerCase();
    return models
      .filter((m) => !lq || m.name.toLowerCase().includes(lq) || m.id.toLowerCase().includes(lq))
      .filter((m) => {
        if (viewOption === 'enabled') return m.is_active ?? true;
        if (viewOption === 'disabled') return !(m.is_active ?? true);
        if (viewOption === 'visible') return !(m.meta?.hidden ?? false);
        if (viewOption === 'hidden') return m.meta?.hidden === true;
        if (viewOption === 'public') return isPublicModel(m);
        if (viewOption === 'private') return !isPublicModel(m);
        return true;
      })
      .sort((a, b) => (a.name ?? a.id).localeCompare(b.name ?? b.id));
  }, [models, query, viewOption]);

  const pageCount = Math.max(1, Math.ceil(filteredModels.length / PAGE_SIZE));
  const paginatedModels = useMemo(
    () => filteredModels.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
    [filteredModels, page],
  );

  // ── Toggle active ─────────────────────────────────────────────────────────
  const handleToggle = async (model: AdminModel) => {
    const token = getToken();
    if (!token) return;
    setSavingId(model.id);
    try {
      if (model.base_model_id === undefined && model.info === undefined) {
        // Base model with no workspace entry — create one then it's togglable
        await createModel(token, {
          id: model.id,
          name: model.name,
          base_model_id: null,
          meta: {},
          params: {},
          access_grants: [],
          is_active: !(model.is_active ?? true),
        } as never);
      } else {
        await toggleModelById(token, model.id);
      }
      setModels((prev) =>
        prev.map((m) => m.id === model.id ? { ...m, is_active: !(m.is_active ?? true) } : m),
      );
    } catch {
      toast.error('Failed to toggle model');
    } finally {
      setSavingId(null);
    }
  };

  // ── Build full ModelForm payload (backend requires id, name, meta, params) ─
  const buildModelPayload = (model: AdminModel, overrides: Partial<AdminModel> = {}) => ({
    id: model.id,
    name: model.name,
    base_model_id: model.base_model_id ?? null,
    meta: model.meta ?? {},
    params: model.params ?? {},
    access_grants: model.access_grants ?? [],
    is_active: model.is_active ?? true,
    ...overrides,
  });

  // Returns true when the model has no workspace DB entry yet (pure provider model).
  // Provider models from /api/models/base don't carry base_model_id or info.
  const isProviderOnlyModel = (m: AdminModel) =>
    m.base_model_id === undefined && m.info === undefined;

  // ── Hide / Show ───────────────────────────────────────────────────────────
  const handleHideShow = async (model: AdminModel) => {
    const token = getToken();
    if (!token) return;
    const nextHidden = !(model.meta?.hidden ?? false);
    const nextMeta = { ...(model.meta ?? {}), hidden: nextHidden };

    // Optimistic update
    setModels((prev) => prev.map((m) => m.id === model.id ? { ...m, meta: nextMeta } : m));

    try {
      if (isProviderOnlyModel(model)) {
        // No DB row yet — create one with hidden flag
        await createModel(token, buildModelPayload(model, { meta: nextMeta }) as never);
      } else {
        // DB row exists — update with full required payload
        await updateModel(token, model.id, buildModelPayload(model, { meta: nextMeta }) as never);
      }
      toast.success(nextHidden ? `${model.name} is now hidden` : `${model.name} is now visible`);
    } catch {
      // Revert optimistic update
      setModels((prev) => prev.map((m) => m.id === model.id ? { ...m, meta: model.meta } : m));
      toast.error('Failed to update visibility');
    }
  };

  // ── Bulk actions ──────────────────────────────────────────────────────────
  const bulkToggle = async (enable: boolean) => {
    const token = getToken();
    if (!token) return;
    const targets = filteredModels.filter((m) => enable ? !(m.is_active ?? true) : (m.is_active ?? true));
    if (targets.length === 0) { toast.info('No models to update'); return; }
    setModels((prev) => prev.map((m) => targets.find((t) => t.id === m.id) ? { ...m, is_active: enable } : m));
    await Promise.allSettled(targets.map((m) => toggleModelById(token, m.id)));
    toast.success(enable ? 'All models enabled' : 'All models disabled');
  };

  const bulkVisibility = async (hide: boolean) => {
    const token = getToken();
    if (!token) return;
    const targets = filteredModels.filter((m) => hide ? !(m.meta?.hidden ?? false) : m.meta?.hidden === true);
    if (targets.length === 0) { toast.info('No models to update'); return; }
    setModels((prev) => prev.map((m) => targets.find((t) => t.id === m.id) ? { ...m, meta: { ...m.meta, hidden: hide } } : m));
    await Promise.allSettled(targets.map((m) => {
      const nextMeta = { ...(m.meta ?? {}), hidden: hide };
      if (isProviderOnlyModel(m)) {
        return createModel(token, buildModelPayload(m, { meta: nextMeta }) as never);
      }
      return updateModel(token, m.id, buildModelPayload(m, { meta: nextMeta }) as never);
    }));
    toast.success(hide ? 'All models hidden' : 'All models visible');
  };

  // ── Export ────────────────────────────────────────────────────────────────
  const handleExport = async () => {
    const token = getToken();
    if (!token) return;
    try {
      const data = await exportModels(token);
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = `models-export-${Date.now()}.json`;
      document.body.appendChild(a); a.click(); a.remove();
      URL.revokeObjectURL(url);
    } catch { toast.error('Failed to export models'); }
  };

  const handleExportSingle = (model: AdminModel) => {
    const blob = new Blob([JSON.stringify([model], null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `${model.id}-${Date.now()}.json`;
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
  };

  // ── Import ────────────────────────────────────────────────────────────────
  const handleImport = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    const token = getToken();
    if (!file || !token) return;
    try {
      const content = await file.text();
      const parsed = JSON.parse(content);
      const incoming = Array.isArray(parsed) ? parsed : [parsed];
      const payload = incoming.map((item) => item?.info ?? item).filter((item) => item?.id && item?.name);
      if (payload.length === 0) { toast.error('Invalid JSON file'); return; }
      await importModels(token, payload);
      toast.success('Models imported successfully');
      await loadModels();
    } catch { toast.error('Invalid JSON file'); }
    finally { e.target.value = ''; }
  };

  // ── Clone ─────────────────────────────────────────────────────────────────
  const handleClone = (model: AdminModel) => {
    const draft = { ...model, base_model_id: model.id, id: `${model.id}-clone`, name: `${model.name} (Clone)` };
    sessionStorage.setItem('model', JSON.stringify(draft));
    window.open('/workspace/models/create', '_blank');
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="admin-models-root">
      {/* Section tabs */}
      <div className="admin-models-section-tabs">
        {SECTION_TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            className={`admin-models-section-tab${activeSection === tab.id ? ' admin-models-section-tab--active' : ''}`}
            onClick={() => setActiveSection(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeSection === 'catalog' && (
        <>
          {/* ── Loading splash — replaces entire catalog while fetching ── */}
          {loading ? (
            <AdminLoadingSplash title="Fetching models…" subtitle="Loading provider connections" />
          ) : (
          <>
          {/* Toolbar */}
          <div className="admin-models-toolbar">
            {/* Search */}
            <div className="admin-models-search-wrap">
              <Search className="admin-models-search-icon h-3.5 w-3.5" />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search models…"
                className="admin-input admin-models-search-input"
              />
            </div>

            {/* View selector */}
            <div className="admin-models-view-wrap">
              <ChevronDown className="admin-models-view-chevron h-3.5 w-3.5" />
              <select
                value={viewOption}
                onChange={(e) => setViewOption(e.target.value)}
                className="admin-models-view-select"
              >
                {VIEW_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>

            {/* Action buttons */}
            <div className="admin-models-actions">
              <input ref={importInputRef} type="file" accept=".json" hidden onChange={handleImport} />
              <button type="button" className="admin-models-btn" onClick={() => importInputRef.current?.click()} title="Import models">
                <Upload className="h-3.5 w-3.5" /><span>Import</span>
              </button>
              <button type="button" className="admin-models-btn" onClick={handleExport} title="Export all workspace models">
                <Download className="h-3.5 w-3.5" /><span>Export</span>
              </button>
            </div>
          </div>

          {/* Bulk actions */}
          <div className="admin-models-bulk">
            <span className="admin-models-count">{filteredModels.length} models</span>
            <div className="admin-models-bulk-actions">
              <button type="button" className="admin-models-bulk-btn" onClick={() => void bulkToggle(true)}>Enable All</button>
              <button type="button" className="admin-models-bulk-btn" onClick={() => void bulkToggle(false)}>Disable All</button>
              <button type="button" className="admin-models-bulk-btn" onClick={() => void bulkVisibility(false)}>Show All</button>
              <button type="button" className="admin-models-bulk-btn" onClick={() => void bulkVisibility(true)}>Hide All</button>
            </div>
          </div>

          {/* Model list */}
          <div className="admin-table-wrap">
            {paginatedModels.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm" style={{ color: 'var(--bodhion-text-secondary)' }}>
                No models found.
              </div>
            ) : (
              <div className="flex flex-col">
                {paginatedModels.map((model) => {
                  const hidden = model.meta?.hidden ?? false;
                  const active = model.is_active ?? true;
                  return (
                    <div
                      key={model.id}
                      className={`admin-table-row admin-model-row${hidden ? ' admin-model-row--hidden' : ''}`}
                    >
                      {/* Avatar */}
                      <div className="admin-model-avatar-shell">
                        <ModelAvatar model={model} />
                      </div>

                      {/* Name + ID
                          Only custom workspace models (base_model_id set) have a record
                          in /api/v1/models/model — base provider models (Ollama/OpenAI)
                          do not, so clicking them would always 404. */}
                      {model.base_model_id ? (
                        <button
                          type="button"
                          className="admin-model-info"
                          onClick={() => setEditorModelId(model.id)}
                          title={`Edit ${model.name}`}
                        >
                          <span className="admin-model-name">
                            {model.name}
                            {hidden && <span className="admin-model-badge admin-model-badge--hidden">hidden</span>}
                            {!active && <span className="admin-model-badge admin-model-badge--disabled">disabled</span>}
                          </span>
                          <span className="admin-model-id">{model.id}</span>
                        </button>
                      ) : (
                        <div className="admin-model-info admin-model-info--base">
                          <span className="admin-model-name">
                            {model.name}
                            {hidden && <span className="admin-model-badge admin-model-badge--hidden">hidden</span>}
                            {!active && <span className="admin-model-badge admin-model-badge--disabled">disabled</span>}
                          </span>
                          <span className="admin-model-id">{model.id}</span>
                        </div>
                      )}

                      {/* Owner badge */}
                      {model.owned_by && (
                        <span className="admin-model-owner">{model.owned_by}</span>
                      )}

                      {/* Hide/Show icon */}
                      <button
                        type="button"
                        className="admin-model-visibility-btn"
                        title={hidden ? 'Show model' : 'Hide model'}
                        onClick={() => void handleHideShow(model)}
                      >
                        {hidden ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>

                      {/* Active toggle */}
                      <Switch
                        checked={active}
                        onCheckedChange={() => void handleToggle(model)}
                        disabled={savingId === model.id}
                      />

                      {/* Row menu */}
                      <ModelMenu
                        model={model}
                        onHideShow={() => void handleHideShow(model)}
                        onExport={() => handleExportSingle(model)}
                        onClone={() => handleClone(model)}
                      />
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Pagination */}
          {filteredModels.length > PAGE_SIZE && (
            <div className="mt-2 flex items-center justify-end gap-2">
              <Button type="button" size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
                Previous
              </Button>
              <span className="text-xs" style={{ color: 'var(--bodhion-text-secondary)' }}>
                Page {page} / {pageCount}
              </span>
              <Button type="button" size="sm" variant="outline" disabled={page >= pageCount} onClick={() => setPage((p) => Math.min(pageCount, p + 1))}>
                Next
              </Button>
            </div>
          )}
          </>
          )}
        </>
      )}

      {activeSection === 'tools' && (
        <div className="admin-models-tools-section">
          {/* Sub-tabs */}
          <div className="admin-models-tools-tabs">
            {TOOLS_TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                className={`admin-models-tools-tab${toolsTab === t.id ? ' admin-models-tools-tab--active' : ''}`}
                onClick={() => setToolsTab(t.id)}
              >
                {t.label}
              </button>
            ))}
          </div>

          {toolsTab === 'ollama' && <ManageOllamaPanel />}
          {toolsTab === 'settings' && <ModelSettingsPanel onSaved={() => void loadModels()} />}
        </div>
      )}

      {/* Model editor drawer */}
      {editorModelId && (
        <ModelEditorDrawer
          modelId={editorModelId}
          onClose={() => setEditorModelId(null)}
          onSaved={() => { setEditorModelId(null); void loadModels(); }}
        />
      )}

      <style>{`
        .admin-models-root { display: flex; flex-direction: column; gap: 1rem; }

        /* Section tabs */
        .admin-models-section-tabs {
          display: flex; gap: 0.25rem;
          border-bottom: 1px solid var(--bodhion-card-border);
          padding-bottom: 0;
        }
        .admin-models-section-tab {
          padding: 0.45rem 1rem; font-size: 0.82rem; font-weight: 600;
          background: none; border: none; border-bottom: 2px solid transparent;
          color: var(--bodhion-text-secondary); cursor: pointer; transition: color 0.15s;
          margin-bottom: -1px;
        }
        .admin-models-section-tab:hover { color: var(--bodhion-text-primary); }
        .admin-models-section-tab--active { color: var(--bodhion-accent, #25d7ff); border-bottom-color: var(--bodhion-accent, #25d7ff); }

        /* Toolbar */
        .admin-models-toolbar { display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap; }
        .admin-models-search-wrap { position: relative; flex: 1; min-width: 180px; }
        .admin-models-search-icon { position: absolute; left: 0.6rem; top: 50%; transform: translateY(-50%); color: var(--bodhion-text-secondary); pointer-events: none; }
        .admin-models-search-input { padding-left: 2rem !important; height: 2.1rem; width: 100%; }
        .admin-models-view-wrap { position: relative; }
        .admin-models-view-chevron { position: absolute; right: 0.5rem; top: 50%; transform: translateY(-50%); pointer-events: none; color: var(--bodhion-text-secondary); }
        .admin-models-view-select {
          appearance: none; padding: 0.35rem 1.75rem 0.35rem 0.6rem;
          border-radius: 0.5rem; border: 1px solid var(--bodhion-card-border);
          background: var(--bodhion-search-bg); color: var(--bodhion-text-primary);
          font-size: 0.82rem; cursor: pointer;
        }
        .admin-models-actions { display: flex; gap: 0.4rem; align-items: center; margin-left: auto; }
        .admin-models-btn {
          display: inline-flex; align-items: center; gap: 0.35rem;
          padding: 0.35rem 0.75rem; border-radius: 0.5rem; font-size: 0.78rem; font-weight: 600;
          border: 1px solid var(--bodhion-card-border); background: var(--bodhion-search-bg);
          color: var(--bodhion-text-primary); cursor: pointer; text-decoration: none;
          transition: background 0.15s;
        }
        .admin-models-btn:hover { background: rgba(37,215,255,0.08); }
        .admin-models-btn--primary {
          background: var(--bodhion-primary-button, linear-gradient(135deg, rgba(0,104,201,0.94), rgba(37,215,255,0.72)));
          border-color: rgba(37,215,255,0.3); color: #eaf6ff;
        }
        .admin-models-btn--primary:hover { filter: brightness(1.08); }

        /* Bulk row */
        .admin-models-bulk { display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap; }
        .admin-models-count { font-size: 0.78rem; color: var(--bodhion-text-secondary); }
        .admin-models-bulk-actions { display: flex; gap: 0.35rem; flex-wrap: wrap; margin-left: auto; }
        .admin-models-bulk-btn {
          padding: 0.25rem 0.6rem; border-radius: 0.4rem; font-size: 0.75rem; font-weight: 600;
          border: 1px solid var(--bodhion-card-border); background: var(--bodhion-search-bg);
          color: var(--bodhion-text-secondary); cursor: pointer;
        }
        .admin-models-bulk-btn:hover { color: var(--bodhion-text-primary); background: rgba(37,215,255,0.08); }

        /* Table wrap — NO overflow:hidden so absolute dropdowns aren't clipped */
        .admin-table-wrap {
          border-radius: 0.75rem;
          border: 1px solid var(--bodhion-card-border);
          background: var(--bodhion-card-bg, rgba(255,255,255,0.03));
        }

        /* Model row */
        .admin-model-row {
          display: flex; align-items: center; gap: 0.75rem;
          padding: 0.7rem 1rem;
          border-bottom: 1px solid var(--bodhion-card-border);
          transition: background 0.12s;
          position: relative;
        }
        .admin-model-row:last-child { border-bottom: none; }
        .admin-model-row:hover { background: rgba(37,215,255,0.04); }
        .admin-model-row--hidden { opacity: 0.45; }

        /* Avatar */
        .admin-model-avatar-shell { flex-shrink: 0; }
        .admin-model-avatar-fallback {
          width: 2.4rem; height: 2.4rem; border-radius: 0.75rem;
          background: linear-gradient(135deg, rgba(37,215,255,0.15), rgba(0,104,201,0.2));
          color: #25d7ff;
          display: flex; align-items: center; justify-content: center;
          font-size: 1rem; font-weight: 700;
          border: 1px solid rgba(37,215,255,0.18);
        }
        .admin-model-avatar-img {
          width: 2.4rem; height: 2.4rem; border-radius: 0.75rem; object-fit: cover;
          border: 1px solid var(--bodhion-card-border);
        }

        /* Name + ID button */
        .admin-model-info {
          flex: 1; min-width: 0; text-align: left; background: none; border: none; cursor: pointer;
          display: flex; flex-direction: column; gap: 0.15rem; padding: 0;
        }
        .admin-model-name {
          font-size: 0.875rem; font-weight: 600;
          color: var(--bodhion-text-primary, #e8eaf0);
          white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
          display: flex; align-items: center; gap: 0.4rem;
          transition: color 0.15s;
        }
        .admin-model-info:hover .admin-model-name { color: var(--bodhion-accent, #25d7ff); }
        /* Base provider models are not clickable — no hover accent, default cursor */
        .admin-model-info--base { cursor: default; }
        .admin-model-id {
          font-size: 0.72rem; color: var(--bodhion-text-secondary, #8b95a6);
          white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
          font-family: monospace; letter-spacing: 0.01em;
        }

        /* Status badges */
        .admin-model-badge {
          font-size: 0.63rem; font-weight: 700; padding: 0.15rem 0.45rem; border-radius: 999px;
          text-transform: uppercase; letter-spacing: 0.06em; flex-shrink: 0;
          line-height: 1;
        }
        .admin-model-badge--hidden {
          background: rgba(255,255,255,0.07); color: rgba(255,255,255,0.4);
          border: 1px solid rgba(255,255,255,0.1);
        }
        .admin-model-badge--disabled {
          background: rgba(255,75,75,0.14); color: #ff6b6b;
          border: 1px solid rgba(255,75,75,0.25);
        }

        /* Owner chip */
        .admin-model-owner {
          font-size: 0.7rem; font-weight: 500;
          padding: 0.2rem 0.55rem; border-radius: 999px;
          border: 1px solid rgba(37,215,255,0.2);
          color: rgba(37,215,255,0.7);
          background: rgba(37,215,255,0.06);
          flex-shrink: 0; white-space: nowrap;
        }

        /* Visibility toggle button */
        .admin-model-visibility-btn {
          background: none; border: none; cursor: pointer; padding: 0.3rem;
          color: var(--bodhion-text-secondary); border-radius: 0.4rem; flex-shrink: 0;
          display: flex; align-items: center; transition: color 0.12s, background 0.12s;
        }
        .admin-model-visibility-btn:hover { color: var(--bodhion-text-primary); background: rgba(255,255,255,0.07); }

        /* ··· menu — z-index must be above the table wrapper and drawer */
        .admin-model-menu-trigger {
          background: none; border: none; cursor: pointer; padding: 0.3rem;
          border-radius: 0.4rem; color: var(--bodhion-text-secondary);
          display: flex; align-items: center; transition: color 0.12s, background 0.12s;
        }
        .admin-model-menu-trigger:hover { color: var(--bodhion-text-primary); background: rgba(255,255,255,0.07); }
        .admin-model-menu-dropdown {
          position: fixed; z-index: 9999; min-width: 148px;
          border-radius: 0.7rem; border: 1px solid var(--bodhion-card-border);
          background: var(--bodhion-card-bg, #131923);
          box-shadow: 0 12px 32px rgba(0,0,0,0.55), 0 2px 8px rgba(0,0,0,0.3);
          padding: 0.35rem;
        }
        .admin-model-menu-item {
          display: flex; align-items: center; gap: 0.5rem; width: 100%;
          padding: 0.42rem 0.65rem; border-radius: 0.45rem; font-size: 0.8rem;
          background: none; border: none; cursor: pointer;
          color: var(--bodhion-text-primary, #e8eaf0);
          text-align: left; transition: background 0.1s;
        }
        .admin-model-menu-item:hover { background: rgba(37,215,255,0.09); color: var(--bodhion-accent, #25d7ff); }

        /* Tools section */
        .admin-models-tools-section { display: flex; flex-direction: column; gap: 1rem; padding-top: 0.25rem; }
        .admin-models-tools-tabs {
          display: flex; gap: 0.25rem;
          border-bottom: 1px solid var(--bodhion-card-border);
        }
        .admin-models-tools-tab {
          padding: 0.4rem 0.9rem; font-size: 0.8rem; font-weight: 600;
          background: none; border: none; border-bottom: 2px solid transparent;
          color: var(--bodhion-text-secondary); cursor: pointer; margin-bottom: -1px;
          transition: color 0.15s;
        }
        .admin-models-tools-tab:hover { color: var(--bodhion-text-primary); }
        .admin-models-tools-tab--active { color: var(--bodhion-accent, #25d7ff); border-bottom-color: var(--bodhion-accent, #25d7ff); }
      `}</style>
    </div>
  );
}

export default ModelsTab;
