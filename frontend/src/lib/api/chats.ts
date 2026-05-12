// ─── Chats API ────────────────────────────────────────────────────────────────
// Mirrors src/lib/apis/chats/index.ts.

import { apiFetch, WEBUI_API_BASE } from './client';
import type { Chat, ChatTag, ChatFolder } from '@/types/chat';

export const getChatList = (token: string, page = 1) =>
  apiFetch<Chat[]>(`${WEBUI_API_BASE}/chats/?page=${page}`, { token });

export const getAllChats = (token: string) =>
  apiFetch<Chat[]>(`${WEBUI_API_BASE}/chats/all`, { token });

export const getPinnedChats = (token: string) =>
  apiFetch<Chat[]>(`${WEBUI_API_BASE}/chats/pinned`, { token });

export const getChatById = (token: string, id: string) =>
  apiFetch<Chat>(`${WEBUI_API_BASE}/chats/${id}`, { token });

export const createNewChat = (token: string, body: Record<string, unknown>) =>
  apiFetch<Chat>(`${WEBUI_API_BASE}/chats/new`, { method: 'POST', body, token });

export const updateChatById = (token: string, id: string, body: Record<string, unknown>) =>
  apiFetch<Chat>(`${WEBUI_API_BASE}/chats/${id}`, { method: 'POST', body, token });

export const deleteChatById = (token: string, id: string) =>
  apiFetch<{ success: boolean }>(`${WEBUI_API_BASE}/chats/${id}`, { method: 'DELETE', token });

export const deleteAllChats = (token: string) =>
  apiFetch<{ success: boolean }>(`${WEBUI_API_BASE}/chats/`, { method: 'DELETE', token });

export const archiveAllChats = (token: string) =>
  apiFetch<{ success: boolean }>(`${WEBUI_API_BASE}/chats/archive/all`, { method: 'POST', token });

export const importChats = (token: string, chats: object[]) =>
  apiFetch<{ success: boolean }>(`${WEBUI_API_BASE}/chats/import`, {
    method: 'POST',
    body: { chats },
    token,
  });

export const getArchivedChats = (token: string) =>
  apiFetch<Chat[]>(`${WEBUI_API_BASE}/chats/archived`, { token });

export const unarchiveChatById = (token: string, id: string) =>
  apiFetch<Chat>(`${WEBUI_API_BASE}/chats/${id}/archive`, { method: 'POST', token });

export const getSharedChats = (token: string) =>
  apiFetch<Chat[]>(`${WEBUI_API_BASE}/chats/shared`, { token });

export const deleteSharedChatById = (token: string, id: string) =>
  apiFetch<boolean>(`${WEBUI_API_BASE}/chats/${id}/share`, { method: 'DELETE', token });

export const pinChatById = (token: string, id: string) =>
  apiFetch<Chat>(`${WEBUI_API_BASE}/chats/${id}/pin`, { method: 'POST', token });

export const archiveChatById = (token: string, id: string) =>
  apiFetch<Chat>(`${WEBUI_API_BASE}/chats/${id}/archive`, { method: 'POST', token });

export const shareChatById = (token: string, id: string) =>
  apiFetch<{ id: string }>(`${WEBUI_API_BASE}/chats/${id}/share`, { method: 'POST', token });

export const getSharedChatById = (id: string) =>
  apiFetch<Chat>(`${WEBUI_API_BASE}/chats/share/${id}`, { token: null });

export const getAllTags = (token: string) =>
  apiFetch<ChatTag[]>(`${WEBUI_API_BASE}/chats/all/tags`, { token });

export const getChatsByTag = (token: string, tag: string) =>
  apiFetch<Chat[]>(`${WEBUI_API_BASE}/chats/tags/tag?tag=${encodeURIComponent(tag)}`, { token });

export const addChatTag = (token: string, id: string, tag: string) =>
  apiFetch<Chat>(`${WEBUI_API_BASE}/chats/${id}/tags`, {
    method: 'POST',
    body: { tag },
    token,
  });

export const removeChatTag = (token: string, id: string, tag: string) =>
  apiFetch<Chat>(`${WEBUI_API_BASE}/chats/${id}/tags`, {
    method: 'DELETE',
    body: { tag },
    token,
  });

export const cloneChatById = (token: string, id: string) =>
  apiFetch<Chat>(`${WEBUI_API_BASE}/chats/${id}/clone`, { method: 'POST', token });

export const moveChatToFolder = (token: string, id: string, folderId: string | null) =>
  apiFetch<Chat>(`${WEBUI_API_BASE}/chats/${id}`, {
    method: 'POST',
    body: { folder_id: folderId },
    token,
  });

// ── Folders ──────────────────────────────────────────────────────────────────
export const getFolders = (token: string) =>
  apiFetch<ChatFolder[]>(`${WEBUI_API_BASE}/folders/`, { token });

export const createFolder = (token: string, name: string) =>
  apiFetch<ChatFolder>(`${WEBUI_API_BASE}/folders/`, { method: 'POST', body: { name }, token });

export const updateFolder = (token: string, id: string, body: Partial<ChatFolder>) =>
  apiFetch<ChatFolder>(`${WEBUI_API_BASE}/folders/${id}`, { method: 'POST', body, token });

export const deleteFolder = (token: string, id: string) =>
  apiFetch<{ success: boolean }>(`${WEBUI_API_BASE}/folders/${id}`, {
    method: 'DELETE',
    token,
  });
