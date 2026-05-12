import { apiFetch, WEBUI_API_BASE } from './client';

export interface UserFile {
  id: string;
  filename: string;
  created_at?: number;
  updated_at?: number;
  meta?: {
    name?: string;
    size?: number;
    content_type?: string;
    [key: string]: unknown;
  };
  /** Extracted text content populated by the backend RAG pipeline */
  data?: {
    content?: string;
  };
}

export const getUserFiles = (token: string) =>
  apiFetch<UserFile[]>(`${WEBUI_API_BASE}/files/`, { token });

export const getFileProcessStatus = (token: string, id: string) =>
  apiFetch<{ status: string; error?: string }>(
    `${WEBUI_API_BASE}/files/${id}/process/status`,
    { token }
  );

export const getFileById = (token: string, id: string) =>
  apiFetch<UserFile>(`${WEBUI_API_BASE}/files/${id}`, { token });

export const deleteUserFile = (token: string, id: string) =>
  apiFetch<{ success: boolean }>(`${WEBUI_API_BASE}/files/${id}`, { method: 'DELETE', token });

/** Fetch raw binary content — used for PDF iframe src and Excel ArrayBuffer parsing. */
export async function getFileContentById(token: string, id: string): Promise<ArrayBuffer> {
  const res = await fetch(`${WEBUI_API_BASE}/files/${id}/content`, {
    headers: { Authorization: `Bearer ${token}` },
    credentials: 'include',
  });
  if (!res.ok) throw new Error(`Failed to fetch file content: ${res.statusText}`);
  return res.arrayBuffer();
}

export interface UploadedFile {
  id: string;
  filename?: string;
  meta?: {
    collection_name?: string;
    [key: string]: unknown;
  };
  collection_name?: string;
  error?: string;
}

/** POST the file and return immediately — no SSE wait. Processing runs in background. */
export async function uploadFileRaw(
  token: string,
  file: File,
  metadata?: Record<string, unknown> | null
): Promise<UploadedFile> {
  const formData = new FormData();
  formData.append('file', file);
  if (metadata) {
    formData.append('file_metadata', JSON.stringify(metadata));
  }
  const response = await fetch(`${WEBUI_API_BASE}/files/?process=true`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: formData,
    credentials: 'include',
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({ detail: response.statusText }));
    throw err;
  }
  return response.json() as Promise<UploadedFile>;
}

export async function uploadFile(
  token: string,
  file: File,
  metadata?: Record<string, unknown> | null
): Promise<UploadedFile> {
  const formData = new FormData();
  formData.append('file', file);
  if (metadata) {
    formData.append('file_metadata', JSON.stringify(metadata));
  }

  // ?process=true tells the backend to run text extraction + vector embedding immediately
  const response = await fetch(`${WEBUI_API_BASE}/files/?process=true`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: formData,
    credentials: 'include',
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({ detail: response.statusText }));
    throw err;
  }

  const uploaded: UploadedFile = await response.json();

  // Wait for the backend background task to finish extracting + embedding the file.
  // The backend streams SSE events: {"status":"pending"} → {"status":"completed"|"failed"}
  // Only once completed is collection_name guaranteed to be populated in the DB.
  const statusResponse = await fetch(
    `${WEBUI_API_BASE}/files/${uploaded.id}/process/status?stream=true`,
    {
      method: 'GET',
      headers: { Authorization: `Bearer ${token}`, Accept: 'text/event-stream' },
      credentials: 'include',
    }
  ).catch(() => null);

  if (statusResponse?.ok && statusResponse.body) {
    const reader = statusResponse.body
      .pipeThrough(new TextDecoderStream())
      .getReader();

    try {
      let buffer = '';
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += value;
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';
        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith('data:')) continue;
          const payload = trimmed.slice(5).trim();
          if (!payload || payload === '[DONE]') continue;
          try {
            const event = JSON.parse(payload) as { status: string; error?: string };
            if (event.status === 'failed') {
              uploaded.error = event.error ?? 'File processing failed';
              return uploaded;
            }
            if (event.status === 'completed') {
              // Fetch final metadata — collection_name is set during background embedding
              // and may not have been present in the initial POST response.
              const finalMeta = await fetch(`${WEBUI_API_BASE}/files/${uploaded.id}`, {
                headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
                credentials: 'include',
              }).then((r) => (r.ok ? (r.json() as Promise<UploadedFile>) : null)).catch(() => null);

              if (finalMeta) {
                uploaded.collection_name = finalMeta.meta?.collection_name ?? finalMeta.collection_name ?? uploaded.collection_name;
                uploaded.meta = { ...uploaded.meta, ...finalMeta.meta };
              }
              return uploaded;
            }
          } catch {
            // malformed SSE line — keep reading
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  }

  return uploaded;
}
