// ─── GenAI / Streaming API ────────────────────────────────────────────────────

import { apiStream, CHAT_API_BASE, WEBUI_API_BASE } from './client';
import { getToken } from '@/lib/auth/session';
import type { ChatCompletionPayload, PipelineStep, TextStreamUpdate } from '@/types/chat';
import { EventSourceParserStream } from 'eventsource-parser/stream';
import type { ParsedEvent } from 'eventsource-parser';

// ── Follow-up suggestions ────────────────────────────────────────────────────

export async function fetchFollowUpSuggestions(
  model: string,
  messages: Array<{ role: string; content: string }>,
  chatId?: string | null,
  token?: string | null,
): Promise<string[]> {
  const authToken = token !== undefined ? token : getToken();

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  };
  if (authToken) headers['Authorization'] = `Bearer ${authToken}`;

  try {
    const res = await fetch(`${WEBUI_API_BASE}/tasks/follow_up/completions`, {
      method: 'POST',
      headers,
      credentials: 'include',
      body: JSON.stringify({
        model,
        messages,
        ...(chatId ? { chat_id: chatId } : {}),
      }),
    });

    if (!res.ok) return [];

    const data = await res.json().catch(() => null);
    if (!data) return [];

    const content: string = data?.choices?.[0]?.message?.content ?? '';
    if (!content) return [];

    return parseFollowUps(content);
  } catch {
    return [];
  }
}

/**
 * Robustly extract a follow_ups string array from LLM-generated text.
 * The LLM may wrap the JSON in markdown fences or add surrounding prose.
 */
function parseFollowUps(text: string): string[] {
  // 1. Try parsing the whole response as JSON first (cleanest case)
  try {
    const direct = JSON.parse(text) as { follow_ups?: unknown };
    if (Array.isArray(direct.follow_ups)) return direct.follow_ups as string[];
  } catch { /* fall through */ }

  // 2. Strip optional markdown code fence and find the first {...} block
  const stripped = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
  const start = stripped.indexOf('{');
  const end   = stripped.lastIndexOf('}');
  if (start === -1 || end === -1) return [];

  try {
    const parsed = JSON.parse(stripped.slice(start, end + 1)) as { follow_ups?: unknown };
    return Array.isArray(parsed.follow_ups) ? (parsed.follow_ups as string[]) : [];
  } catch {
    return [];
  }
}

// ── HTTP call ────────────────────────────────────────────────────────────────

export const chatCompletion = async (
  payload: ChatCompletionPayload,
  token?: string | null,
  baseUrl?: string,
): Promise<Response> => {
  const url = `${baseUrl ?? CHAT_API_BASE}/chat/completions`;
  return apiStream(url, payload, token);
};

// ── SSE streaming parser ──────────────────────────────────────────────────────

export async function createOpenAITextStream(
  responseBody: ReadableStream<Uint8Array>,
): Promise<AsyncGenerator<TextStreamUpdate>> {
  const eventStream = (responseBody as ReadableStream<Uint8Array<ArrayBufferLike>>)
    .pipeThrough(new TextDecoderStream() as unknown as TransformStream<Uint8Array<ArrayBufferLike>, string>)
    .pipeThrough(new EventSourceParserStream())
    .getReader();

  return openAIStreamToIterator(eventStream);
}

async function* openAIStreamToIterator(
  reader: ReadableStreamDefaultReader<ParsedEvent>,
): AsyncGenerator<TextStreamUpdate> {
  while (true) {
    const { value, done } = await reader.read();
    if (done) {
      yield { done: true, value: '' };
      break;
    }
    if (!value) continue;

    const data = value.data;
    if (data.startsWith('[DONE]')) {
      yield { done: true, value: '' };
      break;
    }

    try {
      const parsed = JSON.parse(data);
      if (parsed.error) {
        yield { done: true, value: '', error: parsed.error };
        break;
      }
      if (parsed.step)              { yield { done: false, value: '', step: parsed.step as PipelineStep };           continue; }
      if (parsed.sources)           { yield { done: false, value: '', sources: parsed.sources };                      continue; }
      if (parsed.selected_model_id) { yield { done: false, value: '', selectedModelId: parsed.selected_model_id };    continue; }
      if (parsed.usage)             { yield { done: false, value: '', usage: parsed.usage };                          continue; }
      if (parsed.follow_ups)        { yield { done: false, value: '', followUps: parsed.follow_ups as string[] };     continue; }
      yield { done: false, value: parsed.choices?.[0]?.delta?.content ?? '' };
    } catch {
      // skip malformed SSE events
    }
  }
}
