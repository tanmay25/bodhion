'use client';

import { SettingsSection, SettingsField, SettingsToggleRow } from '@/components/shared/SettingsSection';
import { SensitiveInput } from '@/components/shared/SensitiveInput';
import type { EmbeddingConfig } from '@/lib/api/admin/settings';

const FIELD  = 'admin-input h-9 w-full rounded-md px-3 text-sm';

interface Props {
  config:    EmbeddingConfig;
  onChange:  (updated: EmbeddingConfig) => void;
  onSave:    () => void;
  saving:    boolean;
}

export function EmbeddingConfigSection({ config, onChange, onSave, saving }: Props) {
  const set = (key: keyof EmbeddingConfig, value: unknown) =>
    onChange({ ...config, [key]: value });

  const setNested = <K extends 'openai_config' | 'ollama_config' | 'azure_openai_config'>(
    group: K,
    field: string,
    value: string,
  ) => onChange({ ...config, [group]: { ...config[group], [field]: value } });

  const engine = config.RAG_EMBEDDING_ENGINE;
  const isExternal = engine === 'openai' || engine === 'ollama' || engine === 'azure_openai';

  return (
    <SettingsSection
      title="Embedding"
      description="Embedding model used to convert documents and queries into vectors."
      onSave={onSave}
      saving={saving}
    >
      {/* Engine */}
      <SettingsField label="Embedding Model Engine">
        <select
          value={engine}
          onChange={(e) => {
            const val = e.target.value;
            let model = config.RAG_EMBEDDING_MODEL;
            if (val === 'openai' || val === 'azure_openai') model = 'text-embedding-3-small';
            else if (val === 'ollama') model = '';
            else model = 'sentence-transformers/all-MiniLM-L6-v2';
            onChange({ ...config, RAG_EMBEDDING_ENGINE: val, RAG_EMBEDDING_MODEL: model });
          }}
          className="admin-select h-9 w-full rounded-md px-3 text-sm"
        >
          <option value="">Default (SentenceTransformers)</option>
          <option value="ollama">Ollama</option>
          <option value="openai">OpenAI</option>
          <option value="azure_openai">Azure OpenAI</option>
        </select>
      </SettingsField>

      {/* OpenAI credentials */}
      {engine === 'openai' && (
        <>
          <SettingsField label="OpenAI API Base URL">
            <input type="url" value={config.openai_config.url} onChange={(e) => setNested('openai_config', 'url', e.target.value)} placeholder="https://api.openai.com/v1" className={FIELD} />
          </SettingsField>
          <SettingsField label="OpenAI API Key">
            <SensitiveInput value={config.openai_config.key} onChange={(v) => setNested('openai_config', 'key', v)} />
          </SettingsField>
        </>
      )}

      {/* Ollama credentials */}
      {engine === 'ollama' && (
        <>
          <SettingsField label="Ollama API Base URL">
            <input type="url" value={config.ollama_config.url} onChange={(e) => setNested('ollama_config', 'url', e.target.value)} placeholder="http://localhost:11434" className={FIELD} />
          </SettingsField>
          <SettingsField label="Ollama API Key">
            <SensitiveInput value={config.ollama_config.key} onChange={(v) => setNested('ollama_config', 'key', v)} />
          </SettingsField>
        </>
      )}

      {/* Azure OpenAI credentials */}
      {engine === 'azure_openai' && (
        <>
          <SettingsField label="Azure OpenAI API Base URL">
            <input type="url" value={config.azure_openai_config.url} onChange={(e) => setNested('azure_openai_config', 'url', e.target.value)} placeholder="https://your-resource.openai.azure.com" className={FIELD} />
          </SettingsField>
          <SettingsField label="Azure OpenAI API Key">
            <SensitiveInput value={config.azure_openai_config.key} onChange={(v) => setNested('azure_openai_config', 'key', v)} />
          </SettingsField>
          <SettingsField label="Azure API Version">
            <input type="text" value={config.azure_openai_config.version} onChange={(e) => setNested('azure_openai_config', 'version', e.target.value)} placeholder="2024-02-01" className={FIELD} />
          </SettingsField>
        </>
      )}

      {/* Embedding model */}
      <SettingsField
        label="Embedding Model"
        description="After changing the model, reindex the knowledge base for the new vectors to take effect."
      >
        <input
          type="text"
          value={config.RAG_EMBEDDING_MODEL}
          onChange={(e) => set('RAG_EMBEDDING_MODEL', e.target.value)}
          placeholder={engine === 'ollama' ? 'Set embedding model' : `e.g. ${config.RAG_EMBEDDING_MODEL.slice(-40) || 'text-embedding-3-small'}`}
          className={FIELD}
        />
      </SettingsField>

      {/* Batch size */}
      <SettingsField label="Embedding Batch Size">
        <input
          type="number"
          min={-2}
          max={16000}
          step={1}
          value={config.RAG_EMBEDDING_BATCH_SIZE}
          onChange={(e) => set('RAG_EMBEDDING_BATCH_SIZE', parseInt(e.target.value))}
          className={FIELD}
        />
      </SettingsField>

      {/* Async + concurrent — only for external engines */}
      {isExternal && (
        <>
          <SettingsToggleRow
            label="Async Embedding Processing"
            description="Run embedding tasks concurrently. Turn off if rate limits become an issue."
            checked={config.ENABLE_ASYNC_EMBEDDING}
            onChange={(v) => set('ENABLE_ASYNC_EMBEDDING', v)}
          />
          <SettingsField label="Embedding Concurrent Requests" description="Max concurrent embedding requests. Set 0 for unlimited.">
            <input
              type="number"
              min={0}
              step={1}
              value={config.RAG_EMBEDDING_CONCURRENT_REQUESTS}
              onChange={(e) => set('RAG_EMBEDDING_CONCURRENT_REQUESTS', parseInt(e.target.value))}
              className={FIELD}
            />
          </SettingsField>
        </>
      )}
    </SettingsSection>
  );
}

export default EmbeddingConfigSection;
