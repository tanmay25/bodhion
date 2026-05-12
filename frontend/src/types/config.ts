// ─── Backend Config types ─────────────────────────────────────────────────────
// Ported from the Config type in src/lib/stores/index.ts (Svelte app).

import type { OAuthProviders } from './auth';

export interface BackendFeatures {
  auth: boolean;
  auth_trusted_header: boolean;
  enable_api_keys: boolean;
  enable_signup: boolean;
  enable_login_form: boolean;
  enable_ldap: boolean;
  enable_signup_password_confirmation?: boolean;
  enable_web_search?: boolean;
  enable_google_drive_integration: boolean;
  enable_onedrive_integration: boolean;
  enable_image_generation: boolean;
  enable_admin_export: boolean;
  enable_admin_chat_access: boolean;
  enable_admin_analytics: boolean;
  show_admin_evaluations?: boolean;
  show_admin_integrations?: boolean;
  show_admin_web_search?: boolean;
  show_admin_code_execution?: boolean;
  show_admin_interface?: boolean;
  show_admin_audio?: boolean;
  show_admin_images?: boolean;
  show_admin_pipelines?: boolean;
  show_admin_database?: boolean;
  enable_community_sharing: boolean;
  enable_memories: boolean;
  enable_autocomplete_generation: boolean;
  enable_direct_connections: boolean;
  enable_version_update_check: boolean;
  enable_websocket?: boolean;
  folder_max_file_count?: number;
}

export interface PromptSuggestion {
  content: string;
  title: [string, string];
}

export interface BackendAudioConfig {
  tts?: { engine?: string; voice?: string; split_on?: string };
  stt?: { engine?: string };
}

export interface BackendConfig {
  status: boolean;
  name: string;
  version: string;
  default_locale: string;
  default_models: string;
  default_prompt_suggestions: PromptSuggestion[];
  features: BackendFeatures;
  oauth: { providers: OAuthProviders };
  audio?: BackendAudioConfig;
  onboarding?: boolean;
  license_metadata?: unknown;
  ui?: {
    pending_user_overlay_title?: string;
    pending_user_overlay_content?: string;
  };
  metadata?: {
    login_footer?: string;
  };
}

export interface VersionInfo {
  current: string;
  latest: string;
}

export interface Banner {
  id: string;
  type: 'info' | 'warning' | 'error';
  content: string;
  dismissible: boolean;
  timestamp: number;
}

export interface AudioSettings {
  stt: unknown;
  tts: unknown;
  STTEngine?: string;
  TTSEngine?: string;
  speaker?: string;
  model?: string;
  nonLocalVoices?: boolean;
}

export interface TitleSettings {
  auto?: boolean;
  model?: string;
  modelExternal?: string;
  prompt?: string;
}

export interface UserSettings {
  pinnedModels?: string[];
  toolServers?: ToolServerConfig[];
  terminalServers?: TerminalServerConfig[];
  detectArtifacts?: boolean;
  showUpdateToast?: boolean;
  showChangelog?: boolean;
  notificationEnabled?: boolean;
  notificationSound?: boolean;
  notificationSoundAlways?: boolean;
  textScale?: number;
  widescreenMode?: boolean;
  richTextInput?: boolean;
  chatBubble?: boolean;
  chatDirection?: 'LTR' | 'RTL' | 'auto';
  ctrlEnterToSend?: boolean;
  renderMarkdownInPreviews?: boolean;
  collapseCodeBlocks?: boolean;
  expandDetails?: boolean;
  splitLargeDeltas?: boolean;
  highContrastMode?: boolean;
  imageCompression?: boolean;
  imageCompressionSize?: number;
  largeTextAsFile?: boolean;
  promptAutocomplete?: boolean;
  memory?: boolean;
  autoTags?: boolean;
  autoFollowUps?: boolean;
  backgroundImageUrl?: string;
  landingPageMode?: string;
  showUsername?: boolean;
  showChatTitleInTab?: boolean;
  models?: string[];
  conversationMode?: boolean;
  speechAutoSend?: boolean;
  responseAutoPlayback?: boolean;
  audio?: AudioSettings;
  title?: TitleSettings;
  directConnections?: DirectConnections | null;
  params?: Record<string, unknown>;
  version?: string;
  [key: string]: unknown;
}

export interface ToolServerConfig {
  url: string;
  auth_type?: 'bearer' | 'session';
  key?: string;
  path?: string;
  config?: { enable?: boolean };
}

export interface TerminalServerConfig {
  url: string;
  name?: string;
  auth_type?: 'bearer' | 'session';
  key?: string;
  path?: string;
  enabled?: boolean;
}

export interface DirectConnections {
  OPENAI_API_BASE_URLS: string[];
  OPENAI_API_KEYS: string[];
  OPENAI_API_CONFIGS: Record<string, { enable?: boolean; model_ids?: string[]; prefix_id?: string }>;
}
