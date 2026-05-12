// ─── Admin: Functions API ──────────────────────────────────────────────────────
import { apiFetch, WEBUI_API_BASE } from '@/lib/api/client';

// ── Types ──────────────────────────────────────────────────────────────────────

export interface FunctionMeta {
  description?: string;
  manifest?: {
    title?:       string;
    version?:     string;
    author?:      string;
    author_url?:  string;
    funding_url?: string;
  };
}

export interface FunctionUser {
  id?:       string;
  name?:     string;
  email?:    string;
  username?: string;
}

export interface AdminFunction {
  id:         string;
  user_id?:   string;
  name:       string;
  type:       'pipe' | 'filter' | 'action' | string;
  content:    string;
  meta:       FunctionMeta;
  is_active:  boolean;
  is_global:  boolean;
  user?:      FunctionUser;
  updated_at?: number;
  created_at?: number;
}

export interface ValveSpec {
  properties: Record<string, {
    type:        string;
    title?:      string;
    description?: string;
    default?:    unknown;
    enum?:       string[];
  }>;
  required?: string[];
}

// ── Endpoints ──────────────────────────────────────────────────────────────────

export const getFunctionList = (token: string) =>
  apiFetch<AdminFunction[]>(`${WEBUI_API_BASE}/functions/list`, { token });

export const getFunctionById = (token: string, id: string) =>
  apiFetch<AdminFunction>(`${WEBUI_API_BASE}/functions/id/${encodeURIComponent(id)}`, { token });

export const createFunction = (token: string, func: Partial<AdminFunction>) =>
  apiFetch<AdminFunction>(`${WEBUI_API_BASE}/functions/create`, {
    token, method: 'POST', body: func,
  });

export const updateFunctionById = (token: string, id: string, func: Partial<AdminFunction>) =>
  apiFetch<AdminFunction>(`${WEBUI_API_BASE}/functions/id/${encodeURIComponent(id)}/update`, {
    token, method: 'POST', body: func,
  });

export const deleteFunctionById = (token: string, id: string) =>
  apiFetch<{ id: string }>(`${WEBUI_API_BASE}/functions/id/${encodeURIComponent(id)}/delete`, {
    token, method: 'DELETE',
  });

export const toggleFunctionById = (token: string, id: string) =>
  apiFetch<AdminFunction>(`${WEBUI_API_BASE}/functions/id/${encodeURIComponent(id)}/toggle`, {
    token, method: 'POST',
  });

export const toggleGlobalById = (token: string, id: string) =>
  apiFetch<AdminFunction>(`${WEBUI_API_BASE}/functions/id/${encodeURIComponent(id)}/toggle/global`, {
    token, method: 'POST',
  });

export const exportFunctions = (token: string) =>
  apiFetch<AdminFunction[]>(`${WEBUI_API_BASE}/functions/export`, { token });

export const loadFunctionByUrl = (token: string, url: string) =>
  apiFetch<AdminFunction>(`${WEBUI_API_BASE}/functions/load/url`, {
    token, method: 'POST', body: { url },
  });

// ── Valves ─────────────────────────────────────────────────────────────────────

export const getFunctionValvesSpec = (token: string, id: string) =>
  apiFetch<ValveSpec>(`${WEBUI_API_BASE}/functions/id/${encodeURIComponent(id)}/valves/spec`, { token });

export const getFunctionValves = (token: string, id: string) =>
  apiFetch<Record<string, unknown>>(`${WEBUI_API_BASE}/functions/id/${encodeURIComponent(id)}/valves`, { token });

export const updateFunctionValves = (token: string, id: string, valves: Record<string, unknown>) =>
  apiFetch<Record<string, unknown>>(`${WEBUI_API_BASE}/functions/id/${encodeURIComponent(id)}/valves/update`, {
    token, method: 'POST', body: valves,
  });
