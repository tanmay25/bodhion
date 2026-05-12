// ─── Auth API ─────────────────────────────────────────────────────────────────
// Mirrors src/lib/apis/auths/index.ts from the Svelte app.

import { apiFetch, WEBUI_API_BASE } from './client';
import type {
  SessionUser,
  SignInPayload,
  SignUpPayload,
  LdapSignInPayload,
  UpdateProfilePayload,
  UpdatePasswordPayload,
  AdminConfig,
} from '@/types/auth';
import type { BackendConfig } from '@/types/config';

export const getSessionUser = (token: string) =>
  apiFetch<SessionUser>(`${WEBUI_API_BASE}/auths/`, { token });

export const userSignIn = (payload: SignInPayload) =>
  apiFetch<SessionUser>(`${WEBUI_API_BASE}/auths/signin`, {
    method: 'POST',
    body: payload,
    token: null,
  });

export const userSignUp = (payload: SignUpPayload) =>
  apiFetch<SessionUser>(`${WEBUI_API_BASE}/auths/signup`, {
    method: 'POST',
    body: payload,
    token: null,
  });

export const ldapUserSignIn = (payload: LdapSignInPayload) =>
  apiFetch<SessionUser>(`${WEBUI_API_BASE}/auths/ldap`, {
    method: 'POST',
    body: payload,
    token: null,
  });

export const userSignOut = () =>
  apiFetch<{ redirect_url?: string }>(`${WEBUI_API_BASE}/auths/signout`, {
    method: 'GET',
  });

export const updateUserProfile = (token: string, payload: UpdateProfilePayload) =>
  apiFetch<SessionUser>(`${WEBUI_API_BASE}/auths/update/profile`, {
    method: 'POST',
    body: payload,
    token,
  });

export const updateUserPassword = (token: string, payload: UpdatePasswordPayload) =>
  apiFetch<{ message: string }>(`${WEBUI_API_BASE}/auths/update/password`, {
    method: 'POST',
    body: payload,
    token,
  });

export const updateUserTimezone = (token: string, timezone: string) =>
  apiFetch<SessionUser>(`${WEBUI_API_BASE}/auths/update/profile`, {
    method: 'POST',
    body: { timezone },
    token,
  });

export const getAdminDetails = (token: string) =>
  apiFetch<{ name: string; email: string }>(`${WEBUI_API_BASE}/auths/admin/details`, { token });

export const getAdminConfig = (token: string) =>
  apiFetch<AdminConfig>(`${WEBUI_API_BASE}/auths/admin/config`, { token });

export const updateAdminConfig = (token: string, body: Partial<AdminConfig>) =>
  apiFetch<AdminConfig>(`${WEBUI_API_BASE}/auths/admin/config`, {
    method: 'POST',
    body,
    token,
  });

export const getAPIKey = (token: string) =>
  apiFetch<string>(`${WEBUI_API_BASE}/auths/api_key`, { token });

export const createAPIKey = (token: string) =>
  apiFetch<string>(`${WEBUI_API_BASE}/auths/api_key`, { method: 'POST', token });

export const deleteAPIKey = (token: string) =>
  apiFetch<{ success: boolean }>(`${WEBUI_API_BASE}/auths/api_key`, { method: 'DELETE', token });

export const getBackendConfig = () =>
  apiFetch<BackendConfig>(`${WEBUI_API_BASE.replace('/api/v1', '')}/api/config`, { token: null });

export const getVersion = (token: string) =>
  apiFetch<{ version: string; deployment_id?: string }>(
    `${WEBUI_API_BASE.replace('/api/v1', '')}/api/version`,
    { token }
  );

export const updateUserStatus = (
  token: string,
  payload: { status_emoji: string; status_message: string }
) =>
  apiFetch<SessionUser>(`${WEBUI_API_BASE}/users/user/status/update`, {
    method: 'POST',
    body: payload,
    token,
  });

