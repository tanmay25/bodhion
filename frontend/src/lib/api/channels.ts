// ─── Channels API ────────────────────────────────────────────────────────────
import { apiFetch, WEBUI_API_BASE } from './client';
import type { Channel, ChannelMessage } from '@/types/api';

export const getChannels = (token: string) =>
  apiFetch<Channel[]>(`${WEBUI_API_BASE}/channels/`, { token });

export const getChannelById = (token: string, id: string) =>
  apiFetch<Channel>(`${WEBUI_API_BASE}/channels/${id}`, { token });

export const createChannel = (token: string, body: { name: string; description?: string }) =>
  apiFetch<Channel>(`${WEBUI_API_BASE}/channels/create`, { method: 'POST', body, token });

export const updateChannel = (token: string, id: string, body: Partial<Channel>) =>
  apiFetch<Channel>(`${WEBUI_API_BASE}/channels/${id}/update`, { method: 'POST', body, token });

export const deleteChannel = (token: string, id: string) =>
  apiFetch<{ success: boolean }>(`${WEBUI_API_BASE}/channels/${id}/delete`, {
    method: 'DELETE',
    token,
  });

export const getChannelMessages = (token: string, id: string) =>
  apiFetch<ChannelMessage[]>(`${WEBUI_API_BASE}/channels/${id}/messages`, { token });

export const sendChannelMessage = (token: string, id: string, content: string) =>
  apiFetch<ChannelMessage>(`${WEBUI_API_BASE}/channels/${id}/messages/post`, {
    method: 'POST',
    body: { content },
    token,
  });

export const markChannelAsRead = (token: string, id: string) =>
  apiFetch<Channel>(`${WEBUI_API_BASE}/channels/${id}/read`, { method: 'POST', token });
