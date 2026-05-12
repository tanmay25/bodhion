'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Download, Plus, Search, Trash2, X } from 'lucide-react';
import { toast } from 'sonner';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { AdminLoadingSplash } from '@/components/admin/AdminLoadingSplash';
import { getToken } from '@/lib/auth/session';
import {
  deleteKnowledge,
  exportKnowledgeById,
  searchKnowledgeBases,
  type WorkspaceListQuery,
} from '@/lib/api/workspace';
import { useAuthStore } from '@/store/authStore';

type KnowledgeItem = {
  id: string;
  name: string;
  description?: string;
  updated_at?: number;
  meta?: Record<string, unknown>;
  write_access?: boolean;
  user?: { id: string; name: string; email: string };
};

const PAGE_SIZE = 20;

const formatRelative = (timestamp?: number) => {
  if (!timestamp) return '';
  const target = timestamp * 1000;
  const diffMs = target - Date.now();
  const diffMin = Math.round(diffMs / 60000);
  const absMin = Math.abs(diffMin);
  const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' });
  if (absMin < 60) return rtf.format(diffMin, 'minute');
  const diffHr = Math.round(diffMin / 60);
  if (Math.abs(diffHr) < 24) return rtf.format(diffHr, 'hour');
  const diffDay = Math.round(diffHr / 24);
  return rtf.format(diffDay, 'day');
};

const capitalize = (value?: string) => {
  if (!value) return '';
  return value.charAt(0).toUpperCase() + value.slice(1);
};

