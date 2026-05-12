'use client';

import { useEffect, useState } from 'react';
import { MessageSquare, Tag } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/Modal';
import { LineChart } from '@/components/shared/LineChart';
import { getToken } from '@/lib/auth/session';
import {
  getModelOverview,
  getModelChats,
  type ModelOverviewHistory,
  type ModelChatItem,
} from '@/lib/api/admin/analytics';

interface ModelAnalyticsModalProps {
  modelId: string | null;
  onClose: () => void;
}

export function ModelAnalyticsModal({ modelId, onClose }: ModelAnalyticsModalProps) {
  const open = !!modelId;

  const [history,  setHistory]  = useState<ModelOverviewHistory[]>([]);
  const [tags,     setTags]     = useState<{ tag: string; count: number }[]>([]);
  const [chats,    setChats]    = useState<ModelChatItem[]>([]);
  const [loading,  setLoading]  = useState(false);

  useEffect(() => {
    if (!modelId) return;
    setLoading(true);
    setHistory([]); setTags([]); setChats([]);

    const token = getToken();
    if (!token) { setLoading(false); return; }

    Promise.all([
      getModelOverview(token, modelId, 30),
      getModelChats(token, modelId, { limit: 20 }),
    ])
      .then(([overview, chatsRes]) => {
        setHistory(overview.history ?? []);
        setTags(overview.tags ?? []);
        setChats(chatsRes.chats ?? []);
      })
      .catch(() => {/* silent – show empties */})
      .finally(() => setLoading(false));
  }, [modelId]);

  // Build chart data from won/lost history
  const chartLabels   = history.map((h) => h.date);
  const chartDatasets = [
    {
      label:           'Won',
      data:            history.map((h) => h.won),
      borderColor:     'rgba(52,211,153,0.9)',
      backgroundColor: 'rgba(52,211,153,0.12)',
    },
    {
      label:           'Lost',
      data:            history.map((h) => h.lost),
      borderColor:     'rgba(248,113,113,0.9)',
      backgroundColor: 'rgba(248,113,113,0.12)',
    },
  ];

  function formatDate(ts: number) {
    return new Date(ts * 1000).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="admin-dialog flex max-h-[90vh] flex-col sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between pr-6">
            <span className="truncate">{modelId}</span>
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto flex flex-col gap-5 pr-1">
          {/* Win/Loss chart */}
          <div>
            <p className="admin-section-label mb-2">Evaluation History (30d)</p>
            {loading ? (
              <div
                className="h-[180px] animate-pulse rounded-lg"
                style={{ background: 'var(--bodhion-search-bg)' }}
              />
            ) : history.length === 0 ? (
              <div
                className="flex h-[180px] items-center justify-center text-sm rounded-lg"
                style={{ color: 'var(--bodhion-text-secondary)', background: 'var(--bodhion-search-bg)' }}
              >
                No evaluation history.
              </div>
            ) : (
              <LineChart labels={chartLabels} datasets={chartDatasets} height={180} />
            )}
          </div>

          {/* Tags */}
          {(loading || tags.length > 0) && (
            <div>
              <p className="admin-section-label mb-2 flex items-center gap-1.5">
                <Tag className="h-3 w-3" /> Top Tags
              </p>
              {loading ? (
                <div className="flex flex-wrap gap-2">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <div
                      key={i}
                      className="h-6 w-16 animate-pulse rounded-full"
                      style={{ background: 'var(--bodhion-search-bg)' }}
                    />
                  ))}
                </div>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {tags.map(({ tag, count }) => (
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
          )}

          {/* Recent chats */}
          <div>
            <p className="admin-section-label mb-2 flex items-center gap-1.5">
              <MessageSquare className="h-3 w-3" /> Recent Chats
            </p>
            {loading ? (
              <div className="flex flex-col gap-2">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="flex flex-col gap-1">
                    <div className="h-4 w-3/4 animate-pulse rounded" style={{ background: 'var(--bodhion-search-bg)' }} />
                    <div className="h-3 w-1/3 animate-pulse rounded" style={{ background: 'var(--bodhion-search-bg)' }} />
                  </div>
                ))}
              </div>
            ) : chats.length === 0 ? (
              <p className="text-sm" style={{ color: 'var(--bodhion-text-secondary)' }}>
                No chats found.
              </p>
            ) : (
              <div
                className="flex flex-col divide-y rounded-lg overflow-hidden"
                style={{ borderColor: 'var(--bodhion-card-border)', border: '1px solid var(--bodhion-card-border)' }}
              >
                {chats.map((chat) => (
                  <a
                    key={chat.chat_id}
                    href={`/chat-engine/c/${chat.chat_id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex flex-col gap-0.5 px-3 py-2.5 transition-colors hover:bg-[rgba(37,215,255,0.05)]"
                    style={{ borderColor: 'var(--bodhion-card-border)' }}
                  >
                    <span
                      className="truncate text-sm font-medium"
                      style={{ color: 'var(--bodhion-text-primary)' }}
                    >
                      {chat.first_message || '(empty)'}
                    </span>
                    <span className="text-xs" style={{ color: 'var(--bodhion-text-secondary)' }}>
                      {chat.user_name} · {formatDate(chat.updated_at)}
                    </span>
                  </a>
                ))}
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default ModelAnalyticsModal;
