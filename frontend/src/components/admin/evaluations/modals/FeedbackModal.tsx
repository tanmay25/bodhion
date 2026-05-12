'use client';

import { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/Modal';
import { getToken } from '@/lib/auth/session';
import {
  getFeedbackById,
  type FeedbackItem,
} from '@/lib/api/admin/evaluations';

interface FeedbackModalProps {
  feedback: FeedbackItem | null;
  onClose:  () => void;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs" style={{ color: 'var(--bodhion-text-secondary)' }}>{label}</span>
      <div className="text-sm break-words" style={{ color: 'var(--bodhion-text-primary)' }}>
        {children}
      </div>
    </div>
  );
}

export function FeedbackModal({ feedback, onClose }: FeedbackModalProps) {
  const open = !!feedback;

  const [detail,  setDetail]  = useState<FeedbackItem | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!feedback) { setDetail(null); return; }
    setLoading(true);
    const token = getToken();
    if (!token) { setLoading(false); return; }
    getFeedbackById(token, feedback.id)
      .then((d) => setDetail(d))
      .catch(() => setDetail(null))
      .finally(() => setLoading(false));
  }, [feedback?.id]);

  // Extract prompt + response from snapshot
  const messages  = detail?.snapshot?.chat?.chat?.history?.messages ?? {};
  const messageId = detail?.meta?.message_id ?? '';
  const msg       = messages[messageId];
  const parent    = msg?.parentId ? messages[msg.parentId] : undefined;

  const tags = feedback?.data?.tags ?? [];

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="admin-dialog flex max-h-[90vh] flex-col sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Feedback Details</DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto flex flex-col gap-4 pr-1">
          {loading ? (
            <div className="flex flex-col gap-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex flex-col gap-1">
                  <div className="h-3 w-16 animate-pulse rounded" style={{ background: 'var(--bodhion-search-bg)' }} />
                  <div className="h-4 w-full animate-pulse rounded" style={{ background: 'var(--bodhion-search-bg)' }} />
                </div>
              ))}
            </div>
          ) : (
            <>
              {/* Chat ID */}
              <Field label="Chat ID">
                {feedback?.meta?.chat_id ? (
                  <a
                    href={`/s/${feedback.meta.chat_id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline underline-offset-2"
                    style={{ color: 'rgba(37,215,255,0.9)' }}
                  >
                    {feedback.meta.chat_id}
                  </a>
                ) : '—'}
              </Field>

              {/* Prompt */}
              {parent && (
                <Field label="Prompt">
                  <span className="whitespace-pre-line">{parent.content || '—'}</span>
                </Field>
              )}

              {/* Response */}
              {msg && (
                <Field label="Response">
                  <span
                    className="block max-h-32 overflow-y-auto whitespace-pre-line rounded-lg p-2"
                    style={{ background: 'var(--bodhion-search-bg)' }}
                  >
                    {msg.content || '—'}
                  </span>
                </Field>
              )}

              {/* Rating */}
              <Field label="Rating">
                {feedback?.data?.details?.rating ?? feedback?.data?.rating ?? '—'}
              </Field>

              {/* Reason */}
              <Field label="Reason">
                {feedback?.data?.reason || '—'}
              </Field>

              {/* Comment */}
              <Field label="Comment">
                {feedback?.data?.comment || '—'}
              </Field>

              {/* Tags */}
              {tags.length > 0 && (
                <div className="flex flex-col gap-1">
                  <span className="text-xs" style={{ color: 'var(--bodhion-text-secondary)' }}>Tags</span>
                  <div className="flex flex-wrap gap-1.5">
                    {tags.map((tag) => (
                      <span
                        key={tag}
                        className="rounded-full px-2 py-0.5 text-xs"
                        style={{
                          background: 'var(--bodhion-search-bg)',
                          color:      'var(--bodhion-text-secondary)',
                          border:     '1px solid var(--bodhion-card-border)',
                        }}
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default FeedbackModal;
