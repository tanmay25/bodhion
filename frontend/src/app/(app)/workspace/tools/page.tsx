'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  CopyPlus,
  Download,
  Ellipsis,
  Link,
  Pencil,
  Plus,
  Search,
  Server,
  Settings2,
  Trash2,
  Wrench,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { AdminLoadingSplash } from '@/components/admin/AdminLoadingSplash';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/Modal';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/Dropdown';
import { CodeEditor } from '@/components/shared/CodeEditor';
import type { CodeEditorHandle } from '@/components/shared/CodeEditor';
import { getToken } from '@/lib/auth/session';
import {
  getTools,
  getToolById,
  createTool,
  deleteTool,
  loadToolByUrl,
  getToolUserValvesSpec,
  getToolUserValves,
  updateToolUserValves,
} from '@/lib/api/workspace';
import type { Tool } from '@/types/api';
import { useAuthStore } from '@/store/authStore';

// ── Constants ────────────────────────────────────────────────────────────────

const TOOL_TEMPLATE = `"""
title: My Tool
description: A custom tool for the AI assistant
author: your-name
version: 0.1.0
"""

from pydantic import BaseModel, Field
from typing import Optional


class Tools:
    class Valves(BaseModel):
        api_key: str = Field(default="", description="Optional API key")

    class UserValves(BaseModel):
        enabled: bool = Field(default=True, description="Enable this tool for your account")

    def __init__(self):
        self.valves = self.Valves()

    def my_function(self, query: str) -> str:
        """
        Describe what this function does.
        :param query: The input string.
        :return: Result string.
        """
        return f"Result: {query}"
`;

// ── Local types ───────────────────────────────────────────────────────────────

type ToolItem = Tool & { write_access?: boolean };

interface ValveFieldSpec {
  type: string;
  title?: string;
  description?: string;
  default?: unknown;
  enum?: string[];
}

interface ValveSpec {
  properties: Record<string, ValveFieldSpec>;
  required?: string[];
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const toIdentifier = (s: string) =>
  s.toLowerCase().trim().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');

const capitalize = (v?: string) => (v ? v.charAt(0).toUpperCase() + v.slice(1) : '');

const formatDate = (epoch: number) =>
  new Date(epoch * 1000).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

const isServer = (id: string) => id.startsWith('server:');

const serverType = (id: string): 'MCP' | 'OpenAPI' =>
  id.startsWith('server:mcp:') ? 'MCP' : 'OpenAPI';

// ── Valve field renderer ──────────────────────────────────────────────────────

function ValveField({
  name,
  spec,
  value,
  onChange,
}: {
  name: string;
  spec: ValveFieldSpec;
  value: unknown;
  onChange: (v: unknown) => void;
}) {
  const label = spec.title ?? name;
  const inputCls = 'admin-input h-9 w-full rounded-md px-3 text-sm';

  if (spec.type === 'boolean') {
    return (
      <div className="flex items-center justify-between gap-3">
        <div className="flex flex-col">
          <span className="text-sm font-medium text-[var(--bodhion-text-primary)]">{label}</span>
          {spec.description && (
            <span className="text-xs text-[var(--bodhion-text-secondary)]">{spec.description}</span>
          )}
        </div>
        <input
          type="checkbox"
          checked={!!value}
          onChange={(e) => onChange(e.target.checked)}
          className="h-4 w-4 cursor-pointer rounded accent-[rgba(37,215,255,0.9)]"
        />
      </div>
    );
  }

  if (spec.enum?.length) {
    return (
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium text-[var(--bodhion-text-primary)]">{label}</label>
        {spec.description && (
          <span className="text-xs text-[var(--bodhion-text-secondary)]">{spec.description}</span>
        )}
        <select
          value={String(value ?? '')}
          onChange={(e) => onChange(e.target.value)}
          className="admin-select h-9 w-full rounded-md px-3 text-sm"
        >
          {spec.enum.map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </select>
      </div>
    );
  }

  if (spec.type === 'integer' || spec.type === 'number') {
    return (
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium text-[var(--bodhion-text-primary)]">{label}</label>
        {spec.description && (
          <span className="text-xs text-[var(--bodhion-text-secondary)]">{spec.description}</span>
        )}
        <input
          type="number"
          value={(value as number) ?? ''}
          onChange={(e) =>
            onChange(
              spec.type === 'integer'
                ? parseInt(e.target.value, 10)
                : parseFloat(e.target.value),
            )
          }
          className={inputCls}
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-sm font-medium text-[var(--bodhion-text-primary)]">{label}</label>
      {spec.description && (
        <span className="text-xs text-[var(--bodhion-text-secondary)]">{spec.description}</span>
      )}
      <input
        type="text"
        value={String(value ?? '')}
        onChange={(e) => onChange(e.target.value)}
        className={inputCls}
      />
    </div>
  );
}

// ── User Valves Modal ─────────────────────────────────────────────────────────

function ToolUserValvesModal({
  tool,
  onClose,
}: {
  tool: ToolItem | null;
  onClose: () => void;
}) {
  const [spec, setSpec] = useState<ValveSpec | null>(null);
  const [values, setValues] = useState<Record<string, unknown>>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!tool) return;
    setLoading(true);
    const token = getToken();
    if (!token) { setLoading(false); return; }

    Promise.all([getToolUserValvesSpec(token, tool.id), getToolUserValves(token, tool.id)])
      .then(([specRes, valuesRes]) => {
        setSpec((specRes as unknown as ValveSpec) ?? null);
        setValues((valuesRes as Record<string, unknown>) ?? {});
      })
      .catch(() => { setSpec(null); setValues({}); })
      .finally(() => setLoading(false));
  }, [tool?.id]);

