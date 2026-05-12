// ─── Model types ──────────────────────────────────────────────────────────────
// Ported from the Model / OllamaModel / OpenAIModel types in src/lib/stores/index.ts.

export interface ModelConfig {
  id: string;
  name?: string;
  base_model_id?: string | null;
  meta?: {
    profile_image_url?: string;
    description?: string;
    capabilities?: ModelCapabilities;
    tags?: Array<{ name: string }>;
  };
  params?: Record<string, unknown>;
  access_control?: unknown;
}

export interface ModelCapabilities {
  file_context?: boolean;
  vision?: boolean;
  file_upload?: boolean;
  web_search?: boolean;
  image_generation?: boolean;
  code_interpreter?: boolean;
  citations?: boolean;
  status_updates?: boolean;
  usage?: unknown;
  builtin_tools?: boolean;
}

type BaseModel = {
  id: string;
  name: string;
  info?: ModelConfig;
  owned_by: 'ollama' | 'openai' | 'arena';
  urlIdx?: number;
};

export interface OpenAIModel extends BaseModel {
  owned_by: 'openai';
  external: boolean;
  source?: string;
}

export interface OllamaModelDetails {
  parent_model: string;
  format: string;
  family: string;
  families: string[] | null;
  parameter_size: string;
  quantization_level: string;
}

export interface OllamaModel extends BaseModel {
  owned_by: 'ollama';
  details: OllamaModelDetails;
  size: number;
  description: string;
  model: string;
  modified_at: string;
  digest: string;
  ollama?: {
    name?: string;
    model?: string;
    modified_at: string;
    size?: number;
    digest?: string;
    details?: OllamaModelDetails;
    urls?: number[];
  };
}

export type Model = OpenAIModel | OllamaModel;

export interface ArenaModel extends BaseModel {
  owned_by: 'arena';
}
