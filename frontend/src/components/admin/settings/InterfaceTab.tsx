'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { getToken } from '@/lib/auth/session';
import { Switch } from '@/components/ui/Switch';
import { SettingsSection, SettingsField } from '@/components/shared/SettingsSection';
import { getTaskConfig, updateTaskConfig } from '@/lib/api/admin/settings';

const FIELD   = 'admin-input h-9 w-full rounded-md px-3 text-sm';
const TEXTAREA = 'admin-input w-full resize-none rounded-md px-3 py-2 text-sm font-mono';

export function InterfaceTab() {
  const [loading, setLoading] = useState(true);
  const [saving,  setSaving]  = useState(false);
  const [config,  setConfig]  = useState<Record<string, unknown>>({});

  useEffect(() => {
    const token = getToken();
    if (!token) return;
    getTaskConfig(token)
      .then((c) => setConfig((c as Record<string, unknown>) ?? {}))
      .catch(() => toast.error('Failed to load interface config'))
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    const token = getToken();
    if (!token) return;
    setSaving(true);
    try {
      await updateTaskConfig(token, config);
      toast.success('Interface settings saved');
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
      {/* Task model */}
      <SettingsSection title="Task Model" description="Model used for background tasks (title generation, etc.)." onSave={handleSave} saving={saving}>
        <SettingsField label="Task Model (Local)">
          <input type="text" value={String(config.TASK_MODEL ?? '')} onChange={(e) => set('TASK_MODEL', e.target.value)} placeholder="Leave blank to use chat model" className={FIELD} />
        </SettingsField>
        <SettingsField label="Task Model (External)">
          <input type="text" value={String(config.TASK_MODEL_EXTERNAL ?? '')} onChange={(e) => set('TASK_MODEL_EXTERNAL', e.target.value)} placeholder="Leave blank to use chat model" className={FIELD} />
        </SettingsField>
      </SettingsSection>

      {/* Title generation */}
      <SettingsSection title="Title Generation" onSave={handleSave} saving={saving}>
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium" style={{ color: 'var(--bodhion-text-primary)' }}>Enable Title Generation</span>
          <Switch checked={!!config.ENABLE_TITLE_GENERATION} onCheckedChange={(v) => set('ENABLE_TITLE_GENERATION', v)} />
        </div>
        <SettingsField label="Title Generation Prompt">
          <textarea rows={4} value={String(config.TITLE_GENERATION_PROMPT_TEMPLATE ?? '')} onChange={(e) => set('TITLE_GENERATION_PROMPT_TEMPLATE', e.target.value)} className={TEXTAREA} />
        </SettingsField>
      </SettingsSection>

      {/* Follow-up generation */}
      <SettingsSection title="Follow-up Suggestions" onSave={handleSave} saving={saving}>
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium" style={{ color: 'var(--bodhion-text-primary)' }}>Enable Follow-up Generation</span>
          <Switch checked={!!config.ENABLE_FOLLOW_UP_GENERATION} onCheckedChange={(v) => set('ENABLE_FOLLOW_UP_GENERATION', v)} />
        </div>
        <SettingsField label="Follow-up Generation Prompt">
          <textarea rows={4} value={String(config.FOLLOW_UP_GENERATION_PROMPT_TEMPLATE ?? '')} onChange={(e) => set('FOLLOW_UP_GENERATION_PROMPT_TEMPLATE', e.target.value)} className={TEXTAREA} />
        </SettingsField>
      </SettingsSection>

      {/* Autocomplete */}
      <SettingsSection title="Autocomplete" onSave={handleSave} saving={saving}>
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium" style={{ color: 'var(--bodhion-text-primary)' }}>Enable Autocomplete Generation</span>
          <Switch checked={!!config.ENABLE_AUTOCOMPLETE_GENERATION} onCheckedChange={(v) => set('ENABLE_AUTOCOMPLETE_GENERATION', v)} />
        </div>
        <SettingsField label="Max Input Length" description="-1 for unlimited">
          <input type="number" value={Number(config.AUTOCOMPLETE_GENERATION_INPUT_MAX_LENGTH ?? -1)} onChange={(e) => set('AUTOCOMPLETE_GENERATION_INPUT_MAX_LENGTH', parseInt(e.target.value))} className={FIELD} />
        </SettingsField>
      </SettingsSection>

      {/* Tags generation */}
      <SettingsSection title="Tags & Search" onSave={handleSave} saving={saving}>
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium" style={{ color: 'var(--bodhion-text-primary)' }}>Enable Tags Generation</span>
          <Switch checked={!!config.ENABLE_TAGS_GENERATION} onCheckedChange={(v) => set('ENABLE_TAGS_GENERATION', v)} />
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium" style={{ color: 'var(--bodhion-text-primary)' }}>Enable Search Query Generation</span>
          <Switch checked={!!config.ENABLE_SEARCH_QUERY_GENERATION} onCheckedChange={(v) => set('ENABLE_SEARCH_QUERY_GENERATION', v)} />
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium" style={{ color: 'var(--bodhion-text-primary)' }}>Enable Retrieval Query Generation</span>
          <Switch checked={!!config.ENABLE_RETRIEVAL_QUERY_GENERATION} onCheckedChange={(v) => set('ENABLE_RETRIEVAL_QUERY_GENERATION', v)} />
        </div>
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

export default InterfaceTab;
