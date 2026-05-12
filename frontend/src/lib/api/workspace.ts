import { apiFetch, RETRIEVAL_BASE, WEBUI_API_BASE } from './client';
import type { KnowledgeCollection, Tool, Skill, FunctionItem, Prompt } from '@/types/api';

export interface WorkspaceListQuery {
  query?: string;
  viewOption?: string;
  tag?: string;
  orderBy?: string;
  direction?: string;
  page?: number;
}

export interface WorkspaceListResponse<T> {
  items: T[];
  total: number;
}

export interface WorkspaceService {
  id: string;
  name: string;
  route: string;
  type?: string;
  description?: string;
  status?: string;
  access_grants?: unknown[];
}

export interface AccessGrant {
  id?: string;
  principal_type: 'user' | 'group';
  principal_id: string;
  permission: 'read' | 'write';
}

export interface WorkspaceGroupInfo {
  id: string;
  name: string;
  member_count?: number;
}

export interface WorkspaceUserInfo {
  id: string;
  name?: string;
  email?: string;
}

const toWorkspaceQueryString = (query: WorkspaceListQuery = {}) => {
  const params = new URLSearchParams();
  if (query.query) params.append('query', query.query);
  if (query.viewOption) params.append('view_option', query.viewOption);
  if (query.tag) params.append('tag', query.tag);
  if (query.orderBy) params.append('order_by', query.orderBy);
  if (query.direction) params.append('direction', query.direction);
  if (query.page) params.append('page', String(query.page));
  return params.toString();
};

export const getKnowledgeCollections = (token: string) =>
  apiFetch<KnowledgeCollection[]>(`${WEBUI_API_BASE}/knowledge/`, { token });

export const searchKnowledgeBases = (token: string, query: WorkspaceListQuery = {}) =>
  apiFetch<WorkspaceListResponse<KnowledgeCollection>>(
    `${WEBUI_API_BASE}/knowledge/search?${toWorkspaceQueryString(query)}`,
    { token }
  );

export const searchKnowledgeFiles = (
  token: string,
  query: WorkspaceListQuery = {}
) =>
  apiFetch<KnowledgeFilesResponse>(
    `${WEBUI_API_BASE}/knowledge/search/files?${toWorkspaceQueryString(query)}`,
    { token }
  );

export const getKnowledgeById = (token: string, id: string) =>
  apiFetch<KnowledgeCollection>(`${WEBUI_API_BASE}/knowledge/${id}`, { token });

export const createKnowledge = (token: string, body: { name: string; description?: string }) =>
  apiFetch<KnowledgeCollection>(`${WEBUI_API_BASE}/knowledge/create`, {
    method: 'POST',
    body,
    token,
  });

export const updateKnowledge = (token: string, id: string, body: Partial<KnowledgeCollection>) =>
  apiFetch<KnowledgeCollection>(`${WEBUI_API_BASE}/knowledge/${id}/update`, {
    method: 'POST',
    body,
    token,
  });

export const deleteKnowledge = (token: string, id: string) =>
  apiFetch<{ success: boolean }>(`${WEBUI_API_BASE}/knowledge/${id}/delete`, {
    method: 'DELETE',
    token,
  });

export const addFileToKnowledge = (token: string, id: string, fileId: string) =>
  apiFetch<KnowledgeCollection>(`${WEBUI_API_BASE}/knowledge/${id}/file/add`, {
    method: 'POST',
    body: { file_id: fileId },
    token,
  });

export const removeFileFromKnowledge = (token: string, id: string, fileId: string) =>
  apiFetch<KnowledgeCollection>(`${WEBUI_API_BASE}/knowledge/${id}/file/remove`, {
    method: 'POST',
    body: { file_id: fileId },
    token,
  });

export const updateKnowledgeAccess = (token: string, id: string, accessGrants: AccessGrant[]) =>
  apiFetch<KnowledgeCollection>(`${WEBUI_API_BASE}/knowledge/${id}/access/update`, {
    method: 'POST',
    body: { access_grants: accessGrants },
    token,
  });

export const resetKnowledgeById = (token: string, id: string) =>
  apiFetch<KnowledgeCollection>(`${WEBUI_API_BASE}/knowledge/${id}/reset`, {
    method: 'POST',
    token,
  });

export interface KnowledgeFilesResponse {
  items: KnowledgeFileItem[];
  total: number;
}

export interface KnowledgeFileItem {
  id: string;
  filename?: string;
  meta?: { name?: string; size?: number; content_type?: string; [key: string]: unknown };
  data?: { status?: string; [key: string]: unknown };
}

export const searchKnowledgeFilesById = (
  token: string,
  id: string,
  params: { query?: string; page?: number } = {}
) => {
  const qs = new URLSearchParams();
  if (params.query) qs.append('query', params.query);
  qs.append('page', String(params.page ?? 1));
  return apiFetch<KnowledgeFilesResponse>(
    `${WEBUI_API_BASE}/knowledge/${id}/files?${qs.toString()}`,
    { token }
  );
};

