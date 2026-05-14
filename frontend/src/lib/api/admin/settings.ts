// ─── Admin: Settings API ───────────────────────────────────────────────────────
import { apiFetch, WEBUI_API_BASE, RETRIEVAL_BASE, OLLAMA_BASE, OPENAI_BASE, CHAT_API_BASE } from '@/lib/api/client';

// ── General / Auth config ─────────────────────────────────────────────────────

export const getAdminConfig = (token: string) =>
  apiFetch<Record<string, unknown>>(`${WEBUI_API_BASE}/auths/admin/config`, { token });

export const updateAdminConfig = (token: string, body: Record<string, unknown>) =>
  apiFetch<Record<string, unknown>>(`${WEBUI_API_BASE}/auths/admin/config`, {
    token, method: 'POST', body,
  });

export const getWebhookUrl = (token: string) =>
  apiFetch<{ url: string }>(`${CHAT_API_BASE}/webhook`, { token });

export const updateWebhookUrl = (token: string, url: string) =>
  apiFetch<{ url: string }>(`${CHAT_API_BASE}/webhook`, {
    token, method: 'POST', body: { url },
  });

export const getVersionUpdates = (token: string) =>
  apiFetch<{ current: string; latest: string }>(`${CHAT_API_BASE}/version/updates`, { token });

// ── Banners ────────────────────────────────────────────────────────────────────

export interface Banner {
  id:          string;
  type:        'info' | 'warning' | 'error' | 'success';
  title?:      string;
  content:     string;
  url?:        string;
  dismissible: boolean;
  timestamp:   number;
}

export const getBanners = (token: string) =>
  apiFetch<Banner[]>(`${WEBUI_API_BASE}/configs/banners`, { token });

export const setBanners = (token: string, banners: Banner[]) =>
  apiFetch<Banner[]>(`${WEBUI_API_BASE}/configs/banners`, {
    token, method: 'POST', body: { banners },
  });

// ── Connections config ─────────────────────────────────────────────────────────

export const getConnectionsConfig = (token: string) =>
  apiFetch<Record<string, unknown>>(`${WEBUI_API_BASE}/configs/connections`, { token });

export const setConnectionsConfig = (token: string, config: Record<string, unknown>) =>
  apiFetch<Record<string, unknown>>(`${WEBUI_API_BASE}/configs/connections`, {
    token, method: 'POST', body: config,
  });

// ── Ollama ─────────────────────────────────────────────────────────────────────

export const getOllamaConfig = (token: string) =>
  apiFetch<Record<string, unknown>>(`${OLLAMA_BASE}/config`, { token });

export const updateOllamaConfig = (token: string, config: Record<string, unknown>) =>
  apiFetch<Record<string, unknown>>(`${OLLAMA_BASE}/config/update`, {
    token, method: 'POST', body: config,
  });

// ── OpenAI ─────────────────────────────────────────────────────────────────────

export const getOpenAIConfig = (token: string) =>
  apiFetch<Record<string, unknown>>(`${OPENAI_BASE}/config`, { token });

export const updateOpenAIConfig = (token: string, config: Record<string, unknown>) =>
  apiFetch<Record<string, unknown>>(`${OPENAI_BASE}/config/update`, {
    token, method: 'POST', body: config,
  });

// ── Audio ──────────────────────────────────────────────────────────────────────

export const getAudioConfig = (token: string) =>
  apiFetch<Record<string, unknown>>(`${WEBUI_API_BASE}/audio/config`, { token });

export const updateAudioConfig = (token: string, config: Record<string, unknown>) =>
  apiFetch<Record<string, unknown>>(`${WEBUI_API_BASE}/audio/config/update`, {
    token, method: 'POST', body: config,
  });

// ── Images ─────────────────────────────────────────────────────────────────────

export const getImageConfig = (token: string) =>
  apiFetch<Record<string, unknown>>(`${WEBUI_API_BASE}/images/config`, { token });

