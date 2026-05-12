// ─── Ollama API ────────────────────────────────────────────────────────────────
// Mirrors src/lib/apis/ollama/index.ts for admin model management.

import { apiFetch, OLLAMA_BASE } from './client';
import { getToken } from '@/lib/auth/session';

export interface OllamaConfig {
  ENABLE_OLLAMA_API: boolean;
  OLLAMA_BASE_URLS: string[];
  OLLAMA_API_CONFIGS: Record<string, unknown>;
}

export interface OllamaModel {
  id: string;
  name: string;
  model: string;
  modified_at: string;
  size: number;
  digest: string;
  details?: {
    parent_model: string;
    format: string;
    family: string;
    parameter_size: string;
    quantization_level: string;
  };
}

// ── Config ────────────────────────────────────────────────────────────────────
export const getOllamaConfig = (token: string) =>
  apiFetch<OllamaConfig>(`${OLLAMA_BASE}/config`, { token });

// ── Models list ───────────────────────────────────────────────────────────────
export const getOllamaModels = (token: string, urlIdx?: number) =>
  apiFetch<{ models: OllamaModel[] }>(
    `${OLLAMA_BASE}/api/tags${urlIdx !== undefined ? `/${urlIdx}` : ''}`,
    { token },
  ).then((res) =>
    (res?.models ?? [])
      .map((m) => ({ ...m, id: m.model, name: m.name ?? m.model }))
      .sort((a, b) => a.name.localeCompare(b.name)),
  );

// ── Delete model ──────────────────────────────────────────────────────────────
export const deleteOllamaModel = (token: string, modelName: string, urlIdx?: number) =>
  apiFetch<{ status: boolean }>(
    `${OLLAMA_BASE}/api/delete${urlIdx !== undefined ? `/${urlIdx}` : ''}`,
    { token, method: 'DELETE', body: { model: modelName } },
  );

// ── Pull model (streaming NDJSON) ─────────────────────────────────────────────
// Returns the raw Response so the caller can stream progress.
export const pullOllamaModel = async (
  token: string,
  name: string,
  urlIdx?: number,
): Promise<{ response: Response; controller: AbortController }> => {
  const controller = new AbortController();
  const authToken = token || getToken() || '';

  const response = await fetch(
    `${OLLAMA_BASE}/api/pull${urlIdx !== undefined ? `/${urlIdx}` : ''}`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify({ name }),
      signal: controller.signal,
      credentials: 'include',
    },
  );

  if (!response.ok) {
    const err = await response.json().catch(() => ({ detail: response.statusText }));
    throw err;
  }

  return { response, controller };
};