export const processWebPage = (
  token: string,
  url: string,
  opts?: { collection_name?: string; process?: boolean }
) =>
  apiFetch<{ content?: string }>(
    `${RETRIEVAL_BASE}/process/web${opts?.process === false ? '?process=false' : ''}`,
    {
      method: 'POST',
      body: {
        url,
        collection_name: opts?.collection_name ?? '',
      },
      token,
    }
  );

export const exportKnowledgeById = async (token: string, id: string): Promise<Blob> => {
  const response = await fetch(`${WEBUI_API_BASE}/knowledge/${id}/export`, {
    method: 'GET',
    headers: { Authorization: `Bearer ${token}` },
    credentials: 'include',
  });

  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({ detail: response.statusText }));
    throw errorBody;
  }

  return response.blob();
};

export const getTools = (token: string) =>
  apiFetch<Tool[]>(`${WEBUI_API_BASE}/tools/`, { token });

export const getToolList = (token: string) =>
  apiFetch<Array<Tool & { write_access?: boolean; user?: { id: string; name: string; email: string } }>>(
    `${WEBUI_API_BASE}/tools/list`,
    { token }
  );

export const loadToolByUrl = (token: string, url: string) =>
  apiFetch<unknown>(`${WEBUI_API_BASE}/tools/load/url`, {
    method: 'POST',
    body: { url },
    token,
  });

export const exportTools = (token: string) =>
  apiFetch<Tool[]>(`${WEBUI_API_BASE}/tools/export`, { token });

export const getToolById = (token: string, id: string) =>
  apiFetch<Tool>(`${WEBUI_API_BASE}/tools/id/${id}`, { token });

export const createTool = (token: string, body: Partial<Tool>) =>
  apiFetch<Tool>(`${WEBUI_API_BASE}/tools/create`, { method: 'POST', body, token });

export const updateTool = (token: string, id: string, body: Partial<Tool>) =>
  apiFetch<Tool>(`${WEBUI_API_BASE}/tools/id/${id}/update`, { method: 'POST', body, token });

export const deleteTool = (token: string, id: string) =>
  apiFetch<{ success: boolean }>(`${WEBUI_API_BASE}/tools/id/${id}/delete`, {
    method: 'DELETE',
    token,
  });

export const getToolUserValvesSpec = (token: string, id: string) =>
  apiFetch<Record<string, unknown>>(`${WEBUI_API_BASE}/tools/id/${id}/valves/user/spec`, { token });

export const getToolUserValves = (token: string, id: string) =>
  apiFetch<Record<string, unknown>>(`${WEBUI_API_BASE}/tools/id/${id}/valves/user`, { token });

export const updateToolUserValves = (token: string, id: string, valves: Record<string, unknown>) =>
  apiFetch<Record<string, unknown>>(`${WEBUI_API_BASE}/tools/id/${id}/valves/user/update`, {
    method: 'POST',
    body: valves,
    token,
  });

export const getSkills = (token: string) =>
  apiFetch<Skill[]>(`${WEBUI_API_BASE}/skills/`, { token });

export const getSkillList = (token: string, query: WorkspaceListQuery = {}) =>
  apiFetch<WorkspaceListResponse<Skill>>(
    `${WEBUI_API_BASE}/skills/list?${toWorkspaceQueryString(query)}`,
    { token }
  );

export const getSkillById = (token: string, id: string) =>
  apiFetch<Skill>(`${WEBUI_API_BASE}/skills/id/${id}`, { token });

export const updateSkillAccess = (token: string, id: string, accessGrants: AccessGrant[]) =>
  apiFetch<Skill>(`${WEBUI_API_BASE}/skills/id/${id}/access/update`, {
    method: 'POST',
    body: { access_grants: accessGrants },
    token,
  });

export const createSkill = (token: string, body: Partial<Skill>) =>
  apiFetch<Skill>(`${WEBUI_API_BASE}/skills/create`, { method: 'POST', body, token });

export const updateSkill = (token: string, id: string, body: Partial<Skill>) =>
  apiFetch<Skill>(`${WEBUI_API_BASE}/skills/id/${id}/update`, { method: 'POST', body, token });

export const deleteSkill = (token: string, id: string) =>
  apiFetch<{ success: boolean }>(`${WEBUI_API_BASE}/skills/id/${id}/delete`, {
    method: 'DELETE',
    token,
  });

export const toggleSkillById = (token: string, id: string) =>
  apiFetch<Skill>(`${WEBUI_API_BASE}/skills/id/${id}/toggle`, {
    method: 'POST',
    token,
  });

export interface HubSkill {
  name: string;
  description: string;
  category: string;
  raw_url: string;
  tags: string[];
  author?: string;
  version?: string;
  license?: string;
  homepage?: string;
  prerequisites?: Record<string, unknown>;
  content?: string;
}

export const importSkillFromUrl = (token: string, url: string) =>
  apiFetch<Skill>(`${WEBUI_API_BASE}/skills/import/url`, {
    method: 'POST',
    body: { url },
    token,
  });

