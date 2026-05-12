// ─── Generic API response/domain types ───────────────────────────────────────

export interface ApiError {
  detail: string;
  status?: number;
}

// ── Knowledge ────────────────────────────────────────────────────────────────
export interface KnowledgeDocument {
  collection_name: string;
  filename: string;
  name: string;
  title: string;
}

export interface KnowledgeCollection {
  id: string;
  name: string;
  description?: string;
  data?: { file_ids?: string[] };
  files?: KnowledgeFile[];
  user_id?: string;
  updated_at: number;
  created_at: number;
  access_control?: unknown;
}

export interface KnowledgeFile {
  id: string;
  name: string;
  filename: string;
  collection_name?: string;
  meta?: Record<string, unknown>;
  data?: { status?: string };
}

// ── Tools / Functions / Skills / Prompts ─────────────────────────────────────
export interface Tool {
  id: string;
  name: string;
  description?: string;
  content?: string;
  user_id?: string;
  updated_at: number;
  created_at: number;
  access_control?: unknown;
  specs?: unknown[];
  meta?: Record<string, unknown>;
  write_access?: boolean;
  has_user_valves?: boolean;
  authenticated?: boolean;
  user?: { id: string; name: string; email: string };
}

export interface Skill {
  id: string;
  name: string;
  description?: string;
  content?: string;
  content_type?: string;
  source_url?: string | null;
  user_id?: string;
  is_active?: boolean;
  updated_at: number;
  created_at: number;
  access_control?: unknown;
  meta?: Record<string, unknown>;
  write_access?: boolean;
  user?: { id: string; name: string; email: string };
  access_grants?: Array<{ principal_type: 'user' | 'group'; principal_id: string; permission: 'read' | 'write' }>;
}

export interface FunctionItem {
  id: string;
  name: string;
  description?: string;
  content?: string;
  type?: 'filter' | 'action' | 'pipe';
  is_active?: boolean;
  is_global?: boolean;
  user_id?: string;
  updated_at: number;
  created_at: number;
  meta?: Record<string, unknown>;
}

export interface Prompt {
  command: string;
  title: string;
  content: string;
  user_id?: string;
  timestamp?: number;
  access_control?: unknown;
}

// ── Notes ────────────────────────────────────────────────────────────────────
export interface Note {
  id: string;
  title?: string;
  data?: { content?: string };
  meta?: Record<string, unknown>;
  user_id?: string;
  updated_at: number;
  created_at: number;
  access_control?: unknown;
}

// ── Channels ─────────────────────────────────────────────────────────────────
export interface Channel {
  id: string;
  name: string;
  description?: string;
  type?: 'group' | 'dm' | '';
  user_id?: string;
  members?: string[];
  unread_count?: number;
  last_message_at?: number;
  created_at: number;
  updated_at: number;
  access_control?: unknown;
  meta?: Record<string, unknown>;
}

export interface ChannelMessage {
  id: string;
  channel_id: string;
  user_id: string;
  content: string;
  data?: Record<string, unknown>;
  created_at: number;
  updated_at: number;
  user?: ChannelMessageUser;
}

export interface ChannelMessageUser {
  id: string;
  name: string;
  profile_image_url?: string;
}

// ── Groups ───────────────────────────────────────────────────────────────────
export interface Group {
  id: string;
  name: string;
  description?: string;
  user_ids?: string[];
  permissions?: Record<string, unknown>;
  user_id?: string;
  created_at: number;
  updated_at: number;
}

// ── Files ────────────────────────────────────────────────────────────────────
export interface UploadedFile {
  id: string;
  filename: string;
  meta?: {
    name?: string;
    content_type?: string;
    size?: number;
  };
  user_id?: string;
  created_at: number;
  updated_at: number;
}

// ── Services ─────────────────────────────────────────────────────────────────
export interface Service {
  id: string;
  name: string;
  description: string;
  route: string;
  cta?: string;
  status?: 'active' | 'coming-soon';
  icon?: string;
  is_accessible?: boolean;
}

// ── Analytics ────────────────────────────────────────────────────────────────
export interface AnalyticsSummary {
  total_users?: number;
  total_chats?: number;
  total_messages?: number;
  active_users?: number;
  [key: string]: unknown;
}

// ── Users (admin) ────────────────────────────────────────────────────────────
export interface AdminUser {
  id: string;
  name: string;
  email: string;
  role: string;
  profile_image_url?: string;
  created_at?: number;
  last_active_at?: number;
  oauth_sub?: string;
}

// ── Terminal ─────────────────────────────────────────────────────────────────
export interface TerminalServer {
  id: string;
  name: string;
  url?: string;
  key?: string;
}
