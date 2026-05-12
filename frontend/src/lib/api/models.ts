// ─── Models API ───────────────────────────────────────────────────────────────
// Mirrors src/lib/apis/models/index.ts and parts of src/lib/apis/index.ts.

import { apiFetch, API_BASE_URL, WEBUI_API_BASE } from './client';
import type { Model, ModelConfig } from '@/types/models';
import type { DirectConnections } from '@/types/config';

export interface WorkspaceListQuery {
  query?: string;
  viewOption?: string;
  tag?: string;
  orderBy?: string;
  direction?: string;
  page?: number;
}

export interface WorkspaceModelItem extends ModelConfig {
  is_active?: boolean;
  write_access?: boolean;
  user_id?: string;
  user?: {
    id: string;
    name: string;
    email: string;
  };
}

export interface WorkspaceModelListResponse {
  items: WorkspaceModelItem[];
  total: number;
}

const buildWorkspaceSearchParams = (query: WorkspaceListQuery) => {
  const params = new URLSearchParams();
  if (query.query) params.append('query', query.query);
  if (query.viewOption) params.append('view_option', query.viewOption);
  if (query.tag) params.append('tag', query.tag);
  if (query.orderBy) params.append('order_by', query.orderBy);
  if (query.direction) params.append('direction', query.direction);
  if (query.page) params.append('page', String(query.page));
  return params.toString();
};

export const getModels = async (
  token: string,
  connections: DirectConnections | null = null,
  base = false,
  refresh = false
): Promise<Model[]> => {
  const params = new URLSearchParams();
  if (refresh) params.set('refresh', 'true');

  const res = await apiFetch<{ data: Model[] }>(
    `${API_BASE_URL}/api/models${base ? '/base' : ''}?${params}`,
    { token }
  );

  let models = res?.data ?? [];

  // Append direct-connection local models if configured (mirrors Svelte logic)
  if (connections && !base) {
    const { OPENAI_API_BASE_URLS, OPENAI_API_CONFIGS } = connections;
    const localModels: Model[] = [];

    for (const idx in OPENAI_API_BASE_URLS) {
      const apiConfig = OPENAI_API_CONFIGS?.[idx] ?? {};
      if (apiConfig.enable === false) continue;
      const modelIds = apiConfig.model_ids ?? [];
      if (modelIds.length > 0) {
        modelIds.forEach((id) => {
          localModels.push({
            id,
            name: id,
            owned_by: 'openai',
            external: true,
            urlIdx: Number(idx),
          } as Model);
        });
      }
    }
    models = [...models, ...localModels];
  }

  return models;
};

export const getBaseModels = (token: string) => getModels(token, null, true);

// Workspace list/search parity (Svelte: /models/list, /models/tags)
export const getModelItems = (token: string, query: WorkspaceListQuery = {}) =>
  apiFetch<WorkspaceModelListResponse>(
    `${WEBUI_API_BASE}/models/list?${buildWorkspaceSearchParams(query)}`,
    { token }
  );

export const getModelTags = (token: string) =>
  apiFetch<string[]>(`${WEBUI_API_BASE}/models/tags`, { token });

export const exportModels = (token: string) =>
  apiFetch<WorkspaceModelItem[]>(`${WEBUI_API_BASE}/models/export`, { token });

export const importModels = (token: string, models: object[]) =>
  apiFetch<boolean>(`${WEBUI_API_BASE}/models/import`, {
    method: 'POST',
    body: { models },
    token,
  });

// Model CRUD (custom models / workspace models)
export const getModelById = (token: string, id: string) =>
  apiFetch<ModelConfig>(`${WEBUI_API_BASE}/models/model?id=${encodeURIComponent(id)}`, { token });

export const createModel = (token: string, body: Partial<ModelConfig>) =>
  apiFetch<ModelConfig>(`${WEBUI_API_BASE}/models/create`, {
    method: 'POST',
    body,
    token,
  });

export const updateModel = (token: string, id: string, body: Partial<ModelConfig>) =>
  apiFetch<ModelConfig>(`${WEBUI_API_BASE}/models/model/update`, {
    method: 'POST',
    body: { id, ...body },
    token,
  });

export const deleteModel = (token: string, id: string) =>
  apiFetch<{ success: boolean }>(`${WEBUI_API_BASE}/models/model/delete`, {
    method: 'POST',
    body: { id },
    token,
  });

export const toggleModelById = (token: string, id: string) =>
  apiFetch<WorkspaceModelItem>(`${WEBUI_API_BASE}/models/model/toggle?id=${encodeURIComponent(id)}`, {
    method: 'POST',
    token,
  });

export const updateModelAccessGrants = (token: string, id: string, name: string, accessGrants: unknown[]) =>
  apiFetch<WorkspaceModelItem>(`${WEBUI_API_BASE}/models/model/access/update`, {
    method: 'POST',
    body: { id, name, access_grants: accessGrants },
    token,
  });

export const getVersionUpdates = (token: string) =>
  apiFetch<{ current: string; latest: string }>(
    `${WEBUI_API_BASE.replace('/api/v1', '')}/api/version/updates`,
    { token }
  );
