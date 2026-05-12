'use client';

import { useEffect, useState, useCallback } from 'react';
import { Download, ArrowUpDown } from 'lucide-react';
import { toast } from 'sonner';
import { getToken } from '@/lib/auth/session';
import {
  getFeedbackItems,
  deleteFeedbackById,
  exportAllFeedbacks,
  type FeedbackItem,
} from '@/lib/api/admin/evaluations';
import { AdminPagination } from '@/components/shared/AdminPagination';
import { ConfirmDialog }    from '@/components/shared/ConfirmDialog';
import { FeedbackModal }    from './modals/FeedbackModal';

const PER_PAGE = 30;

type SortKey   = 'user' | 'model_id' | 'rating' | 'updated_at';
type Direction = 'asc' | 'desc';

function ratingLabel(rating?: number | string) {
  const r = String(rating);
  if (r === '1')  return { label: 'Won',  color: 'rgba(37,215,255,0.9)',  bg: 'rgba(37,215,255,0.1)',  border: 'rgba(37,215,255,0.2)' };
  if (r === '0')  return { label: 'Draw', color: 'rgba(143,169,189,0.9)', bg: 'rgba(143,169,189,0.1)', border: 'rgba(143,169,189,0.2)' };
  if (r === '-1') return { label: 'Lost', color: 'rgba(248,113,113,0.9)', bg: 'rgba(248,113,113,0.1)', border: 'rgba(248,113,113,0.2)' };
  return null;
}

function timeAgo(ts: number) {
  const diff = Date.now() / 1000 - ts;
  if (diff < 60)          return 'just now';
  if (diff < 3600)        return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400)       return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 86400 * 30)  return `${Math.floor(diff / 86400)}d ago`;
  return new Date(ts * 1000).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function SkeletonRow() {
  return (
    <tr className="admin-table-row">
      {[1, 2, 3, 4, 5].map((i) => (
        <td key={i} className="px-3 py-2">
          <div className="h-4 animate-pulse rounded" style={{ width: `${[20, 50, 20, 25, 10][i - 1]}%`, background: 'var(--bodhion-search-bg)' }} />
        </td>
      ))}
    </tr>
  );
}

