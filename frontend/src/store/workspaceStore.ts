// ─── Workspace store ──────────────────────────────────────────────────────────
// Mirrors: models, knowledge, tools, skills, functions, banners, settings,
//          toolServers, terminalServers.

import { create } from 'zustand';
import type { Model } from '@/types/models';
import type { KnowledgeDocument } from '@/types/api';
import type { Tool, Skill, FunctionItem } from '@/types/api';
import type { Banner, UserSettings, ToolServerConfig, TerminalServerConfig } from '@/types/config';

interface WorkspaceState {
  models: Model[];
  knowledge: KnowledgeDocument[] | null;
  tools: Tool[] | null;
  skills: Skill[] | null;
  functions: FunctionItem[] | null;
  banners: Banner[];
  settings: UserSettings;
  toolServers: ToolServerConfig[];
  terminalServers: TerminalServerConfig[];

  setModels: (models: Model[]) => void;
  setKnowledge: (knowledge: KnowledgeDocument[] | null) => void;
  setTools: (tools: Tool[] | null) => void;
  setSkills: (skills: Skill[] | null) => void;
  setFunctions: (functions: FunctionItem[] | null) => void;
  setBanners: (banners: Banner[]) => void;
  setSettings: (settings: UserSettings) => void;
  patchSettings: (patch: Partial<UserSettings>) => void;
  setToolServers: (servers: ToolServerConfig[]) => void;
  setTerminalServers: (servers: TerminalServerConfig[]) => void;
}

export const useWorkspaceStore = create<WorkspaceState>((set) => ({
  models: [],
  knowledge: null,
  tools: null,
  skills: null,
  functions: null,
  banners: [],
  settings: {},
  toolServers: [],
  terminalServers: [],

  setModels: (models) => set({ models }),
  setKnowledge: (knowledge) => set({ knowledge }),
  setTools: (tools) => set({ tools }),
  setSkills: (skills) => set({ skills }),
  setFunctions: (functions) => set({ functions }),
  setBanners: (banners) => set({ banners }),
  setSettings: (settings) => set({ settings }),
  patchSettings: (patch) => set((s) => ({ settings: { ...s.settings, ...patch } })),
  setToolServers: (toolServers) => set({ toolServers }),
  setTerminalServers: (terminalServers) => set({ terminalServers }),
}));
