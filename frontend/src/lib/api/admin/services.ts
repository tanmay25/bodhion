// ─── Admin: Services API ───────────────────────────────────────────────────────
import { apiFetch, WEBUI_API_BASE } from '@/lib/api/client';

const BASE = `${WEBUI_API_BASE}/services`;

// ── Types ──────────────────────────────────────────────────────────────────────

export interface AccessGrant {
  id: string;
  resource_type: string;
  resource_id: string;
  principal_type: 'user' | 'group';
  principal_id: string;
  permission: 'read' | 'write';
  created_at: number;
}

export interface ServiceModel {
  id: string;
  user_id: string;
  type: string;
  name: string;
  description: string | null;
  route: string;
  icon: string | null;
  cta: string | null;
  status: string;
  is_active: boolean;
  sort_order: number;
  access_grants: AccessGrant[];
  settings: Record<string, Record<string, unknown>>;
  is_accessible: boolean;
  access_reason: string | null;
  updated_at: number;
  created_at: number;
}

export interface ServiceForm {
  id: string;
  type?: string;
  name: string;
  description?: string | null;
  route: string;
  icon?: string | null;
  cta?: string | null;
  status?: string;
  is_active?: boolean;
  sort_order?: number;
  access_grants?: Omit<AccessGrant, 'id' | 'resource_type' | 'resource_id' | 'created_at'>[];
  settings?: Record<string, Record<string, unknown>>;
}

export interface ServiceUpdateForm {
  type?: string;
  name?: string;
  description?: string | null;
  route?: string;
  icon?: string | null;
  cta?: string | null;
  status?: string;
  is_active?: boolean;
  sort_order?: number;
  access_grants?: Omit<AccessGrant, 'id' | 'resource_type' | 'resource_id' | 'created_at'>[];
  settings?: Record<string, Record<string, unknown>>;
}

// ── API functions ──────────────────────────────────────────────────────────────

export const adminGetServices = (token: string, include_inactive = true) =>
  apiFetch<ServiceModel[]>(
    `${BASE}/admin/list?include_inactive=${include_inactive}`,
    { token }
  );

export const adminCreateService = (token: string, body: ServiceForm) =>
  apiFetch<ServiceModel>(`${BASE}/admin/create`, { method: 'POST', body, token });

export const adminUpdateService = (token: string, id: string, body: ServiceUpdateForm) =>
  apiFetch<ServiceModel>(`${BASE}/admin/${id}/update`, { method: 'POST', body, token });

export const adminDeactivateService = (token: string, id: string) =>
  apiFetch<boolean>(`${BASE}/admin/${id}/deactivate`, { method: 'POST', token });

export const setServiceAccess = (
  token: string,
  id: string,
  access_grants: Omit<AccessGrant, 'id' | 'resource_type' | 'resource_id' | 'created_at'>[]
) =>
  apiFetch<ServiceModel>(`${BASE}/${id}/access`, {
    method: 'POST',
    body: { access_grants },
    token,
  });

export const setServiceSettings = (
  token: string,
  id: string,
  settings: Record<string, Record<string, unknown>>
) =>
  apiFetch<ServiceModel>(`${BASE}/${id}/settings`, {
    method: 'POST',
    body: { settings },
    token,
  });
