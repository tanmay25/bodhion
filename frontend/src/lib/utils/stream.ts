// ─── Stream / SSE utilities ───────────────────────────────────────────────────
// Re-exports the core streaming function from lib/api/ai.ts and adds
// additional helpers that consuming components may need.

export { createOpenAITextStream } from '@/lib/api/ai';
export type { TextStreamUpdate } from '@/types/chat';

/**
 * Consume a ReadableStream<Uint8Array> line by line and call onLine for each.
 * Useful for non-SSE streaming responses.
 */
export async function readStreamLines(
  stream: ReadableStream<Uint8Array>,
  onLine: (line: string) => void
): Promise<void> {
  const decoder = new TextDecoderStream() as unknown as ReadableWritablePair<string, Uint8Array>;
  const reader = stream.pipeThrough(decoder).getReader();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      if (buffer) onLine(buffer);
      break;
    }
    buffer += value;
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';
    for (const line of lines) {
      if (line.trim()) onLine(line);
    }
  }
}
