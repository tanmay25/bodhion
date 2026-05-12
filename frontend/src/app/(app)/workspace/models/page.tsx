'use client';

import { useEffect, useMemo, useState, type ChangeEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Download, Plus, Search, Upload } from 'lucide-react';
import { toast } from 'sonner';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { AdminLoadingSplash } from '@/components/admin/AdminLoadingSplash';
import { useAuthContext } from '@/providers/AuthProvider';
import { useAuthStore } from '@/store/authStore';
import { useWorkspaceStore } from '@/store/workspaceStore';
import { getToken } from '@/lib/auth/session';
import {
  exportModels,
  getModelItems,
  getModels,
  getModelTags,
  importModels,
  toggleModelById,
  type WorkspaceModelItem,
} from '@/lib/api/models';
import { API_BASE_URL } from '@/lib/api/client';

const PAGE_SIZE = 30;

function ModelAvatar({ model }: { model: WorkspaceModelItem }) {
  const [errored, setErrored] = useState(false);
  const label = (model.name ?? model.id).charAt(0).toUpperCase();
  const dimClass = model.is_active ? '' : 'opacity-50';

  const src =
    !errored && model.meta?.profile_image_url
      ? model.meta.profile_image_url
      : !errored
        ? `${API_BASE_URL}/api/v1/models/model/profile/image?id=${encodeURIComponent(model.id)}&lang=en`
        : null;

  if (!src) {
    return (
      <div
        className={`flex h-12 w-12 items-center justify-center rounded-2xl bg-[rgba(37,215,255,0.12)] text-lg font-bold text-[#25d7ff] ${dimClass}`}
      >
        {label}
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={model.name ?? model.id}
      className={`h-12 w-12 rounded-2xl object-cover ${dimClass}`}
      onError={() => setErrored(true)}
    />
  );
}

export default function ModelsPage() {
  const router = useRouter();
  const { user } = useAuthContext();
  const config = useAuthStore((s) => s.config);
  const { settings, setModels } = useWorkspaceStore();

  const [isLoaded, setIsLoaded] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [query, setQuery] = useState('');
  const [viewOption, setViewOption] = useState('');
  const [selectedTag, setSelectedTag] = useState('');
  const [page, setPage] = useState(1);
  const [items, setItems] = useState<WorkspaceModelItem[]>([]);
  const [tags, setTags] = useState<string[]>([]);
  const [total, setTotal] = useState(0);

  const canImport =
    user?.role === 'admin' ||
    Boolean((user?.permissions?.workspace as Record<string, boolean> | undefined)?.models_import);
  const canExport =
    user?.role === 'admin' ||
    Boolean((user?.permissions?.workspace as Record<string, boolean> | undefined)?.models_export);

  const pageCount = useMemo(() => Math.max(1, Math.ceil(total / PAGE_SIZE)), [total]);

  useEffect(() => {
    setViewOption(localStorage.getItem('workspaceViewOption') ?? '');
    setIsLoaded(true);
  }, []);

  useEffect(() => {
    if (!isLoaded) return;
    const timer = window.setTimeout(() => {
      setPage(1);
      void loadModelList(1);
    }, 300);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  useEffect(() => {
    if (!isLoaded) return;
    setPage(1);
    void loadModelList(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedTag, viewOption, isLoaded]);

  useEffect(() => {
    if (!isLoaded) return;
    void loadModelList(page);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  const loadSharedModels = async (token: string) => {
    const directConnections =
      config?.features?.enable_direct_connections && settings?.directConnections
        ? settings.directConnections
        : null;
    const latest = await getModels(token, directConnections).catch(() => []);
    setModels(latest);
  };

  const loadModelList = async (nextPage: number) => {
    const token = getToken();
    if (!token) return;

    setIsLoading(true);
    try {
      const [listRes, tagsRes] = await Promise.all([
        getModelItems(token, {
          query,
          viewOption,
          tag: selectedTag,
          page: nextPage,
        }),
        getModelTags(token).catch(() => []),
      ]);
      setItems(listRes?.items ?? []);
      setTotal(listRes?.total ?? 0);
      setTags(tagsRes ?? []);
    } catch {
      toast.error('Failed to load models');
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggleActive = async (modelId: string) => {
    const token = getToken();
    if (!token) return;
    try {
      await toggleModelById(token, modelId);
      await loadModelList(page);
      await loadSharedModels(token);
    } catch {
      toast.error('Failed to update model status');
    }
  };

  const handleImport = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    const token = getToken();
    if (!file || !token) return;

    try {
      const content = await file.text();
      const parsed = JSON.parse(content);
      const incoming = Array.isArray(parsed) ? parsed : [parsed];
      const payload = incoming
        .map((item) => item?.info ?? item)
        .filter((item) => item && item.id && item.name);

      if (payload.length === 0) {
        toast.error('Invalid JSON file');
        return;
      }

      await importModels(token, payload);
      toast.success('Models imported successfully');
      setPage(1);
      await loadModelList(1);
      await loadSharedModels(token);
    } catch {
      toast.error('Invalid JSON file');
    } finally {
      event.target.value = '';
    }
  };

  const handleExportAll = async () => {
    const token = getToken();
    if (!token) return;
    try {
      const exported = await exportModels(token);
      const blob = new Blob([JSON.stringify(exported, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `models-export-${Date.now()}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      toast.error('Failed to export models');
    }
  };

  if (!isLoaded) return null;

  return (
    <div className="workspace-models-page">
      <div className="workspace-models-toolbar">
        <input id="models-import-input" type="file" accept=".json" hidden onChange={handleImport} />

        <div className="workspace-models-toolbar__top">
          <div className="workspace-models-title">
            <div>Models</div>
            <div className="workspace-models-count">{total}</div>
          </div>

          <div className="workspace-models-actions">
            {canImport && (
              <Button
                type="button"
                className="workspace-models-button workspace-models-button--muted"
                onClick={() => document.getElementById('models-import-input')?.click()}
              >
                <Upload className="h-3.5 w-3.5" />
                Import
              </Button>
            )}

            {canExport && total > 0 && (
              <Button
                type="button"
                className="workspace-models-button workspace-models-button--muted"
                onClick={handleExportAll}
              >
                <Download className="h-3.5 w-3.5" />
                Export
              </Button>
            )}

            <Button asChild className="workspace-models-button workspace-models-button--primary">
              <Link href="/workspace/models/create">
                <Plus className="h-3.5 w-3.5" />
                New Model
              </Link>
            </Button>
          </div>
        </div>
      </div>

      <div className="workspace-models-surface">
        <div className="workspace-models-searchbar">
          <div className="workspace-models-search-icon">
            <Search className="h-3.5 w-3.5" />
          </div>
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search Models"
            maxLength={500}
            className="workspace-models-search-input"
          />
        </div>

        <div className="workspace-models-filters">
          <div className="workspace-models-filters__inner">
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
              <option value="created">Created</option>
              <option value="shared">Shared</option>
            </select>

            {tags.length > 0 && (
              <select
                value={selectedTag}
                onChange={(e) => setSelectedTag(e.target.value)}
                className="workspace-models-filter-select"
              >
                <option value="">All Tags</option>
                {tags.map((tag) => (
                  <option key={tag} value={tag}>
                    {tag}
                  </option>
                ))}
              </select>
            )}
          </div>
        </div>

        {isLoading ? (
          <AdminLoadingSplash
            title="Loading Models…"
            subtitle="Fetching workspace models"
          />
        ) : items.length === 0 ? (
          <div className="workspace-models-empty">No models found.</div>
        ) : (
          <div className="workspace-models-grid">
            {items.map((model) => {
              const canEdit = Boolean(model.write_access);
              return (
                <div
                  key={model.id}
                  className={`workspace-model-card ${canEdit ? 'workspace-model-card--interactive' : ''}`}
                  onClick={() => {
                    if (canEdit) {
                      router.push(`/workspace/models/edit?id=${encodeURIComponent(model.id)}`);
                    }
                  }}
                  role={canEdit ? 'button' : undefined}
                  tabIndex={canEdit ? 0 : -1}
                  onKeyDown={(e) => {
                    if (!canEdit) return;
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      router.push(`/workspace/models/edit?id=${encodeURIComponent(model.id)}`);
                    }
                  }}
                >
                  <div className="flex min-w-0 items-center gap-3.5">
                    <div className="workspace-model-avatar-shell">
                      <ModelAvatar model={model} />
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="workspace-model-name line-clamp-1">{model.name ?? model.id}</div>
                      <div className="workspace-model-meta line-clamp-1">
                        By {model?.user?.name ?? model?.user?.email ?? 'Deleted User'} ·{' '}
                        {(String(model?.meta?.description ?? '').trim() || model.id).toString()}
                      </div>
                    </div>

                    <button
                      type="button"
                      className={`workspace-model-switch ${model.is_active ? 'workspace-model-switch--on' : ''}`}
                      aria-label={model.is_active ? 'Disable model' : 'Enable model'}
                      onClick={(e) => {
                        e.stopPropagation();
                        void handleToggleActive(model.id);
                      }}
                    >
                      <span className="workspace-model-switch__thumb" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {total > PAGE_SIZE && (
          <div className="mt-2 flex items-center justify-end gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={page <= 1 || isLoading}
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
              disabled={page >= pageCount || isLoading}
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
