// ─── Admin: Users & Groups API ────────────────────────────────────────────────
import { apiFetch, WEBUI_API_BASE } from '@/lib/api/client';
import type { AdminUser, Group } from '@/types/api';
import type { UserPermissions } from '@/types/auth';

// ── Users ─────────────────────────────────────────────────────────────────────

export interface SearchUsersParams {
  query?: string;
  orderBy?: string;
  direction?: 'asc' | 'desc';
  page?: number;
  limit?: number;
}

export interface SearchUsersResult {
  users: AdminUser[];
  total: number;
}

export interface UserChatItem {
  id: string;
  title: string;
  updated_at: number;
  created_at: number;
}

export const adminSearchUsers = (token: string, params: SearchUsersParams = {}) => {
  const sp = new URLSearchParams();
  sp.set('page', String(params.page ?? 1));
  if (params.query) sp.set('query', params.query);
  if (params.orderBy) sp.set('order_by', params.orderBy);
  if (params.direction) sp.set('direction', params.direction);
  if (params.limit) sp.set('limit', String(params.limit));
  return apiFetch<SearchUsersResult>(`${WEBUI_API_BASE}/users/search?${sp}`, { token });
};

export const adminGetAllUsers = (token: string) =>
  apiFetch<AdminUser[]>(`${WEBUI_API_BASE}/users/`, { token });

export const adminCreateUser = (
  token: string,
  body: { name: string; email: string; password: string; role?: string }
) => apiFetch<AdminUser>(`${WEBUI_API_BASE}/auths/add`, { method: 'POST', body, token });

export const adminUpdateUser = (
  token: string,
  id: string,
  body: Partial<AdminUser> & { password?: string }
) =>
  apiFetch<AdminUser>(`${WEBUI_API_BASE}/users/${id}/update`, {
    method: 'POST',
    body,
    token,
  });

export const adminUpdateUserRole = (token: string, id: string, role: string) =>
  apiFetch<AdminUser>(`${WEBUI_API_BASE}/users/${id}/role`, {
    method: 'POST',
    body: { role },
    token,
  });

export const adminDeleteUser = (token: string, id: string) =>
  apiFetch<{ success: boolean }>(`${WEBUI_API_BASE}/users/${id}`, {
    method: 'DELETE',
    token,
  });

export const adminGetUserChats = (token: string, userId: string, page = 1) =>
  apiFetch<UserChatItem[]>(
    `${WEBUI_API_BASE}/chats/list/user/${userId}?page=${page}`,
    { token }
  );

// ── Default Permissions ───────────────────────────────────────────────────────

export const getDefaultPermissions = (token: string) =>
  apiFetch<{ permissions: UserPermissions }>(
    `${WEBUI_API_BASE}/users/default/permissions`,
    { token }
  );

export const updateDefaultPermissions = (token: string, permissions: UserPermissions) =>
  apiFetch<{ permissions: UserPermissions }>(
    `${WEBUI_API_BASE}/users/default/permissions`,
    { method: 'POST', body: { permissions }, token }
  );

// ── Groups ────────────────────────────────────────────────────────────────────

export interface GroupPayload {
  name: string;
  description?: string;
  permissions?: UserPermissions;
  user_ids?: string[];
}

export const adminGetGroups = (token: string) =>
  apiFetch<Group[]>(`${WEBUI_API_BASE}/groups/`, { token });

export const adminCreateGroup = (token: string, body: GroupPayload) =>
  apiFetch<Group>(`${WEBUI_API_BASE}/groups/create`, { method: 'POST', body, token });

export const adminGetGroupById = (token: string, id: string) =>
  apiFetch<Group>(`${WEBUI_API_BASE}/groups/id/${id}`, { token });

export const adminUpdateGroup = (token: string, id: string, body: Partial<GroupPayload>) =>
  apiFetch<Group>(`${WEBUI_API_BASE}/groups/id/${id}/update`, {
    method: 'POST',
    body,
    token,
  });

export const adminDeleteGroup = (token: string, id: string) =>
  apiFetch<{ success: boolean }>(`${WEBUI_API_BASE}/groups/id/${id}`, {
    method: 'DELETE',
    token,
  });
