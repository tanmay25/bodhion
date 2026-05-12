// ─── API base client ──────────────────────────────────────────────────────────
// Mirrors the runtime URL derivation from src/lib/constants.ts in the Svelte app.
// Svelte used: WEBUI_BASE_URL = browser ? (dev ? `http://${hostname}:8080` : ``) : ''
// Next.js uses: NEXT_PUBLIC_API_URL env var — empty string = same-origin in prod.

import { getToken, clearSession } from '@/lib/auth/session';

export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? '';
export const WEBUI_API_BASE = `${API_BASE_URL}/api/v1`;
export const OLLAMA_BASE = `${API_BASE_URL}/ollama`;
export const OPENAI_BASE = `${API_BASE_URL}/openai`;
export const CHAT_API_BASE = `${API_BASE_URL}/api`;
export const AUDIO_BASE = `${API_BASE_URL}/api/v1/audio`;
export const IMAGES_BASE = `${API_BASE_URL}/api/v1/images`;
export const RETRIEVAL_BASE = `${API_BASE_URL}/api/v1/retrieval`;

export const APP_VERSION = process.env.NEXT_PUBLIC_APP_VERSION ?? '0.0.0';
export const APP_BUILD_HASH = process.env.NEXT_PUBLIC_APP_BUILD_HASH ?? 'dev-build';

// ── Core fetch wrapper ────────────────────────────────────────────────────────

export type RequestOptions = {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  token?: string | null;
  headers?: Record<string, string>;
  /** If true, return the raw Response (needed for streaming). */
  raw?: boolean;
};

/**
 * Typed fetch wrapper.
 * - Attaches `Authorization: Bearer <token>` when a token is available.
 * - On 401: clears the session and redirects to /login.
 * - Throws the parsed JSON error body on non-ok responses.
 */
export async function apiFetch<T = unknown>(
  url: string,
  options: RequestOptions = {}
): Promise<T> {
  const { method = 'GET', body, token, headers = {}, raw = false } = options;

  // Resolve token: explicit > session storage
  const authToken = token !== undefined ? token : getToken();

  const reqHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
    ...headers,
  };

  if (authToken) {
    reqHeaders['Authorization'] = `Bearer ${authToken}`;
  }

  const init: RequestInit = {
    method,
    headers: reqHeaders,
    credentials: 'include',
  };

  if (body !== undefined) {
    init.body = JSON.stringify(body);
  }

  const response = await fetch(url, init);

  if (response.status === 401) {
    clearSession();
    if (typeof window !== 'undefined') {
      const redirect = encodeURIComponent(window.location.pathname + window.location.search);
      window.location.href = `/login?redirect=${redirect}`;
    }
    throw new Error('Unauthorized');
  }

  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({ detail: response.statusText }));
    throw errorBody;
  }

  if (raw) {
    return response as unknown as T;
  }

  return response.json() as Promise<T>;
}

/** Streaming variant — returns the raw Response for SSE consumption. */
export async function apiStream(
  url: string,
  body: unknown,
  token?: string | null
): Promise<Response> {
  const authToken = token !== undefined ? token : getToken();

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'text/event-stream',
  };
  if (authToken) {
    headers['Authorization'] = `Bearer ${authToken}`;
  }

  const response = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
    credentials: 'include',
  });

  if (response.status === 401) {
    clearSession();
    if (typeof window !== 'undefined') {
      window.location.href = '/login';
    }
    throw new Error('Unauthorized');
  }

  if (!response.ok) {
    const err = await response.json().catch(() => ({ detail: response.statusText }));
    throw err;
  }

  return response;
}
