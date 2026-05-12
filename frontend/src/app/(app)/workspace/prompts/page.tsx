'use client';

import { useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react';
import { Check, Copy, Download, Ellipsis, Plus, Search, Trash2, X, CopyPlus } from 'lucide-react';
import { toast } from 'sonner';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { AdminLoadingSplash } from '@/components/admin/AdminLoadingSplash';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/Dropdown';
import { getToken } from '@/lib/auth/session';
import {
  createPrompt,
  deletePrompt,
  getPromptItems,
  getPromptTags,
  togglePromptById,
} from '@/lib/api/workspace';
import type { Prompt } from '@/types/api';
import { useAuthStore } from '@/store/authStore';

const PAGE_SIZE = 30;

type PromptListItem = Prompt & {
  id: string;
  name?: string;
  command: string;
  content: string;
  tags?: string[];
  is_active?: boolean;
  write_access?: boolean;
  user?: { id: string; name: string; email: string };
};

const capitalize = (value?: string) => {
  if (!value) return '';
  return value.charAt(0).toUpperCase() + value.slice(1);
};

export default function PromptsPage() {
  const user = useAuthStore((s) => s.user);

  const [loaded, setLoaded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState('');
  const [viewOption, setViewOption] = useState('');
  const [selectedTag, setSelectedTag] = useState('');
  const [page, setPage] = useState(1);
  const [items, setItems] = useState<PromptListItem[]>([]);
  const [tags, setTags] = useState<string[]>([]);
  const [total, setTotal] = useState(0);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const importRef = useRef<HTMLInputElement | null>(null);

  const pageCount = useMemo(() => Math.max(1, Math.ceil(total / PAGE_SIZE)), [total]);

  const canImport =
    user?.role === 'admin' ||
    Boolean((user?.permissions?.workspace as Record<string, boolean> | undefined)?.prompts_import);
  const canExport =
    user?.role === 'admin' ||
    Boolean((user?.permissions?.workspace as Record<string, boolean> | undefined)?.prompts_export);

  useEffect(() => {
    setViewOption(localStorage.getItem('workspaceViewOption') ?? '');
    setLoaded(true);
  }, []);

  const loadPrompts = async (nextPage: number) => {
    const token = getToken();
    if (!token) return;

    setLoading(true);
    try {
      const [listRes, tagsRes] = await Promise.all([
        getPromptItems(token, {
          query: query || undefined,
          viewOption: viewOption || undefined,
          tag: selectedTag || undefined,
          page: nextPage,
        }),
        getPromptTags(token).catch(() => []),
      ]);
      setItems((listRes?.items ?? []) as PromptListItem[]);
      setTotal(listRes?.total ?? 0);
      setTags(tagsRes ?? []);
    } catch {
      toast.error('Failed to load prompts');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!loaded) return;
    const timer = window.setTimeout(() => {
      setPage(1);
      void loadPrompts(1);
    }, 300);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  useEffect(() => {
    if (!loaded) return;
    setPage(1);
    void loadPrompts(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedTag, viewOption, loaded]);

  useEffect(() => {
    if (!loaded) return;
    void loadPrompts(page);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  const handleImport = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    const token = getToken();
    if (!file || !token) return;

    try {
      const content = await file.text();
      const parsed = JSON.parse(content);
      const incoming = Array.isArray(parsed) ? parsed : [parsed];

      for (const prompt of incoming) {
        const raw = prompt?.prompt ?? prompt;
        const commandRaw = String(raw?.command ?? '').trim().replace(/^\//, '');
        const text = String(raw?.content ?? '').trim();
        const title = String(raw?.name ?? raw?.title ?? commandRaw).trim();
        if (!commandRaw || !text) continue;
        await createPrompt(token, {
          command: commandRaw,
          title,
          content: text,
        });
      }

      toast.success('Prompts imported successfully');
      setPage(1);
      await loadPrompts(1);
    } catch {
      toast.error('Invalid JSON file');
    } finally {
      event.target.value = '';
    }
  };

  const handleExport = async () => {
    const blob = new Blob([JSON.stringify(items, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `prompts-export-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const handleExportOne = async (item: PromptListItem) => {
    const blob = new Blob([JSON.stringify([item], null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `prompt-export-${item.command || Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const handleCopy = async (item: PromptListItem) => {
    try {
      await navigator.clipboard.writeText(item.content ?? '');
      setCopiedId(item.id);
      window.setTimeout(() => setCopiedId(null), 2000);
    } catch {
      toast.error('Failed to copy prompt');
    }
  };

  const handleDelete = async (item: PromptListItem) => {
    const token = getToken();
    if (!token) return;
    if (!window.confirm(`Delete "${item.command}"?`)) return;

    try {
      await deletePrompt(token, item.command);
      toast.success(`Deleted ${item.command}`);
      setPage(1);
      await loadPrompts(1);
    } catch {
      toast.error('Failed to delete prompt');
    }
  };

  const handleClone = async (item: PromptListItem) => {
    const token = getToken();
    if (!token) return;

    const baseCommand = (item.command || '').replace(/^\//, '');
    const cloneCommand = `${baseCommand}-clone-${Date.now().toString().slice(-5)}`;

    try {
      await createPrompt(token, {
        command: cloneCommand,
        title: `${item.name ?? item.title ?? item.command} (Clone)`,
        content: item.content ?? '',
      });
      toast.success('Prompt cloned');
      setPage(1);
      await loadPrompts(1);
    } catch {
      toast.error('Failed to clone prompt');
    }
  };

  const handleToggleActive = async (item: PromptListItem) => {
    const token = getToken();
    if (!token || !item.id) return;

    try {
      await togglePromptById(token, item.id);
      await loadPrompts(page);
    } catch {
      toast.error('Failed to update prompt status');
    }
  };

  if (!loaded) return <AdminLoadingSplash title="Loading Prompts…" subtitle="Fetching prompt templates" />;

  return (
    <div className="workspace-prompts-page">
      <div className="workspace-prompts-toolbar">
        <input
          ref={importRef}
          type="file"
          accept=".json"
          hidden
          onChange={handleImport}
          id="prompts-import-input"
        />

        <div className="workspace-prompts-toolbar__top">
          <div className="workspace-prompts-title">
            <div>Prompts</div>
            <div className="workspace-prompts-count">{total}</div>
          </div>

          <div className="workspace-prompts-actions">
            {canImport && (
              <Button
                type="button"
                className="workspace-prompts-button workspace-prompts-button--muted"
                onClick={() => importRef.current?.click()}
              >
                Import
              </Button>
            )}

            {canExport && total > 0 && (
              <Button
                type="button"
                className="workspace-prompts-button workspace-prompts-button--muted"
                onClick={handleExport}
              >
                Export
              </Button>
            )}

            <Button
              type="button"
              className="workspace-prompts-button workspace-prompts-button--primary"
              onClick={() => toast.info('Prompt create page will be merged next')}
            >
              <Plus className="h-3.5 w-3.5" />
              New Prompt
            </Button>
          </div>
        </div>
      </div>

      <div className="workspace-prompts-surface">
        <div className="workspace-prompts-searchbar">
          <div className="workspace-prompts-search-icon">
            <Search className="h-3.5 w-3.5" />
          </div>
          <Input
            className="workspace-prompts-search-input"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Search Prompts"
            placeholder="Search Prompts"
            maxLength={500}
          />

          {query && (
            <div className="self-center rounded-l-xl bg-transparent pl-1.5">
              <button className="workspace-prompts-clear" aria-label="Clear search" onClick={() => setQuery('')}>
                <X className="h-3 w-3" />
              </button>
            </div>
          )}
        </div>

        <div className="workspace-prompts-filters">
          <div className="workspace-prompts-filters__inner">
            <select
              value={viewOption}
              onChange={(e) => {
                const value = e.target.value;
                localStorage.setItem('workspaceViewOption', value);
                setViewOption(value);
              }}
              className="workspace-models-filter-select"
            >
              <option value="">All</option>
              <option value="created">Created by you</option>
              <option value="shared">Shared with you</option>
            </select>

            {tags.length > 0 && (
              <select
                value={selectedTag}
                onChange={(e) => setSelectedTag(e.target.value)}
                className="workspace-models-filter-select capitalize"
              >
                <option value="">Tag</option>
                {tags.map((tag) => (
                  <option key={tag} value={tag}>
                    {tag}
                  </option>
                ))}
              </select>
            )}
          </div>
        </div>

        {loading ? (
          <AdminLoadingSplash
            title="Loading Prompts…"
            subtitle="Fetching prompt templates"
          />
        ) : items.length === 0 ? (
          <div className="workspace-prompts-empty">No prompts found.</div>
        ) : (
          <div className="workspace-prompts-grid">
            {items.map((item) => (
              <div key={item.id} className="workspace-prompts-card">
                <div className="min-w-0 flex-1 pl-1">
                  <div className="mb-0.5 flex items-center justify-between gap-2">
                    <div className="flex min-w-0 items-center gap-2">
                      <div className="line-clamp-1 font-medium capitalize">{item.name ?? item.title ?? item.command}</div>
                      <div className="line-clamp-1 text-xs text-[var(--bodhion-text-secondary)]">/{item.command}</div>
                    </div>
                    {!item.write_access && <Badge variant="outline">Read Only</Badge>}
                  </div>

                  <div className="flex gap-1 text-xs text-[var(--bodhion-text-secondary)]">
                    <div className="shrink-0">
                      By {capitalize(item?.user?.name ?? item?.user?.email ?? 'Deleted user')}
                    </div>
                    <div>·</div>
                    <div className="line-clamp-1">{item.content}</div>
                  </div>
                </div>

                <div className="flex flex-row gap-1 self-center">
                  <button
                    className="workspace-prompts-icon-btn"
                    type="button"
                    aria-label="Copy Prompt"
                    onClick={() => void handleCopy(item)}
                  >
                    {copiedId === item.id ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  </button>

                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button className="workspace-prompts-icon-btn" type="button" aria-label="More">
                        <Ellipsis className="h-4 w-4" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-[160px]">
                      <DropdownMenuItem
                        onClick={() => {
                          void handleClone(item);
                        }}
                      >
                        <CopyPlus className="mr-2 h-4 w-4" />
                        Clone
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => {
                          void handleExportOne(item);
                        }}
                      >
                        <Download className="mr-2 h-4 w-4" />
                        Export
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        className="text-red-500 focus:text-red-500"
                        onClick={() => {
                          void handleDelete(item);
                        }}
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>

                  <button
                    type="button"
                    className={`workspace-model-switch ${item.is_active !== false ? 'workspace-model-switch--on' : ''}`}
                    aria-label={item.is_active !== false ? 'Disable prompt' : 'Enable prompt'}
                    onClick={() => void handleToggleActive(item)}
                  >
                    <span className="workspace-model-switch__thumb" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {total > PAGE_SIZE && (
          <div className="mt-2 flex items-center justify-end gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={page <= 1 || loading}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              Previous
            </Button>
            <span className="text-xs text-[var(--bodhion-text-secondary)]">
              Page {page} / {pageCount}
            </span>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={page >= pageCount || loading}
              onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
            >
              Next
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
