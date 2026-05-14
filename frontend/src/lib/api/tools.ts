// ─── User-facing Tools / MCP API ─────────────────────────────────────────────
import { apiFetch, WEBUI_API_BASE } from '@/lib/api/client';

export interface McpCredentialStatus {
  server_id:       string;
  auth_type:       string;
  connected:       boolean;
  token_expires_at?: number | null;
}

export interface McpServerEntry {
  server_id:   string;
  name:        string;
  description: string;
  auth_type:   string;
}

export const getMcpCredentialStatus = (token: string, serverId: string) =>
  apiFetch<McpCredentialStatus>(
    `${WEBUI_API_BASE}/tools/servers/${encodeURIComponent(serverId)}/credentials/me`,
    { token },
  );

export const saveMcpCredential = (
  token: string,
  serverId: string,
  apiKey: string,
) =>
  apiFetch<{ server_id: string; connected: boolean; auth_type: string }>(
    `${WEBUI_API_BASE}/tools/servers/${encodeURIComponent(serverId)}/credentials/me`,
    { token, method: 'POST', body: { api_key: apiKey } },
  );

export const deleteMcpCredential = (token: string, serverId: string) =>
  apiFetch<{ server_id: string; deleted: boolean }>(
    `${WEBUI_API_BASE}/tools/servers/${encodeURIComponent(serverId)}/credentials/me`,
    { token, method: 'DELETE' },
  );

export const getUserAccessibleTools = (token: string) =>
  apiFetch<Array<{ id: string; name: string; meta: { description?: string } }>>(
    `${WEBUI_API_BASE}/tools/`,
    { token },
  );