export const updateImageConfig = (token: string, config: Record<string, unknown>) =>
  apiFetch<Record<string, unknown>>(`${WEBUI_API_BASE}/images/config/update`, {
    token, method: 'POST', body: config,
  });

// ── Interface / Task config ────────────────────────────────────────────────────

export const getTaskConfig = (token: string) =>
  apiFetch<Record<string, unknown>>(`${WEBUI_API_BASE}/tasks/config`, { token });

export const updateTaskConfig = (token: string, config: Record<string, unknown>) =>
  apiFetch<Record<string, unknown>>(`${WEBUI_API_BASE}/tasks/config/update`, {
    token, method: 'POST', body: config,
  });

// ── RAG / Web Search ───────────────────────────────────────────────────────────

export const getRAGConfig = (token: string) =>
  apiFetch<Record<string, unknown>>(`${WEBUI_API_BASE}/retrieval/config`, { token });

export const updateRAGConfig = (token: string, config: Record<string, unknown>) =>
  apiFetch<Record<string, unknown>>(`${WEBUI_API_BASE}/retrieval/config/update`, {
    token, method: 'POST', body: config,
  });

export const getRerankerStatus = (token: string) =>
  apiFetch<{ status: 'idle' | 'loading' | 'ready' | 'error'; model: string; error?: string }>(
    `${WEBUI_API_BASE}/retrieval/config/reranking/status`, { token }
  );

export const getProcessors = (token: string) =>
  apiFetch<{ processors: string[] }>(`${WEBUI_API_BASE}/retrieval/processors`, { token });

export const getStrategies = (token: string) =>
  apiFetch<{ strategies: string[] }>(`${WEBUI_API_BASE}/retrieval/strategies`, { token });

// ── Database ────────────────────────────────────────────────────────────────────

export const exportConfig = (token: string) =>
  apiFetch<Record<string, unknown>>(`${WEBUI_API_BASE}/configs/export`, { token });

export const importConfig = (token: string, config: Record<string, unknown>) =>
  apiFetch<{ status: boolean }>(`${WEBUI_API_BASE}/configs/import`, {
    token, method: 'POST', body: { config },
  });

export const downloadDatabase = (token: string) =>
  fetch(`${WEBUI_API_BASE}/utils/db/download`, {
    headers: { Authorization: `Bearer ${token}` },
  });

// ── MCP Tool Servers ────────────────────────────────────────────────────────────

import type { MCPServerConnection, MCPHealthResult } from '@/types/config';

export const getToolServersConfig = (token: string) =>
  apiFetch<{ TOOL_SERVER_CONNECTIONS: MCPServerConnection[] }>(
    `${WEBUI_API_BASE}/configs/tool_servers`, { token }
  );

export const setToolServersConfig = (
  token: string,
  connections: MCPServerConnection[],
) =>
  apiFetch<{ TOOL_SERVER_CONNECTIONS: MCPServerConnection[] }>(
    `${WEBUI_API_BASE}/configs/tool_servers`,
    { token, method: 'POST', body: { TOOL_SERVER_CONNECTIONS: connections } },
  );

export const getMcpServerHealth = (token: string, serverId: string) =>
  apiFetch<MCPHealthResult>(
    `${WEBUI_API_BASE}/tools/servers/${encodeURIComponent(serverId)}/health`,
    { token },
  );

export const getAllUserChats = (token: string) =>
  apiFetch<unknown[]>(`${WEBUI_API_BASE}/chats/all/db`, { token });

// ── MCP Audit Log ──────────────────────────────────────────────────────────────

export interface McpAuditRow {
  id:           string;
  user_id:      string | null;
  server_id:    string | null;
  server_name:  string | null;
  tool_name:    string | null;
  input_summary:string | null;
  status:       string;
  error_type:   string | null;
  latency_ms:   number | null;
  chat_id:      string | null;
  timestamp:    number;
}

