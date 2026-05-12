// ─── Chat & Message types ─────────────────────────────────────────────────────

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  timestamp?: number;
  model?: string;
  models?: string[];
  files?: ChatFile[];
  citations?: Citation[];
  statusHistory?: StatusItem[];
  done?: boolean;
  error?: string | { content: string };
  usage?: ResponseUsage;
  followUps?: string[];
  info?: Record<string, unknown>;
}

export interface ChatFile {
  id?: string;
  name?: string;
  url?: string;
  type?: string;
  /** MIME type stored alongside the semantic type for client-side preview rendering */
  mimeType?: string;
  size?: number;
  collection_name?: string;
}

export interface Citation {
  source: { name: string; url?: string };
  document: string[];
  metadata: Array<{ source: string }>;
}

export interface StatusItem {
  action: string;
  description?: string;
  done?: boolean;
  data?: unknown;
}

export interface ResponseUsage {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
  [key: string]: unknown;
}

export interface Chat {
  id: string;
  title: string;
  updated_at: number;
  created_at: number;
  user_id?: string;
  pinned?: boolean;
  archived?: boolean;
  share_id?: string;
  folder_id?: string;
  tags?: ChatTag[];
  meta?: {
    tags?: ChatTag[];
  };
  models?: string[];
  messages?: ChatMessage[];
}

export interface ChatTag {
  name: string;
}

export interface ChatFolder {
  id: string;
  name: string;
  parent_id?: string;
  created_at: number;
  updated_at: number;
}

export interface NewChatPayload {
  model?: string;
  messages?: ChatMessage[];
  title?: string;
}

export type MessageContentPart =
  | { type: 'text'; text: string }
  | { type: 'image_url'; image_url: { url: string } };

export interface ChatCompletionPayload {
  model: string;
  /** Content can be a plain string or a multimodal array (text + image_url parts) */
  messages: Array<{ role: string; content: string | MessageContentPart[] }>;
  stream?: boolean;
  temperature?: number;
  max_tokens?: number;
  [key: string]: unknown;
}

export interface PipelineStep {
  id: string;
  action: string;
  description: string;
  status: 'started' | 'done' | 'error';
  metadata?: Record<string, unknown>;
}

export interface TextStreamUpdate {
  done: boolean;
  value: string;
  sources?: unknown;
  selectedModelId?: string;
  error?: unknown;
  usage?: ResponseUsage;
  followUps?: string[];
  step?: PipelineStep;
}

// ─── Full chat history types (server format) ──────────────────────────────────

export interface ChatHistoryMessage {
  id: string;
  parentId: string | null;
  childrenIds: string[];
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  model?: string;
  timestamp?: number;
  files?: ChatFile[];
  citations?: Citation[];
  followUps?: string[];
  done?: boolean;
  error?: string | { content: string };
  info?: Record<string, unknown>;
  usage?: ResponseUsage;
}

export interface ChatHistoryData {
  messages: Record<string, ChatHistoryMessage>;
  currentId: string | null;
}

export interface FullChatData {
  title: string;
  models: string[];
  system: string;
  params: Record<string, unknown>;
  history: ChatHistoryData;
  messages: ChatHistoryMessage[];
  tags: ChatTag[];
  timestamp: number;
  files: ChatFile[];
}

export interface FullChatResponse extends Chat {
  chat?: FullChatData;
}
