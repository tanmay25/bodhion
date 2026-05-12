'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { getToken } from '@/lib/auth/session';
import { Switch } from '@/components/ui/Switch';
import { SettingsSection, SettingsField } from '@/components/shared/SettingsSection';
import { getCodeExecutionConfig, updateCodeExecutionConfig } from '@/lib/api/admin/settings';

const FIELD = 'admin-input h-9 w-full rounded-md px-3 text-sm';

export function CodeExecutionTab() {
  const [loading, setLoading] = useState(true);
  const [saving,  setSaving]  = useState(false);
  const [config,  setConfig]  = useState<Record<string, unknown>>({});

  useEffect(() => {
    const token = getToken();
    if (!token) return;
    getCodeExecutionConfig(token)
      .then((c) => setConfig((c as Record<string, unknown>) ?? {}))
      .catch(() => toast.error('Failed to load code execution config'))
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    const token = getToken();
    if (!token) return;
    setSaving(true);
    try {
      await updateCodeExecutionConfig(token, config);
      toast.success('Code execution settings saved');
    } catch {
      toast.error('Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const set = (key: string, value: unknown) =>
    setConfig((prev) => ({ ...prev, [key]: value }));

  if (loading) return <SkeletonCard />;

  return (
    <div className="flex flex-col gap-5">
      <SettingsSection title="Code Execution" onSave={handleSave} saving={saving}>
        <div className="flex items-center justify-between">
          <div className="flex flex-col">
            <span className="text-sm font-medium" style={{ color: 'var(--bodhion-text-primary)' }}>Enable Code Execution</span>
            <span className="text-xs" style={{ color: 'var(--bodhion-text-secondary)' }}>Allow AI to execute code blocks in a sandbox</span>
          </div>
          <Switch checked={!!config.ENABLE_CODE_EXECUTION} onCheckedChange={(v) => set('ENABLE_CODE_EXECUTION', v)} />
        </div>

        <div className="flex items-center justify-between">
          <div className="flex flex-col">
            <span className="text-sm font-medium" style={{ color: 'var(--bodhion-text-primary)' }}>Enable Code Interpreter</span>
            <span className="text-xs" style={{ color: 'var(--bodhion-text-secondary)' }}>Allow AI to interpret and run Python code</span>
          </div>
          <Switch checked={!!config.ENABLE_CODE_INTERPRETER} onCheckedChange={(v) => set('ENABLE_CODE_INTERPRETER', v)} />
        </div>

        <SettingsField label="Code Execution Engine">
          <select
            value={String(config.CODE_EXECUTION_ENGINE ?? 'pyodide')}
            onChange={(e) => set('CODE_EXECUTION_ENGINE', e.target.value)}
            className="admin-select h-9 w-full rounded-md px-3 text-sm"
          >
            <option value="pyodide">Pyodide (browser)</option>
            <option value="jupyter">Jupyter</option>
            <option value="e2b">E2B</option>
          </select>
        </SettingsField>

        {config.CODE_EXECUTION_ENGINE === 'jupyter' && (
          <>
            <SettingsField label="Jupyter URL">
              <input type="url" value={String(config.CODE_EXECUTION_JUPYTER_URL ?? '')} onChange={(e) => set('CODE_EXECUTION_JUPYTER_URL', e.target.value)} placeholder="http://localhost:8888" className={FIELD} />
            </SettingsField>
            <SettingsField label="Jupyter Auth">
              <select value={String(config.CODE_EXECUTION_JUPYTER_AUTH ?? 'none')} onChange={(e) => set('CODE_EXECUTION_JUPYTER_AUTH', e.target.value)} className="admin-select h-9 w-full rounded-md px-3 text-sm">
                <option value="none">None</option>
                <option value="token">Token</option>
                <option value="password">Password</option>
              </select>
            </SettingsField>
            <SettingsField label="Jupyter Token">
              <input type="password" value={String(config.CODE_EXECUTION_JUPYTER_AUTH_TOKEN ?? '')} onChange={(e) => set('CODE_EXECUTION_JUPYTER_AUTH_TOKEN', e.target.value)} className={FIELD} />
            </SettingsField>
          </>
        )}

        {config.CODE_EXECUTION_ENGINE === 'e2b' && (
          <SettingsField label="E2B API Key">
            <input type="password" value={String(config.CODE_EXECUTION_E2B_API_KEY ?? '')} onChange={(e) => set('CODE_EXECUTION_E2B_API_KEY', e.target.value)} className={FIELD} />
          </SettingsField>
        )}
      </SettingsSection>
    </div>
  );
}

function SkeletonCard() {
  return (
    <div className="rounded-xl p-5" style={{ background: 'var(--bodhion-card-bg)', border: '1px solid var(--bodhion-card-border)' }}>
      <div className="flex flex-col gap-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-9 w-full animate-pulse rounded" style={{ background: 'var(--bodhion-search-bg)' }} />
        ))}
      </div>
    </div>
  );
}

export default CodeExecutionTab;