export interface McpAuditFilters {
  user_id?:    string;
  server_id?:  string;
  tool_name?:  string;
  status?:     string;
  start_time?: number;
  end_time?:   number;
  skip?:       number;
  limit?:      number;
}

// ── MCP Marketplace Registry ────────────────────────────────────────────────

export interface RegistryServer {
  id:              string;
  name:            string;
  description:     string;
  category:        string;
  author:          'community' | 'verified';
  auth_type:       string;
  oauth_scopes?:   string[];
  config_template: Record<string, string>;
  docs_url?:       string;
  icon?:           string;
  tags?:           string[];
  installed:       boolean;
  bundled?:        boolean;
}

export interface RegistryResponse {
  registry_version: string;
  servers:          RegistryServer[];
}

export interface RegistryCategory {
  category: string;
  count:    number;
}

export const getMcpRegistry = (token: string) =>
  apiFetch<RegistryResponse>(`${WEBUI_API_BASE}/tools/mcp-registry`, { token });

export const getMcpRegistryCategories = (token: string) =>
  apiFetch<RegistryCategory[]>(`${WEBUI_API_BASE}/tools/mcp-registry/categories`, { token });

export const getMcpAuditLog = (token: string, filters: McpAuditFilters = {}) => {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([k, v]) => {
    if (v !== undefined && v !== '') params.set(k, String(v));
  });
  const qs = params.toString() ? `?${params.toString()}` : '';
  return apiFetch<{ rows: McpAuditRow[]; total: number }>(
    `${WEBUI_API_BASE}/tools/audit${qs}`,
    { token },
  );
};

export const getAllUsers = (token: string) =>
  apiFetch<{ users: unknown[] }>(`${WEBUI_API_BASE}/users/all`, { token });

// ── MCP Server Validator ───────────────────────────────────────────────────────

export interface McpValidateResult {
  ok:          boolean;
  tool_count:  number;
  latency_ms:  number;
  error?:      string;
}

export const validateMcpServer = (
  token: string,
  url: string,
  auth_type = 'none',
  key = '',
) =>
  apiFetch<McpValidateResult>(`${WEBUI_API_BASE}/tools/servers/validate`, {
    token,
    method: 'POST',
    body: { url, auth_type, key },
  });

// ── MCP Health History & Alerts ────────────────────────────────────────────────

export interface McpHealthRecord {
  id:         string;
  server_id:  string;
  server_name: string | null;
  status:     'ok' | 'unreachable' | 'auth_error';
  latency_ms: number | null;
  timestamp:  number;
}

export interface McpHealthHistoryResult {
  server_id:      string;
  hours:          number;
  uptime_7d_pct:  number | null;
  records:        McpHealthRecord[];
}

export const getMcpHealthHistory = (token: string, serverId: string, hours = 24) =>
  apiFetch<McpHealthHistoryResult>(
    `${WEBUI_API_BASE}/tools/servers/${encodeURIComponent(serverId)}/health-history?hours=${hours}`,
    { token },
  );

export interface McpAlert {
  server_id:            string;
  server_name:          string | null;
  status:               string;
  since:                number;
  consecutive_failures: number;
}

export const getMcpAlerts = (token: string) =>
  apiFetch<{ alerts: McpAlert[] }>(`${WEBUI_API_BASE}/tools/mcp-alerts`, { token });

// ── MCP Analytics ──────────────────────────────────────────────────────────────

export interface McpServerUsageEntry {
  server_id:      string;
  server_name:    string | null;
  total_calls:    number;
  success_count:  number;
  error_count:    number;
  success_rate:   number;
  avg_latency_ms: number | null;
  unique_users:   number;
}

export interface McpToolEntry {
  tool_name:   string;
  server_id:   string | null;
  server_name: string | null;
  call_count:  number;
  error_count: number;
}

