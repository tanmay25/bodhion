// ─── Notes API ────────────────────────────────────────────────────────────────
import { apiFetch, WEBUI_API_BASE } from './client';
import type { Note } from '@/types/api';

export const getNotes = (token: string) =>
  apiFetch<Note[]>(`${WEBUI_API_BASE}/notes/`, { token });

export const getNoteById = (token: string, id: string) =>
  apiFetch<Note>(`${WEBUI_API_BASE}/notes/${id}`, { token });

export const createNote = (token: string, body: { title?: string; data?: { content?: string } }) =>
  apiFetch<Note>(`${WEBUI_API_BASE}/notes/create`, { method: 'POST', body, token });

export const updateNote = (token: string, id: string, body: Partial<Note>) =>
  apiFetch<Note>(`${WEBUI_API_BASE}/notes/${id}/update`, { method: 'POST', body, token });

export const deleteNote = (token: string, id: string) =>
  apiFetch<{ success: boolean }>(`${WEBUI_API_BASE}/notes/${id}/delete`, {
    method: 'DELETE',
    token,
  });
