'use client';

import { useEffect, useState } from 'react';
import { Tag } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/Modal';
import { ActivityChart } from '../ActivityChart';
import { getToken } from '@/lib/auth/session';
import { getModelHistory, type ModelHistoryItem } from '@/lib/api/admin/evaluations';

interface LeaderboardModel {
  id:       string;
  name:     string;
  rating:   number | null;
  won:      number;
  lost:     number;
  top_tags: { tag: string; count: number }[];
}

interface LeaderboardModalProps {
  model:   LeaderboardModel | null;
  onClose: () => void;
}

type TimeRange = '30d' | '1y' | 'all';

const TIME_RANGES: { key: TimeRange; label: string; days: number }[] = [
  { key: '30d', label: '30D', days: 30  },
  { key: '1y',  label: '1Y',  days: 365 },
  { key: 'all', label: 'All', days: 0   },
];

export function LeaderboardModal({ model, onClose }: LeaderboardModalProps) {
  const open = !!model;

  const [range,    setRange]    = useState<TimeRange>('30d');
  const [history,  setHistory]  = useState<ModelHistoryItem[]>([]);
  const [loading,  setLoading]  = useState(false);

  const loadHistory = async (days: number) => {
    if (!model?.id) return;
    setLoading(true);
    const token = getToken();
    if (!token) { setLoading(false); return; }
    try {
      const res = await getModelHistory(token, model.id, days);
      setHistory(res?.history ?? []);
    } catch {
      setHistory([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!model) return;
    const cfg = TIME_RANGES.find((r) => r.key === range)!;
    loadHistory(cfg.days);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [model, range]);

  // Reset range when a new model is opened
  useEffect(() => {
    if (model) setRange('30d');
  }, [model?.id]);

  const aggregateWeekly = range === '1y' || range === 'all';
  const topTags = model?.top_tags ?? [];

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="admin-dialog flex max-h-[90vh] flex-col sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="truncate pr-6">{model?.name ?? model?.id}</DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto flex flex-col gap-5 pr-1">
          {/* Stats row */}
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: 'Rating', value: model?.rating ?? '—', color: 'var(--bodhion-text-primary)' },
              { label: 'Won',    value: model?.won ?? 0,      color: 'rgba(52,211,153,0.9)'       },
              { label: 'Lost',   value: model?.lost ?? 0,     color: 'rgba(248,113,113,0.9)'      },
            ].map(({ label, value, color }) => (
              <div
                key={label}
                className="flex flex-col gap-1 rounded-lg p-3 text-center"
                style={{ background: 'var(--bodhion-search-bg)', border: '1px solid var(--bodhion-card-border)' }}
              >
                <span className="text-xs uppercase tracking-wide" style={{ color: 'var(--bodhion-text-secondary)' }}>
                  {label}
                </span>
                <span className="text-lg font-semibold tabular-nums" style={{ color }}>
                  {typeof value === 'number' ? value.toLocaleString() : value}
                </span>
              </div>
            ))}
          </div>

          {/* Activity chart */}
          <div>
            <div className="mb-2 flex items-center justify-between">
              <p className="admin-section-label">Activity</p>
              {/* Range picker */}
              <div
                className="inline-flex rounded-full p-0.5"
                style={{ background: 'var(--bodhion-search-bg)', border: '1px solid var(--bodhion-search-border)' }}
              >
                {TIME_RANGES.map((r) => (
                  <button
                    key={r.key}
                    type="button"
                    onClick={() => setRange(r.key)}
                    className="rounded-full px-2.5 py-0.5 text-xs font-medium transition-all"
                    style={
                      range === r.key
                        ? { background: 'rgba(37,215,255,0.15)', color: 'rgba(37,215,255,0.9)' }
                        : { color: 'var(--bodhion-text-secondary)' }
                    }
                  >
                    {r.label}
                  </button>
                ))}
              </div>
            </div>
            <ActivityChart history={history} loading={loading} aggregateWeekly={aggregateWeekly} />
          </div>

          {/* Tags */}
          <div>
            <p className="admin-section-label mb-2 flex items-center gap-1.5">
              <Tag className="h-3 w-3" /> Tags
            </p>
            {topTags.length === 0 ? (
              <span className="text-sm" style={{ color: 'var(--bodhion-text-secondary)' }}>—</span>
            ) : (
              <div className="flex flex-wrap gap-2">
                {topTags.map(({ tag, count }) => (
                  <span
                    key={tag}
                    className="flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium"
                    style={{
                      background: 'rgba(37,215,255,0.1)',
                      color:      'rgba(37,215,255,0.9)',
                      border:     '1px solid rgba(37,215,255,0.2)',
                    }}
                  >
                    {tag}
                    <span className="opacity-60">· {count}</span>
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default LeaderboardModal;