export interface McpUserEntry {
  user_id:     string;
  user_name:   string | null;
  user_email:  string | null;
  server_id:   string | null;
  server_name: string | null;
  call_count:  number;
}

export const getMcpServerAnalytics = (token: string, period = '7d') =>
  apiFetch<{ servers: McpServerUsageEntry[]; period: string }>(
    `${WEBUI_API_BASE}/analytics/mcp/servers?period=${period}`,
    { token },
  );

export const getMcpToolAnalytics = (token: string, period = '7d', limit = 20) =>
  apiFetch<{ tools: McpToolEntry[]; period: string }>(
    `${WEBUI_API_BASE}/analytics/mcp/tools?period=${period}&limit=${limit}`,
    { token },
  );

export const getMcpUserAnalytics = (token: string, period = '7d') =>
  apiFetch<{ rows: McpUserEntry[]; period: string }>(
    `${WEBUI_API_BASE}/analytics/mcp/users?period=${period}`,
    { token },
  );

// ── Evaluations config ─────────────────────────────────────────────────────────

export const getEvaluationConfig = (token: string) =>
  apiFetch<Record<string, unknown>>(`${WEBUI_API_BASE}/evaluations/config`, { token });

export const updateEvaluationConfig = (token: string, config: Record<string, unknown>) =>
  apiFetch<Record<string, unknown>>(`${WEBUI_API_BASE}/evaluations/config`, {
    token, method: 'POST', body: config,
  });

// ── Code execution config ──────────────────────────────────────────────────────

export const getCodeExecutionConfig = (token: string) =>
  apiFetch<Record<string, unknown>>(`${WEBUI_API_BASE}/configs/code_execution`, { token });

export const updateCodeExecutionConfig = (token: string, config: Record<string, unknown>) =>
  apiFetch<Record<string, unknown>>(`${WEBUI_API_BASE}/configs/code_execution`, {
    token, method: 'POST', body: config,
  });

// ── LDAP ───────────────────────────────────────────────────────────────────────

export interface LdapServerConfig {
  label:                  string;
  host:                   string;
  port?:                  number | null;
  attribute_for_mail:     string;
  attribute_for_username: string;
  app_dn:                 string;
  app_dn_password:        string;
  search_base:            string;
  search_filters:         string;
  use_tls:                boolean;
  certificate_path?:      string | null;
  validate_cert:          boolean;
  ciphers?:               string | null;
}

export const defaultLdapServer = (): LdapServerConfig => ({
  label:                  '',
  host:                   '',
  port:                   null,
  attribute_for_mail:     'mail',
  attribute_for_username: 'uid',
  app_dn:                 '',
  app_dn_password:        '',
  search_base:            '',
  search_filters:         '',
  use_tls:                true,
  certificate_path:       null,
  validate_cert:          true,
  ciphers:                'ALL',
});

export const getLdapConfig = (token: string) =>
  apiFetch<{ ENABLE_LDAP: boolean }>(`${WEBUI_API_BASE}/auths/admin/config/ldap`, { token });

// ── Models config (global defaults) ───────────────────────────────────────────

export interface ModelsConfig {
  DEFAULT_MODELS?: string;
  DEFAULT_PINNED_MODELS?: string;
  MODEL_ORDER_LIST?: string[];
  DEFAULT_MODEL_METADATA?: Record<string, unknown>;
  DEFAULT_MODEL_PARAMS?: Record<string, unknown>;
}

export const getModelsConfig = (token: string) =>
  apiFetch<ModelsConfig>(`${WEBUI_API_BASE}/configs/models`, { token });

export const setModelsConfig = (token: string, config: ModelsConfig) =>
  apiFetch<ModelsConfig>(`${WEBUI_API_BASE}/configs/models`, {
    token, method: 'POST', body: config,
  });

export const setDefaultPromptSuggestions = (token: string, suggestions: Array<{ content: string; title?: [string, string] }>) =>
  apiFetch<Array<{ content: string; title?: [string, string] }>>(`${WEBUI_API_BASE}/configs/suggestions`, {
    token, method: 'POST', body: { suggestions },
  });

