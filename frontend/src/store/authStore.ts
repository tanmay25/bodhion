// ─── Auth store ───────────────────────────────────────────────────────────────
// Mirrors the `user`, `config`, `WEBUI_NAME`, `WEBUI_VERSION` Svelte writables.

import { create } from 'zustand';
import type { SessionUser } from '@/types/auth';
import type { BackendConfig } from '@/types/config';
import { APP_NAME } from '@/lib/constants';

interface AuthState {
  user: SessionUser | null | undefined; // undefined = not yet loaded
  config: BackendConfig | null;
  webuiName: string;
  webuiVersion: string | null;
  webuiDeploymentId: string | null;

  setUser: (user: SessionUser | null | undefined) => void;
  setConfig: (config: BackendConfig | null) => void;
  setWebuiName: (name: string) => void;
  setWebuiVersion: (version: string) => void;
  setWebuiDeploymentId: (id: string) => void;
  clearAuth: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: undefined,
  config: null,
  webuiName: APP_NAME,
  webuiVersion: null,
  webuiDeploymentId: null,

  setUser: (user) => set({ user }),
  setConfig: (config) => set({ config }),
  setWebuiName: (webuiName) => set({ webuiName }),
  setWebuiVersion: (webuiVersion) => set({ webuiVersion }),
  setWebuiDeploymentId: (webuiDeploymentId) => set({ webuiDeploymentId }),
  clearAuth: () => set({ user: null }),
}));
