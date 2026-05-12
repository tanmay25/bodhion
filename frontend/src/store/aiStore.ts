// ─── AI / streaming store ─────────────────────────────────────────────────────
// Holds live streaming state per chat session.

import { create } from 'zustand';
import type { TextStreamUpdate } from '@/types/chat';

interface StreamSession {
  content: string;
  isStreaming: boolean;
  error: unknown | null;
  sources: unknown[];
  usage: TextStreamUpdate['usage'] | null;
  abort: AbortController | null;
}

interface AIState {
  /** Keyed by a session ID (usually the message ID being generated). */
  sessions: Record<string, StreamSession>;
  socketId: string | null;

  startSession: (id: string, controller: AbortController) => void;
  appendContent: (id: string, chunk: string) => void;
  setSources: (id: string, sources: unknown[]) => void;
  setUsage: (id: string, usage: TextStreamUpdate['usage']) => void;
  finishSession: (id: string) => void;
  failSession: (id: string, error: unknown) => void;
  clearSession: (id: string) => void;
  setSocketId: (id: string | null) => void;
}

const emptySession = (): StreamSession => ({
  content: '',
  isStreaming: false,
  error: null,
  sources: [],
  usage: null,
  abort: null,
});

export const useAIStore = create<AIState>((set) => ({
  sessions: {},
  socketId: null,

  startSession: (id, controller) =>
    set((s) => ({
      sessions: {
        ...s.sessions,
        [id]: { ...emptySession(), isStreaming: true, abort: controller },
      },
    })),

  appendContent: (id, chunk) =>
    set((s) => ({
      sessions: {
        ...s.sessions,
        [id]: { ...s.sessions[id], content: (s.sessions[id]?.content ?? '') + chunk },
      },
    })),

  setSources: (id, sources) =>
    set((s) => ({ sessions: { ...s.sessions, [id]: { ...s.sessions[id], sources } } })),

  setUsage: (id, usage) =>
    set((s) => ({ sessions: { ...s.sessions, [id]: { ...s.sessions[id], usage } } })),

  finishSession: (id) =>
    set((s) => ({
      sessions: { ...s.sessions, [id]: { ...s.sessions[id], isStreaming: false, abort: null } },
    })),

  failSession: (id, error) =>
    set((s) => ({
      sessions: {
        ...s.sessions,
        [id]: { ...s.sessions[id], isStreaming: false, error, abort: null },
      },
    })),

  clearSession: (id) =>
    set((s) => {
      const next = { ...s.sessions };
      delete next[id];
      return { sessions: next };
    }),

  setSocketId: (socketId) => set({ socketId }),
}));
