'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { getToken } from '@/lib/auth/session';
import { Switch } from '@/components/ui/Switch';
import { SensitiveInput } from '@/components/shared/SensitiveInput';
import { SettingsSection, SettingsField } from '@/components/shared/SettingsSection';
import { getRAGConfig, updateRAGConfig } from '@/lib/api/admin/settings';

const FIELD  = 'admin-input h-9 w-full rounded-md px-3 text-sm';
const SELECT = 'admin-select h-9 w-full rounded-md px-3 text-sm';

const SEARCH_ENGINES = [
  'searxng', 'google_pse', 'brave', 'duckduckgo', 'tavily',
  'bing', 'perplexity', 'serper', 'serpapi', 'jina', 'exa',
  'kagi', 'mojeek', 'yacy', 'youcom', 'external',
];

export function WebSearchTab() {
  const [loading, setLoading] = useState(true);
  const [saving,  setSaving]  = useState(false);
  const [config,  setConfig]  = useState<Record<string, unknown>>({});

  useEffect(() => {
    const token = getToken();
    if (!token) return;
    getRAGConfig(token)
      .then((c) => setConfig((c as Record<string, unknown>) ?? {}))
      .catch(() => toast.error('Failed to load web search config'))
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    const token = getToken();
    if (!token) return;
    setSaving(true);

    // Normalise domain filter
    const cfg = { ...config };
    if (typeof cfg.WEB_SEARCH_DOMAIN_FILTER_LIST === 'string') {
      cfg.WEB_SEARCH_DOMAIN_FILTER_LIST = (cfg.WEB_SEARCH_DOMAIN_FILTER_LIST as string)
        .split(',').map((d) => d.trim()).filter(Boolean);
    }

    try {
      await updateRAGConfig(token, cfg);
      toast.success('Web search settings saved');
    } catch {
      toast.error('Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const set = (key: string, value: unknown) =>
    setConfig((prev) => ({ ...prev, [key]: value }));

  const engine = String(config.WEB_SEARCH_ENGINE ?? '');
  const domainFilter = Array.isArray(config.WEB_SEARCH_DOMAIN_FILTER_LIST)
    ? (config.WEB_SEARCH_DOMAIN_FILTER_LIST as string[]).join(', ')
    : String(config.WEB_SEARCH_DOMAIN_FILTER_LIST ?? '');

  if (loading) return <SkeletonCard />;

  return (
    <div className="flex flex-col gap-5">
      <SettingsSection title="Web Search" onSave={handleSave} saving={saving}>
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium" style={{ color: 'var(--bodhion-text-primary)' }}>Enable Web Search</span>
          <Switch checked={!!config.ENABLE_RAG_WEB_SEARCH} onCheckedChange={(v) => set('ENABLE_RAG_WEB_SEARCH', v)} />
        </div>

        <SettingsField label="Search Engine">
          <select value={engine} onChange={(e) => set('WEB_SEARCH_ENGINE', e.target.value)} className={SELECT}>
            <option value="">None</option>
            {SEARCH_ENGINES.map((e) => (
              <option key={e} value={e}>{e}</option>
            ))}
          </select>
        </SettingsField>

        {/* Engine-specific key fields */}
        {['brave', 'google_pse', 'searxng', 'tavily', 'bing', 'perplexity', 'serper', 'serpapi', 'jina', 'exa', 'kagi'].includes(engine) && (
          <SettingsField label={`${engine} API Key`}>
            <SensitiveInput
              value={String(config[`${engine.toUpperCase()}_SEARCH_API_KEY`] ?? config.WEB_SEARCH_API_KEY ?? '')}
              onChange={(v) => set(`${engine.toUpperCase()}_SEARCH_API_KEY`, v)}
            />
          </SettingsField>
        )}

        {engine === 'searxng' && (
          <SettingsField label="SearXNG URL">
            <input type="url" value={String(config.SEARXNG_QUERY_URL ?? '')} onChange={(e) => set('SEARXNG_QUERY_URL', e.target.value)} placeholder="http://localhost:8080" className={FIELD} />
          </SettingsField>
        )}

        {engine === 'google_pse' && (
          <SettingsField label="Google PSE Engine ID">
            <input type="text" value={String(config.GOOGLE_PSE_ENGINE_ID ?? '')} onChange={(e) => set('GOOGLE_PSE_ENGINE_ID', e.target.value)} className={FIELD} />
          </SettingsField>
        )}

        <SettingsField label="Results to Return">
          <input type="number" min={1} max={20} value={Number(config.WEB_SEARCH_RESULT_COUNT ?? 3)} onChange={(e) => set('WEB_SEARCH_RESULT_COUNT', parseInt(e.target.value))} className={FIELD} />
        </SettingsField>

        <SettingsField label="Domain Filter" description="Comma-separated list of allowed domains (blank = all)">
          <input type="text" value={domainFilter} onChange={(e) => set('WEB_SEARCH_DOMAIN_FILTER_LIST', e.target.value)} placeholder="example.com, wikipedia.org" className={FIELD} />
        </SettingsField>
      </SettingsSection>

      <SettingsSection title="Web Loader" description="How pages are fetched for RAG." onSave={handleSave} saving={saving}>
        <SettingsField label="Web Loader Engine">
          <select value={String(config.WEB_LOADER_ENGINE ?? '')} onChange={(e) => set('WEB_LOADER_ENGINE', e.target.value)} className={SELECT}>
            <option value="">Default (requests)</option>
            <option value="playwright">Playwright</option>
            <option value="firecrawl">Firecrawl</option>
            <option value="tavily">Tavily Extract</option>
          </select>
        </SettingsField>
      </SettingsSection>
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

export default WebSearchTab;
