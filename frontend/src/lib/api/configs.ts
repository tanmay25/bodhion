// ─── Configs / Banners / Analytics / Evaluations API ─────────────────────────
import { apiFetch, WEBUI_API_BASE, AUDIO_BASE } from './client';
import type { Banner, DirectConnections } from '@/types/config';

// ── Direct Connections ────────────────────────────────────────────────────────
export const getConnectionsConfig = (token: string) =>
  apiFetch<DirectConnections>(`${WEBUI_API_BASE}/configs/connections`, { token });

export const setConnectionsConfig = (token: string, config: DirectConnections) =>
  apiFetch<DirectConnections>(`${WEBUI_API_BASE}/configs/connections`, {
    method: 'POST',
    body: { ...config },
    token,
  });
import type { AnalyticsSummary, Service } from '@/types/api';

export const getBanners = (token: string) =>
  apiFetch<Banner[]>(`${WEBUI_API_BASE}/configs/banners`, { token });

export const getConfig = (token: string) =>
  apiFetch<Record<string, unknown>>(`${WEBUI_API_BASE}/configs/`, { token });

export const updateConfig = (token: string, body: Record<string, unknown>) =>
  apiFetch<Record<string, unknown>>(`${WEBUI_API_BASE}/configs/`, {
    method: 'POST',
    body,
    token,
  });

// ── Analytics ────────────────────────────────────────────────────────────────
export const getAnalyticsSummary = (token: string) =>
  apiFetch<AnalyticsSummary>(`${WEBUI_API_BASE}/analytics/`, { token });

export const getAnalyticsUsers = (token: string, params?: Record<string, string>) => {
  const q = params ? `?${new URLSearchParams(params)}` : '';
  return apiFetch<unknown>(`${WEBUI_API_BASE}/analytics/users${q}`, { token });
};

export const getAnalyticsModels = (token: string, params?: Record<string, string>) => {
  const q = params ? `?${new URLSearchParams(params)}` : '';
  return apiFetch<unknown>(`${WEBUI_API_BASE}/analytics/models${q}`, { token });
};

// ── Evaluations ──────────────────────────────────────────────────────────────
export const getEvaluationFeedbacks = (token: string) =>
  apiFetch<unknown[]>(`${WEBUI_API_BASE}/evaluations/feedbacks`, { token });

export const getEvaluationLeaderboard = (token: string) =>
  apiFetch<unknown[]>(`${WEBUI_API_BASE}/evaluations/leaderboard`, { token });

// ── Groups ───────────────────────────────────────────────────────────────────
export const getGroups = (token: string) =>
  apiFetch<unknown[]>(`${WEBUI_API_BASE}/groups/`, { token });

export const createGroup = (token: string, body: { name: string; description?: string }) =>
  apiFetch<unknown>(`${WEBUI_API_BASE}/groups/create`, { method: 'POST', body, token });

export const updateGroup = (token: string, id: string, body: Record<string, unknown>) =>
  apiFetch<unknown>(`${WEBUI_API_BASE}/groups/${id}`, { method: 'POST', body, token });

export const deleteGroup = (token: string, id: string) =>
  apiFetch<{ success: boolean }>(`${WEBUI_API_BASE}/groups/${id}`, { method: 'DELETE', token });

// ── Files ─────────────────────────────────────────────────────────────────────
export const uploadFile = async (token: string, file: File) => {
  const formData = new FormData();
  formData.append('file', file);
  const response = await fetch(`${WEBUI_API_BASE}/files/`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: formData,
    credentials: 'include',
  });
  if (!response.ok) throw await response.json();
  return response.json();
};

export const getFileById = (token: string, id: string) =>
  apiFetch<unknown>(`${WEBUI_API_BASE}/files/${id}`, { token });

export const deleteFile = (token: string, id: string) =>
  apiFetch<{ success: boolean }>(`${WEBUI_API_BASE}/files/${id}`, { method: 'DELETE', token });

// ── Services ─────────────────────────────────────────────────────────────────
export const getServices = (token: string) =>
  apiFetch<Service[]>(`${WEBUI_API_BASE}/services/list`, { token });

// ── Memories ─────────────────────────────────────────────────────────────────

export interface Memory {
  id: string;
  content: string;
  updated_at: number; // Unix seconds
  created_at?: number;
}

export const getMemories = (token: string) =>
  apiFetch<Memory[]>(`${WEBUI_API_BASE}/memories/`, { token });

export const addMemory = (token: string, content: string) =>
  apiFetch<Memory>(`${WEBUI_API_BASE}/memories/add`, { method: 'POST', body: { content }, token });

export const updateMemory = (token: string, id: string, content: string) =>
  apiFetch<Memory>(`${WEBUI_API_BASE}/memories/${id}/update`, { method: 'POST', body: { content }, token });

export const deleteMemory = (token: string, id: string) =>
  apiFetch<{ success: boolean }>(`${WEBUI_API_BASE}/memories/${id}`, { method: 'DELETE', token });

export const deleteAllMemories = (token: string) =>
  apiFetch<{ success: boolean }>(`${WEBUI_API_BASE}/memories/delete/user`, { method: 'DELETE', token });

// ── Audio ─────────────────────────────────────────────────────────────────────
export const getAudioVoices = (token: string) =>
  apiFetch<{ voices: { id: string; name: string }[] }>(`${AUDIO_BASE}/voices`, { token });

// ── Terminal Servers ─────────────────────────────────────────────────────────
export const getTerminalServers = (token: string) =>
  apiFetch<unknown[]>(`${WEBUI_API_BASE}/terminals/`, { token });

// ── Tasks ─────────────────────────────────────────────────────────────────────
export const getTitleGeneration = (token: string, body: Record<string, unknown>) =>
  apiFetch<{ title: string }>(`${WEBUI_API_BASE}/tasks/title/completions`, {
    method: 'POST',
    body,
    token,
  });
