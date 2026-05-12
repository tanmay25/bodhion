'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Plus, Trash2 } from 'lucide-react';
import { getToken } from '@/lib/auth/session';
import { SensitiveInput } from '@/components/shared/SensitiveInput';
import { SettingsSection, SettingsField } from '@/components/shared/SettingsSection';
import { Switch } from '@/components/ui/Switch';
import {
  getOllamaConfig,
  updateOllamaConfig,
  getOpenAIConfig,
  updateOpenAIConfig,
  getConnectionsConfig,
  setConnectionsConfig,
} from '@/lib/api/admin/settings';

const FIELD = 'admin-input h-9 w-full rounded-md px-3 text-sm';
const TABS = ['openai', 'ollama', 'connections'] as const;
type Tab = typeof TABS[number];

export function ConnectionsTab() {
  const [activeTab, setActiveTab] = useState<Tab>('openai');
  const [loading,   setLoading]   = useState(true);
  const [saving,    setSaving]    = useState(false);

  const [ollamaConfig, setOllamaConfig] = useState<Record<string, unknown>>({});
  const [openaiConfig, setOpenaiConfig] = useState<Record<string, unknown>>({});
  const [connConfig,   setConnConfig]   = useState({ ENABLE_DIRECT_CONNECTIONS: false, ENABLE_BASE_MODELS_CACHE: false });

  useEffect(() => {
    const token = getToken();
    if (!token) return;
    Promise.all([
      getOllamaConfig(token).catch(() => ({})),
      getOpenAIConfig(token).catch(() => ({})),
      getConnectionsConfig(token).catch(() => ({ ENABLE_DIRECT_CONNECTIONS: false, ENABLE_BASE_MODELS_CACHE: false })),
    ]).then(([olla, oai, conn]) => {
      setOllamaConfig((olla as Record<string, unknown>) ?? {});
      setOpenaiConfig((oai  as Record<string, unknown>) ?? {});
      setConnConfig((conn as typeof connConfig) ?? { ENABLE_DIRECT_CONNECTIONS: false, ENABLE_BASE_MODELS_CACHE: false });
    }).finally(() => setLoading(false));
  }, []);

  const saveOllama = async () => {
    const token = getToken();
    if (!token) return;
    setSaving(true);
    try {
      await updateOllamaConfig(token, {
        ENABLE_OLLAMA_API: !!ollamaConfig.ENABLE_OLLAMA_API,
        OLLAMA_BASE_URLS: Array.isArray(ollamaConfig.OLLAMA_BASE_URLS)
          ? (ollamaConfig.OLLAMA_BASE_URLS as string[])
          : ollamaUrls,
        OLLAMA_API_CONFIGS: (ollamaConfig.OLLAMA_API_CONFIGS as Record<string, unknown>) ?? {},
      });
      toast.success('Ollama config saved');
    } catch { toast.error('Failed to save'); }
    finally  { setSaving(false); }
  };

  const saveOpenAI = async () => {
    const token = getToken();
    if (!token) return;
    setSaving(true);
    try {
      await updateOpenAIConfig(token, {
        ENABLE_OPENAI_API: !!openaiConfig.ENABLE_OPENAI_API,
        OPENAI_API_BASE_URLS: Array.isArray(openaiConfig.OPENAI_API_BASE_URLS)
          ? (openaiConfig.OPENAI_API_BASE_URLS as string[])
          : openaiUrls,
        OPENAI_API_KEYS: Array.isArray(openaiConfig.OPENAI_API_KEYS)
          ? (openaiConfig.OPENAI_API_KEYS as string[])
          : openaiKeys,
        OPENAI_API_CONFIGS: (openaiConfig.OPENAI_API_CONFIGS as Record<string, unknown>) ?? {},
      });
      toast.success('OpenAI config saved');
    } catch { toast.error('Failed to save'); }
    finally  { setSaving(false); }
  };

  const saveConnections = async () => {
    const token = getToken();
    if (!token) return;
    setSaving(true);
    try {
      await setConnectionsConfig(token, connConfig);
      toast.success('Platform config saved');
    } catch { toast.error('Failed to save'); }
    finally  { setSaving(false); }
  };

  // Helpers for arrays stored in config
  const ollamaUrls: string[] = Array.isArray(ollamaConfig.OLLAMA_BASE_URLS)
    ? (ollamaConfig.OLLAMA_BASE_URLS as string[])
    : (ollamaConfig.OLLAMA_BASE_URL ? [String(ollamaConfig.OLLAMA_BASE_URL)] : ['']);

  const openaiUrls: string[] = Array.isArray(openaiConfig.OPENAI_API_BASE_URLS)
    ? (openaiConfig.OPENAI_API_BASE_URLS as string[])
    : [''];
  const openaiKeys: string[] = Array.isArray(openaiConfig.OPENAI_API_KEYS)
    ? (openaiConfig.OPENAI_API_KEYS as string[])
    : [''];

  if (loading) return <SkeletonCard />;

  return (
    <div className="flex flex-col gap-5">
      {/* Sub-tab nav */}
      <div className="flex gap-0 border-b" style={{ borderColor: 'var(--bodhion-card-border)' }}>
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setActiveTab(t)}
            className="px-4 py-2 text-sm font-medium capitalize transition-colors"
            style={
              activeTab === t
                ? { color: 'rgba(37,215,255,0.9)', borderBottom: '2px solid rgba(37,215,255,0.9)', marginBottom: '-1px' }
                : { color: 'var(--bodhion-text-secondary)' }
            }
          >
            {t === 'openai' ? 'OpenAI-Compatible' : t === 'ollama' ? 'Ollama' : 'Platform'}
          </button>
        ))}
      </div>

      {/* OpenAI-Compatible */}
      {activeTab === 'openai' && (
        <SettingsSection
          title="OpenAI-Compatible API"
          description="Supports OpenAI, Claude (via proxy), Gemini, and any OpenAI-compatible endpoint."
          onSave={saveOpenAI}
          saving={saving}
        >
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium" style={{ color: 'var(--bodhion-text-primary)' }}>Enable OpenAI API</span>
            <Switch
              checked={!!openaiConfig.ENABLE_OPENAI_API}
              onCheckedChange={(v) => setOpenaiConfig((p) => ({ ...p, ENABLE_OPENAI_API: v }))}
            />
          </div>

          <SettingsField label="API Base URLs">
            <div className="flex flex-col gap-2">
              {openaiUrls.map((url, i) => (
                <div key={i} className="flex gap-2">
                  <input
                    type="url"
                    value={url}
                    onChange={(e) => {
                      const next = [...openaiUrls];
                      next[i] = e.target.value;
                      setOpenaiConfig((p) => ({ ...p, OPENAI_API_BASE_URLS: next }));
                    }}
                    placeholder="https://api.openai.com/v1"
                    className={`${FIELD} flex-1`}
                  />
                  {openaiUrls.length > 1 && (
                    <button
                      onClick={() => {
                        const next = openaiUrls.filter((_, j) => j !== i);
                        setOpenaiConfig((p) => ({ ...p, OPENAI_API_BASE_URLS: next }));
                      }}
                      className="rounded-lg p-2 transition-colors hover:bg-[rgba(248,113,113,0.1)]"
                      style={{ color: 'rgba(248,113,113,0.8)' }}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              ))}
              <button
                onClick={() => setOpenaiConfig((p) => ({ ...p, OPENAI_API_BASE_URLS: [...openaiUrls, ''] }))}
                className="flex items-center gap-1.5 text-xs font-medium self-start"
                style={{ color: 'rgba(37,215,255,0.9)' }}
              >
                <Plus className="h-3 w-3" /> Add URL
              </button>
            </div>
          </SettingsField>

          <SettingsField label="API Keys">
            <div className="flex flex-col gap-2">
              {openaiKeys.map((key, i) => (
                <div key={i} className="flex gap-2">
                  <div className="flex-1">
                    <SensitiveInput
                      value={key}
                      onChange={(v) => {
                        const next = [...openaiKeys];
                        next[i] = v;
                        setOpenaiConfig((p) => ({ ...p, OPENAI_API_KEYS: next }));
                      }}
                      placeholder="sk-…"
                    />
                  </div>
                  {openaiKeys.length > 1 && (
                    <button
                      onClick={() => {
                        const next = openaiKeys.filter((_, j) => j !== i);
                        setOpenaiConfig((p) => ({ ...p, OPENAI_API_KEYS: next }));
                      }}
                      className="rounded-lg p-2 transition-colors hover:bg-[rgba(248,113,113,0.1)]"
                      style={{ color: 'rgba(248,113,113,0.8)' }}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              ))}
              <button
                onClick={() => setOpenaiConfig((p) => ({ ...p, OPENAI_API_KEYS: [...openaiKeys, ''] }))}
                className="flex items-center gap-1.5 text-xs font-medium self-start"
                style={{ color: 'rgba(37,215,255,0.9)' }}
              >
                <Plus className="h-3 w-3" /> Add Key
              </button>
            </div>
          </SettingsField>
        </SettingsSection>
      )}

      {/* Ollama */}
      {activeTab === 'ollama' && (
        <SettingsSection title="Ollama" onSave={saveOllama} saving={saving}>
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium" style={{ color: 'var(--bodhion-text-primary)' }}>Enable Ollama API</span>
            <Switch
              checked={!!ollamaConfig.ENABLE_OLLAMA_API}
              onCheckedChange={(v) => setOllamaConfig((p) => ({ ...p, ENABLE_OLLAMA_API: v }))}
            />
          </div>

          <SettingsField label="Ollama Base URLs">
            <div className="flex flex-col gap-2">
              {ollamaUrls.map((url, i) => (
                <div key={i} className="flex gap-2">
                  <input
                    type="url"
                    value={url}
                    onChange={(e) => {
                      const next = [...ollamaUrls];
                      next[i] = e.target.value;
                      setOllamaConfig((p) => ({ ...p, OLLAMA_BASE_URLS: next }));
                    }}
                    placeholder="http://localhost:11434"
                    className={`${FIELD} flex-1`}
                  />
                  {ollamaUrls.length > 1 && (
                    <button
                      onClick={() => {
                        const next = ollamaUrls.filter((_, j) => j !== i);
                        setOllamaConfig((p) => ({ ...p, OLLAMA_BASE_URLS: next }));
                      }}
                      className="rounded-lg p-2 transition-colors hover:bg-[rgba(248,113,113,0.1)]"
                      style={{ color: 'rgba(248,113,113,0.8)' }}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              ))}
              <button
                onClick={() => setOllamaConfig((p) => ({ ...p, OLLAMA_BASE_URLS: [...ollamaUrls, ''] }))}
                className="flex items-center gap-1.5 text-xs font-medium self-start"
                style={{ color: 'rgba(37,215,255,0.9)' }}
              >
                <Plus className="h-3 w-3" /> Add URL
              </button>
            </div>
          </SettingsField>
        </SettingsSection>
      )}

      {/* Platform controls */}
      {activeTab === 'connections' && (
        <SettingsSection title="Platform Controls" description="Global overrides for all connection types." onSave={saveConnections} saving={saving}>
          <div className="flex items-center justify-between">
            <div className="flex flex-col">
              <span className="text-sm font-medium" style={{ color: 'var(--bodhion-text-primary)' }}>Enable Direct Connections</span>
              <span className="text-xs" style={{ color: 'var(--bodhion-text-secondary)' }}>Allow users to connect their own API keys</span>
            </div>
            <Switch
              checked={connConfig.ENABLE_DIRECT_CONNECTIONS}
              onCheckedChange={(v) => setConnConfig((p) => ({ ...p, ENABLE_DIRECT_CONNECTIONS: v }))}
            />
          </div>
          <div className="flex items-center justify-between">
            <div className="flex flex-col">
              <span className="text-sm font-medium" style={{ color: 'var(--bodhion-text-primary)' }}>Enable Base Models Cache</span>
              <span className="text-xs" style={{ color: 'var(--bodhion-text-secondary)' }}>Cache the base model list to reduce API calls</span>
            </div>
            <Switch
              checked={connConfig.ENABLE_BASE_MODELS_CACHE}
              onCheckedChange={(v) => setConnConfig((p) => ({ ...p, ENABLE_BASE_MODELS_CACHE: v }))}
            />
          </div>
        </SettingsSection>
      )}
    </div>
  );
}

function SkeletonCard() {
  return (
    <div className="rounded-xl p-5" style={{ background: 'var(--bodhion-card-bg)', border: '1px solid var(--bodhion-card-border)' }}>
      <div className="flex flex-col gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-9 w-full animate-pulse rounded" style={{ background: 'var(--bodhion-search-bg)' }} />
        ))}
      </div>
    </div>
  );
}

export default ConnectionsTab;
