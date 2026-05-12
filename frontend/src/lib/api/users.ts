// ─── Users API ────────────────────────────────────────────────────────────────
import { apiFetch, WEBUI_API_BASE } from './client';
import type { AdminUser } from '@/types/api';
import type { UserSettings } from '@/types/config';

export const getUserList = (token: string) =>
  apiFetch<AdminUser[]>(`${WEBUI_API_BASE}/users/`, { token });

export const getUserById = (token: string, id: string) =>
  apiFetch<AdminUser>(`${WEBUI_API_BASE}/users/${id}`, { token });

export const updateUserById = (token: string, id: string, body: Partial<AdminUser>) =>
  apiFetch<AdminUser>(`${WEBUI_API_BASE}/users/${id}/update`, {
    method: 'POST',
    body,
    token,
  });

export const deleteUserById = (token: string, id: string) =>
  apiFetch<{ success: boolean }>(`${WEBUI_API_BASE}/users/${id}`, { method: 'DELETE', token });

export const getUserSettings = (token: string) =>
  apiFetch<{ ui: UserSettings }>(`${WEBUI_API_BASE}/users/user/settings`, { token });

export const updateUserSettings = (token: string, body: { ui: UserSettings }) =>
  apiFetch<{ ui: UserSettings }>(`${WEBUI_API_BASE}/users/user/settings/update`, {
    method: 'POST',
    body,
    token,
  });

export const addUser = (token: string, body: { name: string; email: string; password: string; role?: string }) =>
  apiFetch<AdminUser>(`${WEBUI_API_BASE}/auths/add`, { method: 'POST', body, token });

export interface SearchUsersResponse {
  users: AdminUser[];
  total: number;
}

export const searchUsers = (
  token: string,
  params: { query?: string; orderBy?: string; direction?: string; page?: number } = {}
) => {
  const searchParams = new URLSearchParams();
  searchParams.set('page', String(params.page ?? 1));
  if (params.query) searchParams.set('query', params.query);
  if (params.orderBy) searchParams.set('order_by', params.orderBy);
  if (params.direction) searchParams.set('direction', params.direction);

  return apiFetch<SearchUsersResponse>(`${WEBUI_API_BASE}/users/search?${searchParams.toString()}`, {
    token,
  });
};

// Alias used by admin/users page
export const getUsers = getUserList;
