'use client';

import { useEffect, useState } from 'react';
import { MessageSquare, ExternalLink } from 'lucide-react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/Modal';
import { Spinner } from '@/components/ui/Spinner';
import { getToken } from '@/lib/auth/session';
import { adminGetUserChats, type UserChatItem } from '@/lib/api/admin/users';
import type { AdminUser } from '@/types/api';
import { cn } from '@/lib/utils/cn';

interface UserChatsModalProps {
  user:    AdminUser | null;
  open:    boolean;
  onClose: () => void;
}

function formatDate(ts: number) {
  return new Date(ts * 1000).toLocaleDateString(undefined, {
    year: 'numeric', month: 'short', day: 'numeric',
  });
}

export function UserChatsModal({ user, open, onClose }: UserChatsModalProps) {
  const [chats,   setChats]   = useState<UserChatItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [page,    setPage]    = useState(1);
  const [hasMore, setHasMore] = useState(false);

  useEffect(() => {
    if (!open || !user) return;
    setChats([]);
    setPage(1);
    setHasMore(false);
    loadChats(1, true);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, user?.id]);

  const loadChats = async (p: number, reset = false) => {
    const token = getToken();
    if (!token || !user) return;
    setLoading(true);
    try {
      const items = await adminGetUserChats(token, user.id, p);
      setChats((prev) => (reset ? items : [...prev, ...items]));
      setHasMore(items.length === 20); // assume page size 20
      setPage(p);
    } catch {
      // silently fail — modal should still close gracefully
    } finally {
      setLoading(false);
    }
  };

  if (!user) return null;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="flex max-h-[80vh] flex-col sm:max-w-lg">
        <DialogHeader className="shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <MessageSquare className="h-4 w-4 text-muted-foreground" />
            {user.name}&rsquo;s chats
          </DialogTitle>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {loading && chats.length === 0 ? (
            <div className="flex justify-center py-10">
              <Spinner size="md" />
            </div>
          ) : chats.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 py-10 text-center">
              <MessageSquare className="h-8 w-8 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">No chats found for this user.</p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {chats.map((chat) => (
                <div
                  key={chat.id}
                  className="flex items-center justify-between gap-3 px-1 py-3"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-foreground">
                      {chat.title || 'Untitled chat'}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Updated {formatDate(chat.updated_at)}
                    </p>
                  </div>
                  <a
                    href={`/chat-engine/c/${chat.id}`}
                    target="_blank"
                    rel="noreferrer"
                    className={cn(
                      'shrink-0 rounded-md p-1.5 text-muted-foreground',
                      'hover:bg-muted/50 hover:text-foreground transition-colors'
                    )}
                    title="Open chat"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                </div>
              ))}

              {/* Load more */}
              {hasMore && (
                <div className="py-3 text-center">
                  <button
                    onClick={() => loadChats(page + 1)}
                    disabled={loading}
                    className="text-sm text-primary hover:underline disabled:opacity-50"
                  >
                    {loading ? 'Loading…' : 'Load more'}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default UserChatsModal;