export const getSkillHubIndex = (
  token: string,
  source: string,
  githubToken?: string,
) =>
  apiFetch<HubSkill[]>(
    `${WEBUI_API_BASE}/skills/hub/index?source=${encodeURIComponent(source)}`,
    {
      token,
      headers: githubToken ? { 'X-GitHub-Token': githubToken } : {},
    },
  );

export const getFunctions = (token: string) =>
  apiFetch<FunctionItem[]>(`${WEBUI_API_BASE}/functions/`, { token });

export const getFunctionById = (token: string, id: string) =>
  apiFetch<FunctionItem>(`${WEBUI_API_BASE}/functions/id/${id}`, { token });

export const createFunction = (token: string, body: Partial<FunctionItem>) =>
  apiFetch<FunctionItem>(`${WEBUI_API_BASE}/functions/create`, { method: 'POST', body, token });

export const updateFunction = (token: string, id: string, body: Partial<FunctionItem>) =>
  apiFetch<FunctionItem>(`${WEBUI_API_BASE}/functions/id/${id}/update`, {
    method: 'POST',
    body,
    token,
  });

export const deleteFunction = (token: string, id: string) =>
  apiFetch<{ success: boolean }>(`${WEBUI_API_BASE}/functions/id/${id}/delete`, {
    method: 'DELETE',
    token,
  });

export const toggleFunctionById = (token: string, id: string) =>
  apiFetch<FunctionItem>(`${WEBUI_API_BASE}/functions/id/${id}/toggle`, {
    method: 'POST',
    token,
  });

export const getFunctionUserValvesSpec = (token: string, id: string) =>
  apiFetch<Record<string, unknown>>(`${WEBUI_API_BASE}/functions/id/${encodeURIComponent(id)}/valves/user/spec`, { token });

export const getFunctionUserValves = (token: string, id: string) =>
  apiFetch<Record<string, unknown>>(`${WEBUI_API_BASE}/functions/id/${encodeURIComponent(id)}/valves/user`, { token });

export const updateFunctionUserValves = (token: string, id: string, valves: Record<string, unknown>) =>
  apiFetch<Record<string, unknown>>(`${WEBUI_API_BASE}/functions/id/${encodeURIComponent(id)}/valves/user/update`, {
    method: 'POST',
    body: valves,
    token,
  });

export const getPrompts = (token: string) =>
  apiFetch<Prompt[]>(`${WEBUI_API_BASE}/prompts/`, { token });

export const getPromptTags = (token: string) =>
  apiFetch<string[]>(`${WEBUI_API_BASE}/prompts/tags`, { token });

export const getPromptItems = (token: string, query: WorkspaceListQuery = {}) =>
  apiFetch<WorkspaceListResponse<Prompt & { write_access?: boolean; user?: { id: string; name: string; email: string } }>>(
    `${WEBUI_API_BASE}/prompts/list?${toWorkspaceQueryString(query)}`,
    { token }
  );

export const getPromptByCommand = (token: string, command: string) =>
  apiFetch<Prompt>(`${WEBUI_API_BASE}/prompts/command/${encodeURIComponent(command)}`, { token });

export const createPrompt = (token: string, body: Partial<Prompt>) =>
  apiFetch<Prompt>(`${WEBUI_API_BASE}/prompts/create`, { method: 'POST', body, token });

export const updatePrompt = (token: string, command: string, body: Partial<Prompt>) =>
  apiFetch<Prompt>(`${WEBUI_API_BASE}/prompts/command/${encodeURIComponent(command)}/update`, {
    method: 'POST',
    body,
    token,
  });

export const deletePrompt = (token: string, command: string) =>
  apiFetch<{ success: boolean }>(
    `${WEBUI_API_BASE}/prompts/command/${encodeURIComponent(command)}/delete`,
    { method: 'DELETE', token }
  );

export const togglePromptById = (token: string, promptId: string) =>
  apiFetch<Prompt>(`${WEBUI_API_BASE}/prompts/id/${promptId}/toggle`, {
    method: 'POST',
    token,
  });

export const getWorkspaceServices = (token: string) =>
  apiFetch<WorkspaceService[]>(`${WEBUI_API_BASE}/services/workspace/list`, { token });

export const updateServiceAccess = (token: string, serviceId: string, accessGrants: AccessGrant[]) =>
  apiFetch<WorkspaceService>(`${WEBUI_API_BASE}/services/${serviceId}/access`, {
    method: 'POST',
    body: { access_grants: accessGrants },
    token,
  });

export const getWorkspaceGroups = (token: string) =>
  apiFetch<WorkspaceGroupInfo[]>(`${WEBUI_API_BASE}/groups/?share=true`, { token });

export const getWorkspaceGroupInfoById = (token: string, groupId: string) =>
  apiFetch<WorkspaceGroupInfo>(`${WEBUI_API_BASE}/groups/id/${groupId}/info`, { token });

export const getWorkspaceUserInfoById = (token: string, userId: string) =>
  apiFetch<WorkspaceUserInfo>(`${WEBUI_API_BASE}/users/${userId}/info`, { token });