// ── Workspace base-model overlay fetch (for admin catalog merge) ───────────────
// GET /api/v1/models/base — returns workspace configs for provider models
export const getWorkspaceModelConfigs = (token: string) =>
  apiFetch<Array<Record<string, unknown>>>(`${WEBUI_API_BASE}/models/base`, { token });

export const updateLdapConfig = (token: string, enable_ldap: boolean) =>
  apiFetch<{ ENABLE_LDAP: boolean }>(`${WEBUI_API_BASE}/auths/admin/config/ldap`, {
    token, method: 'POST', body: { enable_ldap },
  });

export const getLdapServer = (token: string) =>
  apiFetch<LdapServerConfig>(`${WEBUI_API_BASE}/auths/admin/config/ldap/server`, { token });

export const updateLdapServer = (token: string, payload: LdapServerConfig) =>
  apiFetch<LdapServerConfig>(`${WEBUI_API_BASE}/auths/admin/config/ldap/server`, {
    token, method: 'POST', body: payload,
  });

// ── Groups ─────────────────────────────────────────────────────────────────────

export interface Group {
  id:   string;
  name: string;
}

export const getGroups = (token: string) =>
  apiFetch<Group[]>(`${WEBUI_API_BASE}/groups/`, { token });

// ── Retrieval: Embedding config ────────────────────────────────────────────────

export interface OllamaEmbeddingConfig  { key: string; url: string }
export interface OpenAIEmbeddingConfig  { key: string; url: string }
export interface AzureEmbeddingConfig   { key: string; url: string; version: string }

export interface EmbeddingConfig {
  RAG_EMBEDDING_ENGINE:             string;
  RAG_EMBEDDING_MODEL:              string;
  RAG_EMBEDDING_BATCH_SIZE:         number;
  ENABLE_ASYNC_EMBEDDING:           boolean;
  RAG_EMBEDDING_CONCURRENT_REQUESTS: number;
  openai_config:                    OpenAIEmbeddingConfig;
  ollama_config:                    OllamaEmbeddingConfig;
  azure_openai_config:              AzureEmbeddingConfig;
}

export const defaultEmbeddingConfig = (): EmbeddingConfig => ({
  RAG_EMBEDDING_ENGINE:              '',
  RAG_EMBEDDING_MODEL:               'sentence-transformers/all-MiniLM-L6-v2',
  RAG_EMBEDDING_BATCH_SIZE:          1,
  ENABLE_ASYNC_EMBEDDING:            true,
  RAG_EMBEDDING_CONCURRENT_REQUESTS: 0,
  openai_config:       { key: '', url: '' },
  ollama_config:       { key: '', url: '' },
  azure_openai_config: { key: '', url: '', version: '' },
});

export const getEmbeddingConfig = (token: string) =>
  apiFetch<EmbeddingConfig>(`${RETRIEVAL_BASE}/embedding`, { token });

export const updateEmbeddingConfig = (token: string, payload: EmbeddingConfig) =>
  apiFetch<EmbeddingConfig>(`${RETRIEVAL_BASE}/embedding/update`, {
    token, method: 'POST', body: payload,
  });

// ── Retrieval: Danger-zone actions ─────────────────────────────────────────────

export const resetVectorDB = (token: string) =>
  apiFetch<{ status: boolean }>(`${RETRIEVAL_BASE}/reset/db`, {
    token, method: 'POST',
  });

export const reindexKnowledgeFiles = (token: string) =>
  apiFetch<{ status: boolean }>(`${WEBUI_API_BASE}/knowledge/reindex`, {
    token, method: 'POST',
  });

export const deleteAllFiles = (token: string) =>
  apiFetch<{ status: boolean }>(`${WEBUI_API_BASE}/files/all`, {
    token, method: 'DELETE',
  });
