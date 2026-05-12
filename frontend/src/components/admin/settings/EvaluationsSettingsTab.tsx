'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Plus, Trash2 } from 'lucide-react';
import { getToken } from '@/lib/auth/session';
import { Switch } from '@/components/ui/Switch';
import { SettingsSection } from '@/components/shared/SettingsSection';
import { getEvaluationConfig, updateEvaluationConfig } from '@/lib/api/admin/settings';

interface ArenaModel {
  id:    string;
  name?: string;
}

const FIELD = 'admin-input h-9 w-full rounded-md px-3 text-sm';

export function EvaluationsSettingsTab() {
  const [loading, setLoading] = useState(true);
  const [saving,  setSaving]  = useState(false);
  const [config,  setConfig]  = useState<Record<string, unknown>>({});

  useEffect(() => {
    const token = getToken();
    if (!token) return;
    getEvaluationConfig(token)
      .then((c) => setConfig((c as Record<string, unknown>) ?? {}))
      .catch(() => toast.error('Failed to load evaluation config'))
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    const token = getToken();
    if (!token) return;
    setSaving(true);
    try {
      await updateEvaluationConfig(token, config);
      toast.success('Evaluation settings saved');
    } catch {
      toast.error('Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const set = (key: string, value: unknown) =>
    setConfig((prev) => ({ ...prev, [key]: value }));

  const arenaModels: ArenaModel[] = Array.isArray(config.EVALUATION_ARENA_MODELS)
    ? (config.EVALUATION_ARENA_MODELS as ArenaModel[])
    : [];

  const addArenaModel = () =>
    set('EVALUATION_ARENA_MODELS', [...arenaModels, { id: '', name: '' }]);

  const updateArenaModel = (idx: number, field: 'id' | 'name', val: string) => {
    const next = arenaModels.map((m, i) => i === idx ? { ...m, [field]: val } : m);
    set('EVALUATION_ARENA_MODELS', next);
  };

  const removeArenaModel = (idx: number) =>
    set('EVALUATION_ARENA_MODELS', arenaModels.filter((_, i) => i !== idx));

  if (loading) return <SkeletonCard />;

  return (
    <div className="flex flex-col gap-5">
      {/* Evaluation toggles */}
      <SettingsSection title="Evaluation Settings" onSave={handleSave} saving={saving}>
        <div className="flex items-center justify-between">
          <div className="flex flex-col">
            <span className="text-sm font-medium" style={{ color: 'var(--bodhion-text-primary)' }}>Enable Evaluation Arena</span>
            <span className="text-xs" style={{ color: 'var(--bodhion-text-secondary)' }}>Allow side-by-side model comparisons with user voting</span>
          </div>
          <Switch
            checked={!!config.ENABLE_EVALUATION_ARENA_MODELS}
            onCheckedChange={(v) => set('ENABLE_EVALUATION_ARENA_MODELS', v)}
          />
        </div>

        <div className="flex items-center justify-between">
          <div className="flex flex-col">
            <span className="text-sm font-medium" style={{ color: 'var(--bodhion-text-primary)' }}>Enable Message Rating</span>
            <span className="text-xs" style={{ color: 'var(--bodhion-text-secondary)' }}>Allow thumbs up/down on individual messages</span>
          </div>
          <Switch
            checked={!!config.ENABLE_MESSAGE_RATING}
            onCheckedChange={(v) => set('ENABLE_MESSAGE_RATING', v)}
          />
        </div>
      </SettingsSection>

      {/* Arena models */}
      <SettingsSection
        title="Arena Models"
        description="Models included in the evaluation arena. Leave empty to include all models."
        onSave={handleSave}
        saving={saving}
        action={
          <button
            onClick={addArenaModel}
            className="flex items-center gap-1.5 text-xs font-medium"
            style={{ color: 'rgba(37,215,255,0.9)' }}
          >
            <Plus className="h-3.5 w-3.5" /> Add Model
          </button>
        }
      >
        {arenaModels.length === 0 ? (
          <p className="text-sm" style={{ color: 'var(--bodhion-text-secondary)' }}>
            No arena models configured — all models will be used.
          </p>
        ) : (
          <div className="flex flex-col gap-3">
            {arenaModels.map((model, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <input
                  type="text"
                  value={model.id}
                  onChange={(e) => updateArenaModel(idx, 'id', e.target.value)}
                  placeholder="Model ID"
                  className={`${FIELD} flex-1`}
                />
                <input
                  type="text"
                  value={model.name ?? ''}
                  onChange={(e) => updateArenaModel(idx, 'name', e.target.value)}
                  placeholder="Display name (optional)"
                  className={`${FIELD} flex-1`}
                />
                <button
                  onClick={() => removeArenaModel(idx)}
                  className="rounded-lg p-2 transition-colors hover:bg-[rgba(248,113,113,0.1)]"
                  style={{ color: 'rgba(248,113,113,0.8)' }}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
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

export default EvaluationsSettingsTab;