export function FeedbackList() {
  const [items,     setItems]     = useState<FeedbackItem[] | null>(null);
  const [total,     setTotal]     = useState(0);
  const [page,      setPage]      = useState(1);
  const [orderBy,   setOrderBy]   = useState<SortKey>('updated_at');
  const [direction, setDirection] = useState<Direction>('desc');
  const [loading,   setLoading]   = useState(false);

  const [selected,       setSelected]       = useState<FeedbackItem | null>(null);
  const [deleteTarget,   setDeleteTarget]   = useState<string | null>(null);
  const [deleteLoading,  setDeleteLoading]  = useState(false);

  const load = useCallback(async () => {
    const token = getToken();
    if (!token) return;
    setLoading(true);
    try {
      const res = await getFeedbackItems(token, orderBy, direction, page);
      setItems(res?.items ?? []);
      setTotal(res?.total ?? 0);
    } catch {
      toast.error('Failed to load feedback');
    } finally {
      setLoading(false);
    }
  }, [orderBy, direction, page]);

  useEffect(() => { load(); }, [load]);

  function toggleSort(key: SortKey) {
    if (orderBy === key) setDirection((d) => d === 'asc' ? 'desc' : 'asc');
    else { setOrderBy(key); setDirection('asc'); }
    setPage(1);
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleteLoading(true);
    const token = getToken();
    try {
      await deleteFeedbackById(token!, deleteTarget);
      toast.success('Feedback deleted');
      setDeleteTarget(null);
      setPage(1);
      load();
    } catch {
      toast.error('Failed to delete feedback');
    } finally {
      setDeleteLoading(false);
    }
  }

  async function handleExport() {
    const token = getToken();
    if (!token) return;
    try {
      const data = await exportAllFeedbacks(token);
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href     = url;
      a.download = `feedback-export-${Date.now()}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error('Export failed');
    }
  }

  function SortIcon({ col }: { col: SortKey }) {
    if (orderBy !== col) return <ArrowUpDown className="ml-1 inline h-3 w-3 opacity-40" />;
    return (
      <span className="ml-1 inline-block text-[10px] leading-none" style={{ color: 'rgba(37,215,255,0.9)' }}>
        {direction === 'asc' ? '▲' : '▼'}
      </span>
    );
  }

  const thCls = 'admin-table-head px-3 py-2 text-xs font-medium uppercase tracking-wide select-none cursor-pointer whitespace-nowrap';

  return (
    <>
      {/* Header */}
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <h2 className="text-base font-semibold" style={{ color: 'var(--bodhion-text-primary)' }}>
            Feedback History
          </h2>
          {total > 0 && (
            <span className="text-sm" style={{ color: 'var(--bodhion-text-secondary)' }}>
              {total}
            </span>
          )}
        </div>
        {total > 0 && (
          <button
            onClick={handleExport}
            title="Export feedback"
            className="rounded-lg p-2 transition-colors hover:bg-[rgba(37,215,255,0.08)]"
            style={{ color: 'var(--bodhion-text-secondary)' }}
          >
            <Download className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Table */}
      <div className="admin-table-wrap overflow-x-auto rounded-lg">
        <table className="w-full text-sm">
          <thead>
            <tr>
              <th className={thCls} onClick={() => toggleSort('user')}>
                User <SortIcon col="user" />
              </th>
              <th className={`${thCls} text-left`} onClick={() => toggleSort('model_id')}>
                Model <SortIcon col="model_id" />
              </th>
              <th className={`${thCls} text-right`} onClick={() => toggleSort('rating')}>
                Result <SortIcon col="rating" />
              </th>
              <th className={`${thCls} text-right`} onClick={() => toggleSort('updated_at')}>
                Updated <SortIcon col="updated_at" />
              </th>
              <th className="admin-table-head px-3 py-2 text-right text-xs font-medium uppercase tracking-wide w-10" />
            </tr>
          </thead>
          <tbody>
            {loading || items === null
              ? Array.from({ length: 8 }).map((_, i) => <SkeletonRow key={i} />)
              : items.length === 0
              ? (
                <tr>
                  <td colSpan={5} className="px-3 py-6 text-center text-sm" style={{ color: 'var(--bodhion-text-secondary)' }}>
                    No feedback found.
                  </td>
                </tr>
              )
              : items.map((fb) => {
                const badge = ratingLabel(fb.data?.rating);
                return (
                  <tr
                    key={fb.id}
                    className="admin-table-row cursor-pointer"
                    onClick={() => setSelected(fb)}
                  >
                    {/* User avatar */}
                    <td className="px-3 py-2 text-center">
                      <div className="flex justify-center">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={`/api/v1/users/${fb.user.id}/profile/image`}
                          alt={fb.user.name ?? fb.user.id}
                          title={fb.user.name ?? fb.user.id}
                          className="h-6 w-6 rounded-full object-cover shrink-0"
                          onError={(e) => { (e.currentTarget as HTMLImageElement).src = '/favicon.png'; }}
                        />
                      </div>
                    </td>
                    {/* Model */}
                    <td className="px-3 py-2">
                      <div className="flex flex-col">
                        <span className="font-medium line-clamp-1" style={{ color: 'var(--bodhion-text-primary)' }}>
                          {fb.data?.model_id ?? '—'}
                        </span>
                        {fb.data?.sibling_model_ids && fb.data.sibling_model_ids.length > 0 && (
                          <span className="text-[0.65rem] line-clamp-1" style={{ color: 'var(--bodhion-text-secondary)' }}>
                            {fb.data.sibling_model_ids.length > 2
                              ? `${fb.data.sibling_model_ids.slice(0, 2).join(', ')}, +${fb.data.sibling_model_ids.length - 2} more`
                              : fb.data.sibling_model_ids.join(', ')
                            }
                          </span>
                        )}
                      </div>
                    </td>
                    {/* Result badge */}
                    <td className="px-3 py-2 text-right">
                      {badge ? (
                        <span
                          className="inline-block rounded-full px-2 py-0.5 text-xs font-medium"
                          style={{ color: badge.color, background: badge.bg, border: `1px solid ${badge.border}` }}
                        >
                          {badge.label}
                        </span>
                      ) : '—'}
                    </td>
                    {/* Updated at */}
                    <td className="px-3 py-2 text-right text-xs" style={{ color: 'var(--bodhion-text-secondary)' }}>
                      {timeAgo(fb.updated_at)}
                    </td>
                    {/* Delete */}
                    <td className="px-3 py-2 text-right" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={() => setDeleteTarget(fb.id)}
                        className="rounded p-1 text-xs transition-colors"
                        style={{ color: 'var(--bodhion-text-secondary)' }}
                        title="Delete"
                      >
                        ✕
                      </button>
                    </td>
                  </tr>
                );
              })}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {total > PER_PAGE && (
        <div className="mt-3">
          <AdminPagination
            page={page}
            total={total}
            pageSize={PER_PAGE}
            onChange={setPage}
          />
        </div>
      )}

      {/* Modals */}
      <FeedbackModal
        feedback={selected}
        onClose={() => setSelected(null)}
      />
      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete feedback"
        description="This action cannot be undone."
        confirmLabel="Delete"
        variant="destructive"
        loading={deleteLoading}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </>
  );
}

export default FeedbackList;
