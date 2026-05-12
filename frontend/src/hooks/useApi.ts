'use client';

// ─── useApi ───────────────────────────────────────────────────────────────────
// Typed fetch wrapper hook with loading/error state.
// Wraps apiFetch so components never call fetch directly.

import { useState, useCallback } from 'react';
import { apiFetch } from '@/lib/api/client';
import { getToken } from '@/lib/auth/session';
import type { RequestOptions } from '@/lib/api/client';

interface ApiState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
}

interface UseApiReturn<T> extends ApiState<T> {
  execute: (url: string, options?: Omit<RequestOptions, 'token'>) => Promise<T | null>;
  reset: () => void;
}

export function useApi<T = unknown>(): UseApiReturn<T> {
  const [state, setState] = useState<ApiState<T>>({
    data: null,
    loading: false,
    error: null,
  });

  const execute = useCallback(
    async (url: string, options: Omit<RequestOptions, 'token'> = {}): Promise<T | null> => {
      setState({ data: null, loading: true, error: null });
      try {
        const token = getToken();
        const result = await apiFetch<T>(url, { ...options, token });
        setState({ data: result, loading: false, error: null });
        return result;
      } catch (err) {
        const message =
          typeof err === 'object' && err !== null && 'detail' in err
            ? String((err as { detail: string }).detail)
            : String(err);
        setState({ data: null, loading: false, error: message });
        return null;
      }
    },
    []
  );

  const reset = useCallback(() => {
    setState({ data: null, loading: false, error: null });
  }, []);

  return { ...state, execute, reset };
}
