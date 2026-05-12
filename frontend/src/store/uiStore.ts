// ─── UI store ─────────────────────────────────────────────────────────────────
// Mirrors the UI-related Svelte writables: showSidebar, showSettings,
// showSearch, showShortcuts, showControls, mobile, theme, sidebarWidth, etc.

import { create } from 'zustand';
import { DEFAULT_SIDEBAR_WIDTH } from '@/lib/constants';

interface UIState {
  mobile: boolean;
  theme: string;
  sidebarWidth: number;

  // Panel / modal visibility (mirrors Svelte showXxx stores)
  showSidebar: boolean;
  showSearch: boolean;
  showSettings: boolean;
  showShortcuts: boolean;
  showChangelog: boolean;
  showArchivedChats: boolean;

  // Chat UI panels
  showControls: boolean;
  showEmbeds: boolean;
  showOverview: boolean;
  showArtifacts: boolean;
  showCallOverlay: boolean;
  showFileNav: boolean;
  showFileNavPath: string | null;
  showFileNavDir: string | null;

  isLastActiveTab: boolean;
  playingNotificationSound: boolean;
  temporaryChatEnabled: boolean;
  scrollPaginationEnabled: boolean;
  currentChatPage: number;

  // Setters
  setMobile: (v: boolean) => void;
  setTheme: (v: string) => void;
  setSidebarWidth: (v: number) => void;
  toggleSidebar: () => void;
  setShowSidebar: (v: boolean) => void;
  setShowSearch: (v: boolean) => void;
  setShowSettings: (v: boolean) => void;
  setShowShortcuts: (v: boolean) => void;
  setShowChangelog: (v: boolean) => void;
  setShowArchivedChats: (v: boolean) => void;
  setShowControls: (v: boolean) => void;
  setShowEmbeds: (v: boolean) => void;
  setShowOverview: (v: boolean) => void;
  setShowArtifacts: (v: boolean) => void;
  setShowCallOverlay: (v: boolean) => void;
  setShowFileNav: (v: boolean) => void;
  setShowFileNavPath: (v: string | null) => void;
  setShowFileNavDir: (v: string | null) => void;
  setIsLastActiveTab: (v: boolean) => void;
  setPlayingNotificationSound: (v: boolean) => void;
  setTemporaryChatEnabled: (v: boolean) => void;
  setScrollPaginationEnabled: (v: boolean) => void;
  setCurrentChatPage: (v: number) => void;
}

export const useUIStore = create<UIState>((set) => ({
  mobile: false,
  theme: 'system',
  sidebarWidth: DEFAULT_SIDEBAR_WIDTH,
  showSidebar: true,
  showSearch: false,
  showSettings: false,
  showShortcuts: false,
  showChangelog: false,
  showArchivedChats: false,
  showControls: false,
  showEmbeds: false,
  showOverview: false,
  showArtifacts: false,
  showCallOverlay: false,
  showFileNav: false,
  showFileNavPath: null,
  showFileNavDir: null,
  isLastActiveTab: true,
  playingNotificationSound: false,
  temporaryChatEnabled: false,
  scrollPaginationEnabled: false,
  currentChatPage: 1,

  setMobile: (mobile) => set({ mobile }),
  setTheme: (theme) => set({ theme }),
  setSidebarWidth: (sidebarWidth) => set({ sidebarWidth }),
  toggleSidebar: () => set((s) => ({ showSidebar: !s.showSidebar })),
  setShowSidebar: (showSidebar) => set({ showSidebar }),
  setShowSearch: (showSearch) => set({ showSearch }),
  setShowSettings: (showSettings) => set({ showSettings }),
  setShowShortcuts: (showShortcuts) => set({ showShortcuts }),
  setShowChangelog: (showChangelog) => set({ showChangelog }),
  setShowArchivedChats: (showArchivedChats) => set({ showArchivedChats }),
  setShowControls: (showControls) => set({ showControls }),
  setShowEmbeds: (showEmbeds) => set({ showEmbeds }),
  setShowOverview: (showOverview) => set({ showOverview }),
  setShowArtifacts: (showArtifacts) => set({ showArtifacts }),
  setShowCallOverlay: (showCallOverlay) => set({ showCallOverlay }),
  setShowFileNav: (showFileNav) => set({ showFileNav }),
  setShowFileNavPath: (showFileNavPath) => set({ showFileNavPath }),
  setShowFileNavDir: (showFileNavDir) => set({ showFileNavDir }),
  setIsLastActiveTab: (isLastActiveTab) => set({ isLastActiveTab }),
  setPlayingNotificationSound: (playingNotificationSound) => set({ playingNotificationSound }),
  setTemporaryChatEnabled: (temporaryChatEnabled) => set({ temporaryChatEnabled }),
  setScrollPaginationEnabled: (scrollPaginationEnabled) => set({ scrollPaginationEnabled }),
  setCurrentChatPage: (currentChatPage) => set({ currentChatPage }),
}));
