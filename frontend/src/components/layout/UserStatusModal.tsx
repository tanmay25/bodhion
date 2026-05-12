'use client';

import { useEffect, useRef, useState } from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import * as PopoverPrimitive from '@radix-ui/react-popover';
import { X, Smile } from 'lucide-react';
import { toast } from 'sonner';
import dynamic from 'next/dynamic';
import { useAuthStore } from '@/store/authStore';
import { getToken } from '@/lib/auth/session';
import { updateUserStatus, getSessionUser } from '@/lib/api/auth';

// Dynamically import the picker so its large dataset doesn't bloat the initial bundle
const EmojiPicker = dynamic(
  () => import('@emoji-mart/react').then((m) => m.default as React.ComponentType<EmojiPickerProps>),
  { ssr: false, loading: () => <div className="emoji-picker-loading">Loading…</div> }
);

interface EmojiPickerProps {
  data: unknown;
  onEmojiSelect: (emoji: { native: string }) => void;
  theme?: 'light' | 'dark' | 'auto';
  previewPosition?: 'none' | 'bottom' | 'top';
  skinTonePosition?: 'none' | 'preview' | 'search';
  set?: string;
  locale?: string;
  searchPosition?: 'sticky' | 'static' | 'none';
  navPosition?: 'top' | 'bottom' | 'none';
  perLine?: number;
}

// Import emoji-mart data asynchronously to avoid SSR issues
let emojiData: unknown = null;
async function getEmojiData() {
  if (!emojiData) {
    emojiData = (await import('@emoji-mart/data')).default;
  }
  return emojiData;
}

interface Props {
  open: boolean;
  onClose: () => void;
}

export function UserStatusModal({ open, onClose }: Props) {
  const user = useAuthStore((s) => s.user);
  const setUser = useAuthStore((s) => s.setUser);

  const [emoji, setEmoji] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [data, setData] = useState<unknown>(null);

  const inputRef = useRef<HTMLInputElement>(null);

  // Pre-load emoji data once
  useEffect(() => {
    void getEmojiData().then(setData);
  }, []);

  // Initialise fields from current user status when modal opens
  useEffect(() => {
    if (open) {
      setEmoji(user?.status_emoji ?? '');
      setMessage(user?.status_message ?? '');
      setPickerOpen(false);
      setTimeout(() => inputRef.current?.focus(), 80);
    } else {
      setEmoji('');
      setMessage('');
      setLoading(false);
      setPickerOpen(false);
    }
  }, [open, user?.status_emoji, user?.status_message]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const token = getToken();
    if (!token) return;
    setLoading(true);
    try {
      await updateUserStatus(token, { status_emoji: emoji, status_message: message });
      const fresh = await getSessionUser(token).catch(() => null);
      if (fresh) setUser(fresh);
      toast.success('Status updated successfully');
      onClose();
    } catch (err) {
      toast.error(String((err as { detail?: string })?.detail ?? 'Failed to update status'));
    } finally {
      setLoading(false);
    }
  };

  const handleClear = () => {
    setEmoji('');
    setMessage('');
  };

  return (
    <DialogPrimitive.Root open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="status-modal-overlay" />
        <DialogPrimitive.Content className="status-modal" aria-describedby={undefined}>
          <DialogPrimitive.Title className="sr-only">Set your status</DialogPrimitive.Title>

          {/* Header */}
          <div className="status-modal-header">
            <span className="status-modal-title">Set your status</span>
            <DialogPrimitive.Close className="status-modal-close" aria-label="Close">
              <X className="h-4 w-4" />
            </DialogPrimitive.Close>
          </div>

          {/* Body */}
          <form className="status-modal-body" onSubmit={(e) => void handleSubmit(e)}>
            <div className="status-field-label">Status</div>

            <div className="status-input-row">
              {/* Emoji picker trigger */}
              <PopoverPrimitive.Root open={pickerOpen} onOpenChange={setPickerOpen}>
                <PopoverPrimitive.Trigger asChild>
                  <button
                    type="button"
                    className="status-emoji-btn"
                    aria-label="Pick an emoji"
                  >
                    {emoji ? (
                      <span className="status-emoji-char">{emoji}</span>
                    ) : (
                      <Smile className="h-5 w-5" />
                    )}
                  </button>
                </PopoverPrimitive.Trigger>

                <PopoverPrimitive.Portal>
                  <PopoverPrimitive.Content
                    className="status-emoji-popover"
                    side="bottom"
                    align="start"
                    sideOffset={8}
                    onInteractOutside={() => setPickerOpen(false)}
                  >
                    {Boolean(data) && (
                      <EmojiPicker
                        data={data}
                        onEmojiSelect={(em) => {
                          setEmoji(em.native);
                          setPickerOpen(false);
                          inputRef.current?.focus();
                        }}
                        theme="auto"
                        previewPosition="none"
                        skinTonePosition="none"
                        searchPosition="sticky"
                        navPosition="top"
                        perLine={8}
                      />
                    )}
                  </PopoverPrimitive.Content>
                </PopoverPrimitive.Portal>
              </PopoverPrimitive.Root>

              <input
                ref={inputRef}
                id="status-message"
                type="text"
                className="status-text-input"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="What's on your mind?"
                autoComplete="off"
              />

              {(emoji || message) && (
                <button
                  type="button"
                  className="status-clear-btn"
                  onClick={handleClear}
                  aria-label="Clear status"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            <div className="status-modal-footer">
              <button type="submit" className="status-save-btn" disabled={loading}>
                {loading ? 'Saving…' : 'Save'}
              </button>
            </div>
          </form>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
