// ─── Channel store ────────────────────────────────────────────────────────────
// Mirrors: channels, channelId Svelte writables.

import { create } from 'zustand';
import type { Channel } from '@/types/api';

interface ChannelState {
  channels: Channel[];
  channelId: string | null;
  setChannels: (channels: Channel[]) => void;
  setChannelId: (id: string | null) => void;
  updateChannelUnread: (id: string, delta: number) => void;
}

export const useChannelStore = create<ChannelState>((set) => ({
  channels: [],
  channelId: null,
  setChannels: (channels) => set({ channels }),
  setChannelId: (channelId) => set({ channelId }),
  updateChannelUnread: (id, delta) =>
    set((s) => ({
      channels: s.channels.map((ch) =>
        ch.id === id ? { ...ch, unread_count: (ch.unread_count ?? 0) + delta } : ch
      ),
    })),
}));
