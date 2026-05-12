'use client';

// ─── useStreamingResponse ─────────────────────────────────────────────────────
// Hook that drives SSE streaming for chat completions.
// Mirrors the streaming logic in src/lib/components/chat/Messages/ResponseMessage.svelte.
//
// Usage:
//   const { content, isStreaming, error, start, stop } = useStreamingResponse();

import { useState, useRef, useCallback } from 'react';
import { chatCompletion, createOpenAITextStream } from '@/lib/api/ai';
import { getToken } from '@/lib/auth/session';
import type { ChatCompletionPayload, PipelineStep, TextStreamUpdate } from '@/types/chat';

interface StreamingState {
  content: string;
  isStreaming: boolean;
  error: unknown | null;
  sources: unknown[];
  usage: TextStreamUpdate['usage'] | null;
  followUps: string[];
  steps: PipelineStep[];
}

// Upsert a step by id: update in-place if already present, otherwise append.
// This handles started → done transitions without duplicating the step row.
function applyStep(steps: PipelineStep[], step: PipelineStep): PipelineStep[] {
  const idx = steps.findIndex((s) => s.id === step.id);
  if (idx === -1) return [...steps, step];
  const next = [...steps];
  next[idx] = step;
  return next;
}

interface UseStreamingResponseReturn extends StreamingState {
  start: (payload: ChatCompletionPayload, baseUrl?: string) => Promise<void>;
  stop: () => void;
  reset: () => void;
  addStepFromSocket: (step: PipelineStep) => void;
}

export function useStreamingResponse(): UseStreamingResponseReturn {
  const [state, setState] = useState<StreamingState>({
    content: '',
    isStreaming: false,
    error: null,
    sources: [],
    usage: null,
    followUps: [],
    steps: [],
  });

  const abortRef = useRef<AbortController | null>(null);

  const stop = useCallback(() => {
    abortRef.current?.abort();
    setState((s) => ({ ...s, isStreaming: false }));
  }, []);

  const reset = useCallback(() => {
    abortRef.current?.abort();
    setState({ content: '', isStreaming: false, error: null, sources: [], usage: null, followUps: [], steps: [] });
  }, []);

  const start = useCallback(
    async (payload: ChatCompletionPayload, baseUrl?: string) => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      setState({ content: '', isStreaming: true, error: null, sources: [], usage: null, followUps: [], steps: [] });

      try {
        const token = getToken();
        const response = await chatCompletion({ ...payload, stream: true }, token, baseUrl);

        if (!response.body) throw new Error('No response body');

        const stream = await createOpenAITextStream(response.body);

        for await (const update of stream) {
          if (controller.signal.aborted) break;

          if (update.step) {
            setState((s) => ({ ...s, steps: applyStep(s.steps, update.step!) }));
            continue;
          }
          if (update.error) {
            setState((s) => ({ ...s, isStreaming: false, error: update.error }));
            return;
          }
          if (update.sources) {
            setState((s) => ({ ...s, sources: update.sources as unknown[] }));
            continue;
          }
          if (update.usage) {
            setState((s) => ({ ...s, usage: update.usage }));
            continue;
          }
          if (update.followUps) {
            setState((s) => ({ ...s, followUps: update.followUps as string[] }));
            continue;
          }
          if (update.done) break;

          setState((s) => ({ ...s, content: s.content + update.value }));
        }

        setState((s) => ({ ...s, isStreaming: false }));
      } catch (err) {
        if (!controller.signal.aborted) {
          setState((s) => ({ ...s, isStreaming: false, error: err }));
        }
      }
    },
    []
  );

  const addStepFromSocket = useCallback((step: PipelineStep) => {
    setState((s) => ({ ...s, steps: applyStep(s.steps, step) }));
  }, []);

  return { ...state, start, stop, reset, addStepFromSocket };
}
