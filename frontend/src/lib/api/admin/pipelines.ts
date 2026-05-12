// ─── Admin: Pipelines API ─────────────────────────────────────────────────────
import { apiFetch, WEBUI_API_BASE } from '@/lib/api/client';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface Pipeline {
  id:      string;
  name:    string;
  type?:   string;
  valves?: boolean;
}

export interface PipelineServer {
  url: string;
}

// ── Server list ───────────────────────────────────────────────────────────────

export const getPipelinesList = (token: string) =>
  apiFetch<{ pipelines: PipelineServer[] }>(`${WEBUI_API_BASE}/pipelines/list`, { token });

// ── Pipelines on a server ─────────────────────────────────────────────────────

export const getPipelines = (token: string, urlIdx: string) =>
  apiFetch<{ data: Pipeline[] }>(
    `${WEBUI_API_BASE}/pipelines?url_idx=${encodeURIComponent(urlIdx)}`,
    { token }
  );

// ── Valves ────────────────────────────────────────────────────────────────────

export const getPipelineValvesSpec = (token: string, pipelineId: string, urlIdx: string) =>
  apiFetch<Record<string, unknown>>(
    `${WEBUI_API_BASE}/pipelines/${encodeURIComponent(pipelineId)}/valves/spec?url_idx=${encodeURIComponent(urlIdx)}`,
    { token }
  );

export const getPipelineValves = (token: string, pipelineId: string, urlIdx: string) =>
  apiFetch<Record<string, unknown>>(
    `${WEBUI_API_BASE}/pipelines/${encodeURIComponent(pipelineId)}/valves?url_idx=${encodeURIComponent(urlIdx)}`,
    { token }
  );

export const updatePipelineValves = (
  token:      string,
  pipelineId: string,
  valves:     Record<string, unknown>,
  urlIdx:     string,
) =>
  apiFetch<Record<string, unknown>>(
    `${WEBUI_API_BASE}/pipelines/${encodeURIComponent(pipelineId)}/valves/update?url_idx=${encodeURIComponent(urlIdx)}`,
    { token, method: 'POST', body: valves }
  );

// ── Pipeline management ───────────────────────────────────────────────────────

export const uploadPipeline = (token: string, formData: FormData, urlIdx: string) =>
  fetch(`${WEBUI_API_BASE}/pipelines/upload?url_idx=${encodeURIComponent(urlIdx)}`, {
    method:  'POST',
    headers: { Authorization: `Bearer ${token}` },
    body:    formData,
  }).then((r) => r.json());

export const downloadPipeline = (token: string, url: string, urlIdx: string) =>
  apiFetch<Pipeline>(
    `${WEBUI_API_BASE}/pipelines/fetch?url=${encodeURIComponent(url)}&url_idx=${encodeURIComponent(urlIdx)}`,
    { token }
  );

export const deletePipeline = (token: string, pipelineId: string, urlIdx: string) =>
  apiFetch<{ success: boolean }>(
    `${WEBUI_API_BASE}/pipelines/${encodeURIComponent(pipelineId)}/delete?url_idx=${encodeURIComponent(urlIdx)}`,
    { token, method: 'DELETE' }
  );