export default function KnowledgePage() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const loaderRef = useRef<HTMLDivElement | null>(null);

  const [loaded, setLoaded] = useState(false);
  const [query, setQuery] = useState('');
  const [viewOption, setViewOption] = useState('');
  const [items, setItems] = useState<KnowledgeItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [itemsLoading, setItemsLoading] = useState(false);
  const [allItemsLoaded, setAllItemsLoaded] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    setViewOption(localStorage.getItem('workspaceViewOption') ?? '');
    setLoaded(true);
  }, []);

  const resetAndLoad = async (nextQuery = query, nextView = viewOption) => {
    setPage(1);
    setItems([]);
    setTotal(0);
    setAllItemsLoaded(false);
    await loadPage(1, true, nextQuery, nextView);
  };

  const loadPage = async (
    nextPage: number,
    replace = false,
    nextQuery = query,
    nextView = viewOption
  ) => {
    const token = getToken();
    if (!token || itemsLoading) return;
    setItemsLoading(true);

    try {
      const params: WorkspaceListQuery = {
        query: nextQuery || undefined,
        viewOption: nextView || undefined,
        page: nextPage,
      };
      const res = await searchKnowledgeBases(token, params);
      const pageItems = (res?.items ?? []) as KnowledgeItem[];
      setTotal(res?.total ?? 0);
      setAllItemsLoaded(pageItems.length < PAGE_SIZE);
      setItems((prev) => (replace ? pageItems : [...prev, ...pageItems]));
    } catch {
      toast.error('Failed to load knowledge');
    } finally {
      setItemsLoading(false);
    }
  };

  useEffect(() => {
    if (!loaded) return;
    const timer = window.setTimeout(() => {
      void resetAndLoad(query, viewOption);
    }, 300);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  useEffect(() => {
    if (!loaded) return;
    void resetAndLoad(query, viewOption);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewOption, loaded]);

  useEffect(() => {
    if (!loaded || !loaderRef.current) return;
    const observer = new IntersectionObserver(
      (entries) => {
        const [entry] = entries;
        if (!entry?.isIntersecting || itemsLoading || allItemsLoaded || items.length === 0) return;
        const next = page + 1;
        setPage(next);
        void loadPage(next);
      },
      { rootMargin: '120px' }
    );
    observer.observe(loaderRef.current);
    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded, itemsLoading, allItemsLoaded, items, page]);

  const helpText = useMemo(
    () => "Use '#' in the prompt input to load and include your knowledge.",
    []
  );

  const onDelete = async (item: KnowledgeItem) => {
    if (!window.confirm(`Delete "${item.name}"?`)) return;
    const token = getToken();
    if (!token) return;
    setDeletingId(item.id);
    try {
      await deleteKnowledge(token, item.id);
      toast.success('Knowledge deleted successfully.');
      await resetAndLoad();
    } catch {
      toast.error('Failed to delete knowledge');
    } finally {
      setDeletingId(null);
    }
  };

  const onExport = async (item: KnowledgeItem) => {
    const token = getToken();
    if (!token) return;
    try {
      const blob = await exportKnowledgeById(token, item.id);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${item.name || 'knowledge'}.zip`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.success('Knowledge exported successfully');
    } catch {
      toast.error('Failed to export knowledge');
    }
  };

  const onOpenItem = (item: KnowledgeItem) => {
    if ((item?.meta as Record<string, unknown> | undefined)?.document) {
      toast.error('Only collections can be edited, create a new knowledge base to edit/add documents.');
      return;
    }
    router.push(`/workspace/knowledge/${item.id}`);
  };

  if (!loaded) return <AdminLoadingSplash title="Loading Knowledge…" subtitle="Fetching knowledge bases" />;

  return (
    <div className="workspace-knowledge-page">
      <div className="workspace-knowledge-toolbar">
        <div className="workspace-knowledge-toolbar__top">
          <div className="workspace-knowledge-title">
            <div>Knowledge</div>
            <div className="workspace-knowledge-count">{total}</div>
          </div>

          <div className="workspace-knowledge-actions">
            <Button asChild className="workspace-knowledge-button workspace-knowledge-button--primary">
              <Link href="/workspace/knowledge/create">
                <Plus className="h-3.5 w-3.5" />
                <span>New Knowledge</span>
              </Link>
            </Button>
          </div>
        </div>
      </div>

      <div className="workspace-knowledge-surface">
        <div className="workspace-knowledge-searchbar">
          <div className="workspace-knowledge-search-icon">
            <Search className="h-3.5 w-3.5" />
          </div>
          <Input
            className="workspace-knowledge-search-input"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search Knowledge"
            aria-label="Search Knowledge"
          />
          {query && (
            <button className="workspace-knowledge-clear" onClick={() => setQuery('')} aria-label="Clear search">
              <X className="h-3 w-3" />
            </button>
          )}
        </div>

        <div className="workspace-knowledge-filters">
          <div className="workspace-knowledge-filters__inner">
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
          </div>
        </div>

        {items.length === 0 && !itemsLoading ? (
          <div className="workspace-knowledge-empty">
            <div className="workspace-knowledge-empty__card">
              <div className="workspace-knowledge-empty__icon">?</div>
              <div className="workspace-knowledge-empty__title">No knowledge found</div>
              <div className="workspace-knowledge-empty__copy">
                Try adjusting your search or filter to find what you are looking for.
              </div>
            </div>
          </div>
        ) : (
          <>
            <div className="workspace-knowledge-grid">
              {items.map((item) => {
                const writeAccess = Boolean(item?.write_access || user?.role === 'admin');
                return (
                  <div
                    key={item.id}
                    className="workspace-knowledge-card"
                    role="button"
                    tabIndex={0}
                    onClick={() => onOpenItem(item)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        onOpenItem(item);
                      }
                    }}
                  >
                    <div className="w-full">
                      <div className="flex h-8 items-center justify-between">
                        <div className="flex w-full items-center justify-between gap-2">
                          <div className="inline-flex rounded-full border border-emerald-300 bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">
                            Collection
                          </div>
                          {!writeAccess && (
                            <div className="inline-flex rounded-full border border-slate-300 bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600">
                              Read Only
                            </div>
                          )}
                        </div>

                        {writeAccess && (
                          <div className="ml-2 flex items-center gap-1">
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              className="h-7 px-2"
                              onClick={(e) => {
                                e.stopPropagation();
                                void onExport(item);
                              }}
                            >
                              <Download className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              className="h-7 px-2 text-red-500 hover:text-red-600"
                              disabled={deletingId === item.id}
                              onClick={(e) => {
                                e.stopPropagation();
                                void onDelete(item);
                              }}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        )}
                      </div>

                      <div className="mt-1.5 flex items-center justify-between gap-3 px-1">
                        <div className="min-w-0">
                          <div className="line-clamp-1 text-sm font-medium capitalize">{item.name}</div>
                          <div className="line-clamp-1 text-xs text-[var(--bodhion-text-secondary)]">
                            {item.description || item.id}
                          </div>
                        </div>
                        <div className="shrink-0 text-xs text-[var(--bodhion-text-secondary)]">
                          {item.updated_at ? `Updated ${formatRelative(item.updated_at)}` : ''}
                        </div>
                      </div>

                      <div className="mt-1 px-1 text-xs text-[var(--bodhion-text-secondary)]">
                        By {capitalize(item?.user?.name || item?.user?.email || 'Deleted user')}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {!allItemsLoaded && (
              <div ref={loaderRef} className="py-4 text-center text-xs text-[var(--bodhion-text-secondary)]">
                {itemsLoading ? 'Loading...' : 'Scroll for more'}
              </div>
            )}
          </>
        )}
      </div>

      <div className="workspace-knowledge-help">ⓘ {helpText}</div>
    </div>
  );
}
