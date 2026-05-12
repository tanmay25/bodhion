// ─── Admin: Evaluations API ────────────────────────────────────────────────────
import { apiFetch, WEBUI_API_BASE } from '@/lib/api/client';

// ── Response shapes ────────────────────────────────────────────────────────────

export interface LeaderboardEntry {
  model_id:  string;
  rating:    number;
  won:       number;
  lost:      number;
  top_tags?: { tag: string; count: number }[];
}

export interface LeaderboardResult {
  entries: LeaderboardEntry[];
}

export interface ModelHistoryItem {
  date: string;
  won:  number;
  lost: number;
}

export interface FeedbackUser {
  id:    string;
  name?: string;
}

export interface FeedbackData {
  model_id?:         string;
  sibling_model_ids?: string[];
  rating?:           number | string;
  reason?:           string;
  comment?:          string;
  tags?:             string[];
  details?:          { rating?: string };
}

export interface FeedbackMeta {
  chat_id?:    string;
  message_id?: string;
}

export interface FeedbackSnapshot {
  chat?: {
    chat?: {
      history: {
        messages: Record<string, { content: string; parentId?: string }>;
      };
    };
  };
}

export interface FeedbackItem {
  id:         string;
  user:       FeedbackUser;
  data:       FeedbackData;
  meta?:      FeedbackMeta;
  snapshot?:  FeedbackSnapshot;
  updated_at: number;
  created_at: number;
}

export interface FeedbackListResult {
  items: FeedbackItem[];
  total: number;
}

// ── Endpoints ──────────────────────────────────────────────────────────────────

export const getLeaderboard = (token: string, query = '') =>
  apiFetch<LeaderboardResult>(
    `${WEBUI_API_BASE}/evaluations/leaderboard${query ? `?query=${encodeURIComponent(query)}` : ''}`,
    { token }
  );

export const getModelHistory = (token: string, modelId: string, days = 30) =>
  apiFetch<{ history: ModelHistoryItem[] }>(
    `${WEBUI_API_BASE}/evaluations/leaderboard/${encodeURIComponent(modelId)}/history?days=${days}`,
    { token }
  );

export const getFeedbackItems = (
  token: string,
  orderBy = 'updated_at',
  direction: 'asc' | 'desc' = 'desc',
  page = 1
) => {
  const sp = new URLSearchParams({
    order_by:  orderBy,
    direction,
    page:      String(page),
  });
  return apiFetch<FeedbackListResult>(
    `${WEBUI_API_BASE}/evaluations/feedbacks/list?${sp}`,
    { token }
  );
};

export const getFeedbackById = (token: string, feedbackId: string) =>
  apiFetch<FeedbackItem>(
    `${WEBUI_API_BASE}/evaluations/feedback/${feedbackId}`,
    { token }
  );

export const deleteFeedbackById = (token: string, feedbackId: string) =>
  apiFetch<{ id: string }>(
    `${WEBUI_API_BASE}/evaluations/feedback/${feedbackId}`,
    { token, method: 'DELETE' }
  );

export const exportAllFeedbacks = (token: string) =>
  apiFetch<FeedbackItem[]>(
    `${WEBUI_API_BASE}/evaluations/feedbacks/all/export`,
    { token }
  );
