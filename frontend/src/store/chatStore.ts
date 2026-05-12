// ─── Chat store ───────────────────────────────────────────────────────────────
// Mirrors: chatId, chatTitle, chats, pinnedChats, tags, folders, selectedFolder,
// temporaryChatEnabled, showControls, systemPrompt, advancedParams.

import { create } from 'zustand';
import type { Chat, ChatTag, ChatFolder } from '@/types/chat';

export interface AdvancedParams {
  temperature: number | null;
  top_p: number | null;
  frequency_penalty: number | null;
  max_tokens: number | null;
  seed: number | null;
}

const defaultAdvancedParams = (): AdvancedParams => ({
  temperature: null,
  top_p: null,
  frequency_penalty: null,
  max_tokens: null,
  seed: null,
});

interface ChatState {
  chatId: string;
  chatTitle: string;
  chats: Chat[] | null;
  pinnedChats: Chat[];
  tags: ChatTag[];
  folders: ChatFolder[];
  selectedFolder: ChatFolder | null;

  // ── Temp chat ──────────────────────────────────────────────────────────────
  temporaryChatEnabled: boolean;
  setTemporaryChatEnabled: (val: boolean) => void;

  // ── Controls panel ─────────────────────────────────────────────────────────
  showControls: boolean;
  toggleControls: () => void;
  setShowControls: (val: boolean) => void;
  systemPrompt: string;
  setSystemPrompt: (v: string) => void;
  advancedParams: AdvancedParams;
  setAdvancedParam: <K extends keyof AdvancedParams>(key: K, value: AdvancedParams[K]) => void;
  resetAdvancedParams: () => void;

  setChatId: (id: string) => void;
  setChatTitle: (title: string) => void;
  setChats: (chats: Chat[] | null) => void;
  setPinnedChats: (chats: Chat[]) => void;
  setTags: (tags: ChatTag[]) => void;
  setFolders: (folders: ChatFolder[]) => void;
  setSelectedFolder: (folder: ChatFolder | null) => void;
}

export const useChatStore = create<ChatState>((set) => ({
  chatId: '',
  chatTitle: '',
  chats: null,
  pinnedChats: [],
  tags: [],
  folders: [],
  selectedFolder: null,

  temporaryChatEnabled: false,
  setTemporaryChatEnabled: (temporaryChatEnabled) => set({ temporaryChatEnabled }),

  showControls: false,
  toggleControls: () => set((s) => ({ showControls: !s.showControls })),
  setShowControls: (showControls) => set({ showControls }),
  systemPrompt: '',
  setSystemPrompt: (systemPrompt) => set({ systemPrompt }),
  advancedParams: defaultAdvancedParams(),
  setAdvancedParam: (key, value) =>
    set((s) => ({ advancedParams: { ...s.advancedParams, [key]: value } })),
  resetAdvancedParams: () => set({ advancedParams: defaultAdvancedParams() }),

  setChatId: (chatId) => set({ chatId }),
  setChatTitle: (chatTitle) => set({ chatTitle }),
  setChats: (chats) => set({ chats }),
  setPinnedChats: (pinnedChats) => set({ pinnedChats }),
  setTags: (tags) => set({ tags }),
  setFolders: (folders) => set({ folders }),
  setSelectedFolder: (selectedFolder) => set({ selectedFolder }),
}));