  const handleSave = async () => {
    if (!tool) return;
    const token = getToken();
    if (!token) return;
    setSaving(true);
    try {
      await updateToolUserValves(token, tool.id, values);
      toast.success('Settings saved');
      onClose();
    } catch {
      toast.error('Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const fields = Object.entries(spec?.properties ?? {});

  return (
    <Dialog open={!!tool} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="admin-dialog flex max-h-[90vh] flex-col sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Configure — {tool?.name}</DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto py-1 pr-1">
          {loading ? (
            <div className="flex flex-col gap-4">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="flex flex-col gap-1.5">
                  <div className="h-4 w-24 animate-pulse rounded bg-[var(--bodhion-search-bg)]" />
                  <div className="h-9 w-full animate-pulse rounded bg-[var(--bodhion-search-bg)]" />
                </div>
              ))}
            </div>
          ) : fields.length === 0 ? (
            <p className="py-4 text-center text-sm text-[var(--bodhion-text-secondary)]">
              No configurable settings for this tool.
            </p>
          ) : (
            <div className="flex flex-col gap-4">
              {fields.map(([name, fieldSpec]) => (
                <ValveField
                  key={name}
                  name={name}
                  spec={fieldSpec}
                  value={values[name] ?? fieldSpec.default}
                  onChange={(v) => setValues((prev) => ({ ...prev, [name]: v }))}
                />
              ))}
            </div>
          )}
        </div>

        {!loading && fields.length > 0 && (
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={onClose} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={() => void handleSave()} disabled={saving}>
              {saving ? 'Saving…' : 'Save'}
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function ToolsPage() {
  const user = useAuthStore((s) => s.user);
  const router = useRouter();

  const [loaded, setLoaded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [allItems, setAllItems] = useState<ToolItem[]>([]);
  const [query, setQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'tools' | 'servers'>('tools');

  // editor modal (create only)
  const [editorOpen, setEditorOpen] = useState(false);
  const [formName, setFormName] = useState('');
  const [formId, setFormId] = useState('');
  const [formDesc, setFormDesc] = useState('');
  const [formInitialContent, setFormInitialContent] = useState(TOOL_TEMPLATE);
  const [idTouched, setIdTouched] = useState(false);
  const [saving, setSaving] = useState(false);
  const codeRef = useRef<CodeEditorHandle>(null);

  // load-from-URL modal
  const [urlModalOpen, setUrlModalOpen] = useState(false);
  const [urlValue, setUrlValue] = useState('');
  const [urlLoading, setUrlLoading] = useState(false);

  // valves modal
  const [valvesTool, setValvesTool] = useState<ToolItem | null>(null);

  // delete
  const [deleteTarget, setDeleteTarget] = useState<ToolItem | null>(null);
  const [deleting, setDeleting] = useState(false);

  const canCreate =
    user?.role === 'admin' ||
    Boolean((user?.permissions?.workspace as Record<string, boolean> | undefined)?.tools) ||
    Boolean((user?.permissions?.workspace as Record<string, boolean> | undefined)?.tools_import);

  // Derived filtered lists
  const localTools = useMemo(() => {
    const base = allItems.filter((t) => !isServer(t.id));
    if (!query) return base;
    const lq = query.toLowerCase();
    return base.filter(
      (t) =>
        t.name.toLowerCase().includes(lq) ||
        t.id.toLowerCase().includes(lq) ||
        (t.meta?.description as string | undefined)?.toLowerCase().includes(lq),
    );
  }, [allItems, query]);

  const serverTools = useMemo(() => {
    const base = allItems.filter((t) => isServer(t.id));
    if (!query) return base;
    const lq = query.toLowerCase();
    return base.filter(
      (t) =>
        t.name.toLowerCase().includes(lq) ||
        (t.meta?.description as string | undefined)?.toLowerCase().includes(lq),
    );
  }, [allItems, query]);

  // ── Data loading ────────────────────────────────────────────────────────────

  const loadTools = async () => {
    const token = getToken();
    if (!token) return;
    setLoading(true);
    try {
      const list = await getTools(token);
      setAllItems((list ?? []) as ToolItem[]);
    } catch {
      toast.error('Failed to load tools');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (!loaded) return;
    void loadTools();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded]);

  // ── Editor helpers ──────────────────────────────────────────────────────────

  const openCreate = () => {
    setFormName('');
    setFormId('');
    setFormDesc('');
    setFormInitialContent(TOOL_TEMPLATE);
    setIdTouched(false);
    setEditorOpen(true);
  };

  const closeEditor = () => {
    setEditorOpen(false);
  };

  const handleNameChange = (name: string) => {
    setFormName(name);
    if (!idTouched) setFormId(toIdentifier(name));
  };

  const handleSave = async () => {
    const token = getToken();
    if (!token) return;
    const content = codeRef.current?.getValue() ?? '';

    if (!formName.trim()) { toast.error('Name is required'); return; }
    if (!formId.trim()) { toast.error('ID is required'); return; }

    setSaving(true);
    try {
      await createTool(token, {
        id: formId,
        name: formName,
        meta: { description: formDesc || undefined },
        content,
      });
      toast.success('Tool created');
      closeEditor();
      await loadTools();
    } catch (err: unknown) {
      const detail = (err as { detail?: string })?.detail;
      toast.error(detail ?? 'Failed to create tool');
    } finally {
      setSaving(false);
    }
  };

  // ── Load from URL ───────────────────────────────────────────────────────────

  const handleLoadUrl = async () => {
    const token = getToken();
    if (!token || !urlValue.trim()) return;
    setUrlLoading(true);
    try {
      const result = await loadToolByUrl(token, urlValue.trim());
      const r = result as { name?: string; content?: string };
      setUrlModalOpen(false);
      setUrlValue('');
      setFormName(r.name ?? '');
      setFormId(toIdentifier(r.name ?? ''));
      setFormDesc('');
      setFormInitialContent(r.content ?? TOOL_TEMPLATE);
      setIdTouched(false);
      setEditorOpen(true);
    } catch (err: unknown) {
      const detail = (err as { detail?: string })?.detail;
      toast.error(detail ?? 'Failed to load tool from URL');
    } finally {
      setUrlLoading(false);
    }
  };

  // ── Actions ─────────────────────────────────────────────────────────────────

  const handleClone = async (tool: ToolItem) => {
    const token = getToken();
    if (!token) return;
    try {
      const full = await getToolById(token, tool.id);
      setFormName(`${full.name} (Clone)`);
      setFormId(`${full.id}_clone`);
      setFormDesc((full.meta?.description as string | undefined) ?? '');
      setFormInitialContent(full.content ?? '');
      setIdTouched(true);
      setEditorOpen(true);
    } catch {
      toast.error('Failed to clone tool');
    }
  };

  const handleExport = (tool: ToolItem) => {
    const blob = new Blob([JSON.stringify(tool, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `tool-${tool.id}-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const handleDelete = async () => {
    const token = getToken();
    if (!token || !deleteTarget) return;
    setDeleting(true);
    try {
      await deleteTool(token, deleteTarget.id);
      toast.success(`Deleted "${deleteTarget.name}"`);
      setDeleteTarget(null);
      await loadTools();
    } catch {
      toast.error('Failed to delete tool');
    } finally {
      setDeleting(false);
    }
  };

  // ── Render ──────────────────────────────────────────────────────────────────

  if (!loaded) return <AdminLoadingSplash title="Loading Tools…" subtitle="Fetching workspace tools" />;

  const activeCount = activeTab === 'tools' ? localTools.length : serverTools.length;

  return (
    <div className="workspace-tools-page">

      {/* ── Toolbar ── */}
      <div className="workspace-prompts-toolbar">
        <div className="workspace-prompts-toolbar__top">
          <div className="workspace-prompts-title">
            <div>Tools</div>
            {!loading && <div className="workspace-prompts-count">{activeCount}</div>}
          </div>

          <div className="workspace-prompts-actions">
            {canCreate && (
              <>
                <Button
                  type="button"
                  className="workspace-prompts-button workspace-prompts-button--muted"
                  onClick={() => setUrlModalOpen(true)}
                >
                  <Link className="h-3.5 w-3.5" />
                  Load from URL
                </Button>
                <Button
                  type="button"
                  className="workspace-prompts-button workspace-prompts-button--primary"
                  onClick={openCreate}
                >
                  <Plus className="h-3.5 w-3.5" />
                  New Tool
                </Button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* ── Surface ── */}
      <div className="workspace-prompts-surface">

        {/* Search */}
        <div className="workspace-prompts-searchbar">
          <div className="workspace-prompts-search-icon">
            <Search className="h-3.5 w-3.5" />
          </div>
          <Input
            className="workspace-prompts-search-input"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search Tools"
            aria-label="Search Tools"
            maxLength={500}
          />
          {query && (
            <div className="self-center rounded-l-xl bg-transparent pl-1.5">
              <button
                className="workspace-prompts-clear"
                aria-label="Clear search"
                onClick={() => setQuery('')}
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          )}
        </div>

        {/* Tabs */}
        <div className="workspace-tools-tabs">
          <button
            className={`workspace-tools-tab ${activeTab === 'tools' ? 'workspace-tools-tab--active' : ''}`}
            onClick={() => setActiveTab('tools')}
          >
            <Wrench className="h-3.5 w-3.5" />
            My Tools
            {localTools.length > 0 && (
              <span className="workspace-tools-tab-count">{localTools.length}</span>
            )}
          </button>
          <button
            className={`workspace-tools-tab ${activeTab === 'servers' ? 'workspace-tools-tab--active' : ''}`}
            onClick={() => setActiveTab('servers')}
          >
            <Server className="h-3.5 w-3.5" />
            Tool Servers
            {serverTools.length > 0 && (
              <span className="workspace-tools-tab-count">{serverTools.length}</span>
            )}
          </button>
        </div>

        {/* Content */}
        {loading ? (
          <AdminLoadingSplash title="Loading Tools…" subtitle="Fetching workspace tools" />
        ) : activeTab === 'tools' ? (
          localTools.length === 0 ? (
            <div className="workspace-skills-empty">
              <Wrench className="workspace-skills-empty__icon" />
              <div className="workspace-skills-empty__title">No tools found</div>
              <div className="workspace-skills-empty__sub">
                {canCreate
                  ? 'Create a Python tool or load one from a GitHub URL.'
                  : 'No tools are available to you yet.'}
              </div>
            </div>
          ) : (
            <div className="workspace-prompts-grid">
              {localTools.map((tool) => {
                const specCount = (tool.specs ?? []).length;
                return (
                  <div key={tool.id} className="workspace-prompts-card">
                    <button
                      type="button"
                      className="min-w-0 flex-1 pl-1 text-left"
                      onClick={() => router.push(`/workspace/tools/${tool.id}`)}
                    >
                      <div className="mb-0.5 flex items-center gap-2">
                        <div className="line-clamp-1 font-medium">{tool.name}</div>
                        <div className="workspace-skills-id line-clamp-1">{tool.id}</div>
                        {specCount > 0 && (
                          <Badge variant="outline" className="workspace-tools-spec-badge">
                            {specCount} fn{specCount !== 1 ? 's' : ''}
                          </Badge>
                        )}
                        {tool.has_user_valves && (
                          <Badge variant="outline" className="workspace-tools-valves-badge">
                            configurable
                          </Badge>
                        )}
                        {!tool.write_access && tool.write_access !== undefined && (
                          <Badge variant="outline">Read Only</Badge>
                        )}
                      </div>
                      <div className="flex gap-1 text-xs text-[var(--bodhion-text-secondary)]">
                        {(tool.meta?.description as string | undefined) ? (
                          <div className="line-clamp-1">{tool.meta?.description as string}</div>
                        ) : (
                          <div className="italic opacity-50">No description</div>
                        )}
                        <div>·</div>
                        <div className="shrink-0">
                          {capitalize(tool.user?.name ?? tool.user?.email ?? 'Unknown')}
                        </div>
                        <div>·</div>
                        <div className="shrink-0">{formatDate(tool.updated_at)}</div>
                      </div>
                    </button>

                    <div className="flex flex-row gap-1 self-center">
                      {tool.has_user_valves && (
                        <button
                          className="workspace-prompts-icon-btn"
                          type="button"
                          aria-label="Configure user settings"
                          onClick={() => setValvesTool(tool)}
                        >
                          <Settings2 className="h-4 w-4" />
                        </button>
                      )}

                      {tool.write_access !== false && (
                        <button
                          className="workspace-prompts-icon-btn workspace-prompts-icon-btn--danger"
                          type="button"
                          aria-label="Delete tool"
                          onClick={() => setDeleteTarget(tool)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}

                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button
                            className="workspace-prompts-icon-btn"
                            type="button"
                            aria-label="More options"
                          >
                            <Ellipsis className="h-4 w-4" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-[160px]">
                          {tool.write_access !== false && (
                            <DropdownMenuItem
                              onClick={() => router.push(`/workspace/tools/${tool.id}`)}
                            >
                              <Pencil className="mr-2 h-4 w-4" />
                              Edit
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuItem onClick={() => void handleClone(tool)}>
                            <CopyPlus className="mr-2 h-4 w-4" />
                            Clone
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleExport(tool)}>
                            <Download className="mr-2 h-4 w-4" />
                            Export
                          </DropdownMenuItem>
                          {tool.write_access !== false && (
                            <>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                className="text-red-500 focus:text-red-500"
                                onClick={() => setDeleteTarget(tool)}
                              >
                                <Trash2 className="mr-2 h-4 w-4" />
                                Delete
                              </DropdownMenuItem>
                            </>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                );
              })}
            </div>
          )
        ) : (
          // ── Server tools tab ──
          serverTools.length === 0 ? (
            <div className="workspace-skills-empty">
              <Server className="workspace-skills-empty__icon" />
              <div className="workspace-skills-empty__title">No tool servers connected</div>
              <div className="workspace-skills-empty__sub">
                Admins can connect OpenAPI or MCP tool servers from the admin settings panel.
              </div>
            </div>
          ) : (
            <div className="workspace-prompts-grid">
              {serverTools.map((tool) => (
                <div key={tool.id} className="workspace-prompts-card">
                  <div className="min-w-0 flex-1 pl-1">
                    <div className="mb-0.5 flex items-center gap-2">
                      <div className="line-clamp-1 font-medium">{tool.name}</div>
                      <Badge variant="outline" className="workspace-tools-type-badge">
                        {serverType(tool.id)}
                      </Badge>
                      {tool.authenticated === false && (
                        <Badge variant="outline" className="workspace-tools-auth-badge">
                          Not authenticated
                        </Badge>
                      )}
                    </div>
                    <div className="text-xs text-[var(--bodhion-text-secondary)]">
                      {(tool.meta?.description as string | undefined) ?? (
                        <span className="italic opacity-50">No description</span>
                      )}
                    </div>
                  </div>

                  {tool.has_user_valves && (
                    <div className="flex flex-row gap-1 self-center">
                      <button
                        className="workspace-prompts-icon-btn"
                        type="button"
                        aria-label="Configure settings"
                        onClick={() => setValvesTool(tool)}
                      >
                        <Settings2 className="h-4 w-4" />
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )
        )}
      </div>

      {/* ── Create modal ── */}
      <Dialog open={editorOpen} onOpenChange={(v) => !v && closeEditor()}>
        <DialogContent className="workspace-skills-editor-dialog">
          <DialogHeader>
            <DialogTitle>New Tool</DialogTitle>
          </DialogHeader>

          <div className="workspace-skills-editor-body">
            <div className="grid grid-cols-2 gap-3">
              <div className="workspace-skills-field">
                <label className="workspace-skills-label" htmlFor="tool-name">
                  Name <span className="text-red-400">*</span>
                </label>
                <Input
                  id="tool-name"
                  placeholder="e.g. Web Search"
                  value={formName}
                  onChange={(e) => handleNameChange(e.target.value)}
                  maxLength={100}
                />
              </div>

              <div className="workspace-skills-field">
                <label className="workspace-skills-label" htmlFor="tool-id">
                  ID <span className="text-red-400">*</span>
                  <span className="workspace-skills-label-hint">snake_case</span>
                </label>
                <Input
                  id="tool-id"
                  placeholder="e.g. web_search"
                  value={formId}
                  onChange={(e) => {
                    setIdTouched(true);
                    setFormId(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '_'));
                  }}
                  maxLength={64}
                />
              </div>
            </div>

            <div className="workspace-skills-field">
              <label className="workspace-skills-label" htmlFor="tool-desc">
                Description
              </label>
              <Input
                id="tool-desc"
                placeholder="What does this tool do? (optional)"
                value={formDesc}
                onChange={(e) => setFormDesc(e.target.value)}
                maxLength={300}
              />
            </div>

            <div className="workspace-skills-field workspace-skills-field--grow">
              <label className="workspace-skills-label">
                Content <span className="text-xs opacity-60">(Python)</span>
              </label>
              <div className="workspace-skills-editor-wrap">
                <CodeEditor
                  ref={codeRef}
                  language="python"
                  value={formInitialContent}
                  height="100%"
                  onSave={handleSave}
                />
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-2">
            <Button variant="outline" onClick={closeEditor} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={() => void handleSave()} disabled={saving}>
              {saving ? 'Saving…' : 'Create Tool'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Load from URL modal ── */}
      <Dialog open={urlModalOpen} onOpenChange={(v) => { if (!v) { setUrlModalOpen(false); setUrlValue(''); } }}>
        <DialogContent className="admin-dialog sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Load Tool from URL</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-3 py-1">
            <p className="text-sm text-[var(--bodhion-text-secondary)]">
              Paste a GitHub file or folder URL. The tool code will be fetched and opened in the editor for review before saving.
            </p>
            <Input
              placeholder="https://github.com/org/repo/blob/main/tools/my_tool.py"
              value={urlValue}
              onChange={(e) => setUrlValue(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && !urlLoading && void handleLoadUrl()}
              autoFocus
            />
          </div>
          <DialogFooter className="gap-2 sm:gap-2">
            <Button
              variant="outline"
              onClick={() => { setUrlModalOpen(false); setUrlValue(''); }}
              disabled={urlLoading}
            >
              Cancel
            </Button>
            <Button
              onClick={() => void handleLoadUrl()}
              disabled={urlLoading || !urlValue.trim()}
            >
              {urlLoading ? 'Fetching…' : 'Load'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── User Valves Modal ── */}
      <ToolUserValvesModal tool={valvesTool} onClose={() => setValvesTool(null)} />

      {/* ── Delete confirm ── */}
      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete Tool"
        description={`"${deleteTarget?.name}" will be permanently deleted.`}
        confirmLabel="Delete"
        variant="destructive"
        loading={deleting}
        onConfirm={() => void handleDelete()}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
