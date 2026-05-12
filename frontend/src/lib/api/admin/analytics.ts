// ─── Admin: Analytics API ──────────────────────────���──────────────────────────
import { apiFetch, WEBUI_API_BASE } from '@/lib/api/client';

// ── Shared param type ────────────────────��────────────────────────────────────
export interface AnalyticsDateParams {
  startDate?: number | null;
  endDate?:   number | null;
  groupId?:   string | null;
}

// ── Response shapes ───────────────────────────────���───────────────────────────
export interface AnalyticsSummary {
  total_messages: number;
  total_chats:    number;
  total_models:   number;
  total_users:    number;
}

export interface ModelAnalyticsItem {
  model_id:     string;
  name?:        string;
  count:        number;
  total_tokens?: number;
}

export interface UserAnalyticsItem {
  user_id:       string;
  name?:         string;
  email?:        string;
  count:         number;
  total_tokens?: number;
}

export interface DailyStatsItem {
  date:   string;
  models: Record<string, number>;
}

export interface TokenUsageItem {
  model_id:      string;
  input_tokens:  number;
  output_tokens: number;
  total_tokens:  number;
}

export interface ModelChatItem {
  chat_id:       string;
  first_message: string;
  updated_at:    number;
  user_id:       string;
  user_name:     string;
}

export interface ModelOverviewHistory {
  date: string;
  won:  number;
  lost: number;
}

// ── Period → date range helper ────────────────────────────────────────────────
export type AnalyticsPeriod = '24h' | '7d' | '30d' | '90d' | 'all';

export function periodToParams(period: AnalyticsPeriod): {
  startDate: number | null;
  endDate:   number | null;
  granularity: 'hourly' | 'daily';
} {
  const now = Math.floor(Date.now() / 1000);
  switch (period) {
    case '24h': return { startDate: now - 86_400,     endDate: now, granularity: 'hourly' };
    case '7d':  return { startDate: now - 604_800,    endDate: now, granularity: 'daily'  };
    case '30d': return { startDate: now - 2_592_000,  endDate: now, granularity: 'daily'  };
    case '90d': return { startDate: now - 7_776_000,  endDate: now, granularity: 'daily'  };
    case 'all': return { startDate: null,              endDate: null, granularity: 'daily' };
  }
}

// ── API builders ──────────────────────────��───────────────────────────────────
function buildParams(
  p: AnalyticsDateParams & { granularity?: string; limit?: number }
): string {
  const sp = new URLSearchParams();
  if (p.startDate) sp.set('start_date', String(p.startDate));
  if (p.endDate)   sp.set('end_date',   String(p.endDate));
  if (p.groupId)   sp.set('group_id',   p.groupId);
  if (p.granularity) sp.set('granularity', p.granularity);
  if (p.limit)     sp.set('limit',      String(p.limit));
  const s = sp.toString();
  return s ? `?${s}` : '';
}

// ── Endpoints ────────────────────���───────────────────────��────────────────────

export const getAnalyticsSummary = (token: string, params: AnalyticsDateParams = {}) =>
  apiFetch<AnalyticsSummary>(
    `${WEBUI_API_BASE}/analytics/summary${buildParams(params)}`,
    { token }
  );

export const getModelAnalytics = (token: string, params: AnalyticsDateParams = {}) =>
  apiFetch<{ models: ModelAnalyticsItem[] }>(
    `${WEBUI_API_BASE}/analytics/models${buildParams(params)}`,
    { token }
  );

export const getUserAnalytics = (
  token: string,
  params: AnalyticsDateParams & { limit?: number } = {}
) =>
  apiFetch<{ users: UserAnalyticsItem[] }>(
    `${WEBUI_API_BASE}/analytics/users${buildParams({ limit: 50, ...params })}`,
    { token }
  );

export const getDailyStats = (
  token: string,
  params: AnalyticsDateParams & { granularity?: 'hourly' | 'daily' } = {}
) =>
  apiFetch<{ data: DailyStatsItem[] }>(
    `${WEBUI_API_BASE}/analytics/daily${buildParams(params)}`,
    { token }
  );

export const getTokenUsage = (token: string, params: AnalyticsDateParams = {}) =>
  apiFetch<{
    models:              TokenUsageItem[];
    total_input_tokens:  number;
    total_output_tokens: number;
    total_tokens:        number;
  }>(
    `${WEBUI_API_BASE}/analytics/tokens${buildParams(params)}`,
    { token }
  );

export const getModelChats = (
  token: string,
  modelId: string,
  params: AnalyticsDateParams & { skip?: number; limit?: number } = {}
) =>
  apiFetch<{ chats: ModelChatItem[] }>(
    `${WEBUI_API_BASE}/analytics/models/${encodeURIComponent(modelId)}/chats${buildParams({ limit: 50, ...params })}`,
    { token }
  );

export const getModelOverview = (token: string, modelId: string, days = 30) =>
  apiFetch<{ history: ModelOverviewHistory[]; tags: { tag: string; count: number }[] }>(
    `${WEBUI_API_BASE}/analytics/models/${encodeURIComponent(modelId)}/overview?days=${days}`,
    { token }
  );
