'use client';

// Admin Tools → Model Settings
// Mirrors src/lib/components/admin/Settings/Models/ModelSettingsModal.svelte
// Features: default models, pinned models, model order, prompt suggestions, save.

import { useEffect, useMemo, useState } from 'react';
import { ChevronDown, ChevronUp, GripVertical, Minus, Plus, X } from 'lucide-react';
import { toast } from 'sonner';
import { getToken } from '@/lib/auth/session';
import { Button } from '@/components/ui/Button';
import { apiFetch, API_BASE_URL } from '@/lib/api/client';
import {
  getModelsConfig, setModelsConfig, setDefaultPromptSuggestions,
  type ModelsConfig,
} from '@/lib/api/admin/settings';

// ── Types ─────────────────────────────────────────────────────────────────────
interface ModelOption { id: string; name: string; }
interface SuggestionPrompt { content: string; title: [string, string]; }

// ── Helpers ───────────────────────────────────────────────────────────────────
function move<T>(arr: T[], from: number, to: number): T[] {
  const next = [...arr];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

// ── Multi-model picker ────────────────────────────────────────────────────────
function ModelPicker({
  label, tooltip, modelIds, allModels, onChange,
}: {
  label: string;
  tooltip: string;
  modelIds: string[];
  allModels: ModelOption[];
  onChange: (ids: string[]) => void;
}) {
  const [addId, setAddId] = useState('');
  const available = allModels.filter((m) => !modelIds.includes(m.id));

  const add = () => {
    if (!addId || modelIds.includes(addId)) return;
    onChange([...modelIds, addId]);
    setAddId('');
  };

  return (
    <div className="msp-picker">
      <div className="msp-picker-label">{label}</div>
      <div className="msp-picker-hint">{tooltip}</div>

      {modelIds.length > 0 && (
        <div className="msp-picker-chips">
          {modelIds.map((id) => {
            const m = allModels.find((m) => m.id === id);
            return (
              <div key={id} className="msp-chip">
                <span className="msp-chip-name">{m?.name ?? id}</span>
                <button type="button" className="msp-chip-remove" onClick={() => onChange(modelIds.filter((x) => x !== id))}>
                  <X className="h-3 w-3" />
                </button>
              </div>
            );
          })}
        </div>
      )}

      <div className="msp-picker-add-row">
        <select
          className="admin-models-view-select msp-select"
          value={addId}
          onChange={(e) => setAddId(e.target.value)}
        >
          <option value="">Select a model…</option>
          {available.map((m) => (
            <option key={m.id} value={m.id}>{m.name}</option>
          ))}
        </select>
        <button type="button" className="msp-add-btn" onClick={add} disabled={!addId}>
          <Plus className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export function ModelSettingsPanel({ onSaved }: { onSaved?: () => void }) {
  const [allModels, setAllModels] = useState<ModelOption[]>([]);
  const [config, setConfig] = useState<ModelsConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Form state
  const [defaultModelIds, setDefaultModelIds] = useState<string[]>([]);
  const [pinnedModelIds, setPinnedModelIds] = useState<string[]>([]);
  const [modelOrder, setModelOrder] = useState<string[]>([]);
  const [prompts, setPrompts] = useState<SuggestionPrompt[]>([]);
  const [showPrompts, setShowPrompts] = useState(false);
  const [showOrder, setShowOrder] = useState(false);
  const [draggingIdx, setDraggingIdx] = useState<number | null>(null);

  // ── Load ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    const load = async () => {
      const token = getToken();
      if (!token) return;
      setLoading(true);
      try {
        const [cfg, modelsRes] = await Promise.all([
          getModelsConfig(token),
          apiFetch<{ data: Array<{ id: string; name?: string }> }>(`${API_BASE_URL}/api/models`, { token }),
        ]);

        setConfig(cfg);
        const modelList: ModelOption[] = (modelsRes?.data ?? [])
          .map((m) => ({ id: m.id, name: m.name ?? m.id }))
          .sort((a, b) => a.name.localeCompare(b.name));
        setAllModels(modelList);

        setDefaultModelIds(cfg?.DEFAULT_MODELS ? cfg.DEFAULT_MODELS.split(',').filter(Boolean) : []);
        setPinnedModelIds(cfg?.DEFAULT_PINNED_MODELS ? cfg.DEFAULT_PINNED_MODELS.split(',').filter(Boolean) : []);

        // Build ordered list: configured order first, then alpha for the rest
        const orderList = cfg?.MODEL_ORDER_LIST ?? [];
        const allIds = modelList.map((m) => m.id);
        const orderedSet = new Set(orderList);
        setModelOrder([
          ...orderList.filter((id) => allIds.includes(id)),
          ...allIds.filter((id) => !orderedSet.has(id)).sort((a, b) => a.localeCompare(b)),
        ]);
      } catch {
        toast.error('Failed to load model settings');
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, []);

  // ── Save ──────────────────────────────────────────────────────────────────
  const handleSave = async () => {
    const token = getToken();
    if (!token) return;
    setSaving(true);
    try {
      await setModelsConfig(token, {
        DEFAULT_MODELS: defaultModelIds.join(','),
        DEFAULT_PINNED_MODELS: pinnedModelIds.join(','),
        MODEL_ORDER_LIST: modelOrder,
        DEFAULT_MODEL_METADATA: config?.DEFAULT_MODEL_METADATA ?? {},
        DEFAULT_MODEL_PARAMS: config?.DEFAULT_MODEL_PARAMS ?? {},
      });

      const cleanPrompts = prompts.filter((p) => p.content.trim());
      if (showPrompts) {
        await setDefaultPromptSuggestions(token, cleanPrompts);
      }

      toast.success('Model settings saved');
      onSaved?.();
    } catch {
      toast.error('Failed to save model settings');
    } finally {
      setSaving(false);
    }
  };

  // ── Drag-to-reorder ───────────────────────────────────────────────────────
  const handleDragStart = (idx: number) => setDraggingIdx(idx);
  const handleDragOver = (e: React.DragEvent, idx: number) => {
    e.preventDefault();
    if (draggingIdx === null || draggingIdx === idx) return;
    setModelOrder((prev) => move(prev, draggingIdx, idx));
    setDraggingIdx(idx);
  };
  const handleDragEnd = () => setDraggingIdx(null);

  const orderedModelOptions = useMemo(
    () => modelOrder.map((id) => allModels.find((m) => m.id === id) ?? { id, name: id }),
    [modelOrder, allModels],
  );

  if (loading) {
    return (
      <div className="msp-root">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="msp-skeleton-block" />
        ))}
      </div>
    );
  }

  return (
    <div className="msp-root">
      {/* Default models */}
      <div className="msp-card">
        <ModelPicker
          label="Default Models"
          tooltip="Models automatically selected for all users when a new chat is created."
          modelIds={defaultModelIds}
          allModels={allModels}
          onChange={setDefaultModelIds}
        />
      </div>

      {/* Pinned models */}
      <div className="msp-card">
        <ModelPicker
          label="Pinned Models"
          tooltip="Models automatically pinned to the sidebar for all users."
          modelIds={pinnedModelIds}
          allModels={allModels}
          onChange={setPinnedModelIds}
        />
      </div>

      {/* Model order */}
      <div className="msp-card">
        <button
          type="button"
          className="msp-collapsible-header"
          onClick={() => setShowOrder((v) => !v)}
        >
          <div className="msp-picker-label" style={{ marginBottom: 0 }}>Model Display Order</div>
          {showOrder ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
        </button>

        {showOrder && (
          <>
            <p className="msp-picker-hint" style={{ marginTop: '0.35rem' }}>
              Drag to reorder. This sets the order models appear in the model selector for all users.
            </p>
            <div className="msp-order-list">
              {orderedModelOptions.map((m, idx) => (
                <div
                  key={m.id}
                  className={`msp-order-row${draggingIdx === idx ? ' msp-order-row--dragging' : ''}`}
                  draggable
                  onDragStart={() => handleDragStart(idx)}
                  onDragOver={(e) => handleDragOver(e, idx)}
                  onDragEnd={handleDragEnd}
                >
                  <GripVertical className="msp-grip h-3.5 w-3.5" />
                  <span className="msp-order-name">{m.name}</span>
                  <span className="msp-order-id">{m.id}</span>
                </div>
              ))}
            </div>
            <div className="msp-order-actions">
              <button
                type="button"
                className="msp-sort-btn"
                onClick={() => setModelOrder((prev) => [...prev].sort((a, b) => {
                  const na = allModels.find((m) => m.id === a)?.name ?? a;
                  const nb = allModels.find((m) => m.id === b)?.name ?? b;
                  return na.localeCompare(nb);
                }))}
              >
                Sort A → Z
              </button>
              <button
                type="button"
                className="msp-sort-btn"
                onClick={() => setModelOrder((prev) => [...prev].sort((a, b) => {
                  const na = allModels.find((m) => m.id === a)?.name ?? a;
                  const nb = allModels.find((m) => m.id === b)?.name ?? b;
                  return nb.localeCompare(na);
                }))}
              >
                Sort Z → A
              </button>
            </div>
          </>
        )}
      </div>

      {/* Prompt suggestions */}
      <div className="msp-card">
        <button
          type="button"
          className="msp-collapsible-header"
          onClick={() => setShowPrompts((v) => !v)}
        >
          <div className="msp-picker-label" style={{ marginBottom: 0 }}>Default Prompt Suggestions</div>
          {showPrompts ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
        </button>

        {showPrompts && (
          <div className="msp-prompts">
            {prompts.map((p, i) => (
              <div key={i} className="msp-prompt-row">
                <div className="msp-prompt-fields">
                  <input
                    type="text"
                    className="admin-input"
                    placeholder="Prompt title"
                    value={p.title?.[0] ?? ''}
                    onChange={(e) => {
                      const next = [...prompts];
                      next[i] = { ...next[i], title: [e.target.value, next[i].title?.[1] ?? ''] };
                      setPrompts(next);
                    }}
                  />
                  <textarea
                    className="admin-input msp-prompt-content"
                    rows={2}
                    placeholder="Prompt content"
                    value={p.content}
                    onChange={(e) => {
                      const next = [...prompts];
                      next[i] = { ...next[i], content: e.target.value };
                      setPrompts(next);
                    }}
                  />
                </div>
                <button
                  type="button"
                  className="msp-remove-prompt"
                  onClick={() => setPrompts((prev) => prev.filter((_, j) => j !== i))}
                >
                  <Minus className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
            <button
              type="button"
              className="msp-add-prompt-btn"
              onClick={() => setPrompts((prev) => [...prev, { content: '', title: ['', ''] }])}
            >
              <Plus className="h-3.5 w-3.5" /> Add Prompt
            </button>
            <p className="msp-picker-hint">Changes apply to all users globally.</p>
          </div>
        )}
      </div>

      {/* Save */}
      <Button type="button" onClick={() => void handleSave()} disabled={saving}>
        {saving ? 'Saving…' : 'Save Settings'}
      </Button>

      <style>{`
        .msp-root { display: flex; flex-direction: column; gap: 0.85rem; }
        .msp-card {
          border-radius: 0.8rem; border: 1px solid var(--bodhion-card-border);
          background: var(--bodhion-card-bg); padding: 0.9rem 1rem;
          display: flex; flex-direction: column; gap: 0.55rem;
        }
        .msp-skeleton-block {
          height: 80px; border-radius: 0.8rem;
          background: var(--bodhion-search-bg); animation: pulse 1.5s ease infinite;
        }
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }

        /* Picker */
        .msp-picker { display: flex; flex-direction: column; gap: 0.4rem; }
        .msp-picker-label { font-size: 0.79rem; font-weight: 700; color: var(--bodhion-text-primary); }
        .msp-picker-hint { font-size: 0.74rem; color: var(--bodhion-text-secondary); line-height: 1.4; }
        .msp-picker-chips { display: flex; flex-wrap: wrap; gap: 0.35rem; }
        .msp-chip {
          display: inline-flex; align-items: center; gap: 0.3rem;
          padding: 0.2rem 0.45rem 0.2rem 0.6rem; border-radius: 999px;
          background: rgba(37,215,255,0.1); border: 1px solid rgba(37,215,255,0.2);
          font-size: 0.77rem; color: var(--bodhion-text-primary);
        }
        .msp-chip-name { max-width: 160px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .msp-chip-remove { background: none; border: none; cursor: pointer; padding: 0; color: var(--bodhion-text-secondary); display: flex; align-items: center; }
        .msp-chip-remove:hover { color: #ff6060; }
        .msp-picker-add-row { display: flex; gap: 0.4rem; align-items: center; }
        .msp-select { flex: 1; }
        .msp-add-btn {
          display: flex; align-items: center; padding: 0.35rem 0.55rem;
          border-radius: 0.5rem; border: 1px solid var(--bodhion-card-border);
          background: var(--bodhion-search-bg); cursor: pointer; color: var(--bodhion-text-primary);
        }
        .msp-add-btn:disabled { opacity: 0.4; cursor: not-allowed; }
        .msp-add-btn:hover:not(:disabled) { background: rgba(37,215,255,0.08); }

        /* Collapsible */
        .msp-collapsible-header {
          display: flex; align-items: center; justify-content: space-between;
          background: none; border: none; cursor: pointer; padding: 0;
          color: var(--bodhion-text-secondary); width: 100%;
        }
        .msp-collapsible-header:hover { color: var(--bodhion-text-primary); }

        /* Model order */
        .msp-order-list { display: flex; flex-direction: column; gap: 0.2rem; max-height: 240px; overflow-y: auto; margin-top: 0.4rem; }
        .msp-order-row {
          display: flex; align-items: center; gap: 0.5rem;
          padding: 0.35rem 0.5rem; border-radius: 0.45rem;
          border: 1px solid var(--bodhion-card-border); cursor: grab;
          background: var(--bodhion-search-bg); transition: background 0.1s;
        }
        .msp-order-row:hover { background: rgba(37,215,255,0.06); }
        .msp-order-row--dragging { opacity: 0.5; }
        .msp-grip { color: var(--bodhion-text-secondary); flex-shrink: 0; }
        .msp-order-name { font-size: 0.8rem; font-weight: 600; color: var(--bodhion-text-primary); flex: 1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .msp-order-id { font-size: 0.7rem; color: var(--bodhion-text-secondary); flex-shrink: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 140px; }
        .msp-order-actions { display: flex; gap: 0.4rem; padding-top: 0.3rem; }
        .msp-sort-btn {
          font-size: 0.74rem; padding: 0.25rem 0.6rem; border-radius: 0.4rem;
          border: 1px solid var(--bodhion-card-border); background: none;
          color: var(--bodhion-text-secondary); cursor: pointer;
        }
        .msp-sort-btn:hover { color: var(--bodhion-text-primary); background: rgba(37,215,255,0.06); }

        /* Prompts */
        .msp-prompts { display: flex; flex-direction: column; gap: 0.6rem; margin-top: 0.4rem; }
        .msp-prompt-row { display: flex; gap: 0.5rem; align-items: flex-start; }
        .msp-prompt-fields { flex: 1; display: flex; flex-direction: column; gap: 0.35rem; }
        .msp-prompt-content { resize: vertical; min-height: 52px; }
        .msp-remove-prompt {
          background: none; border: none; cursor: pointer; padding: 0.3rem;
          color: var(--bodhion-text-secondary); border-radius: 0.35rem; flex-shrink: 0; margin-top: 0.15rem;
        }
        .msp-remove-prompt:hover { color: #ff6060; background: rgba(255,80,80,0.08); }
        .msp-add-prompt-btn {
          display: inline-flex; align-items: center; gap: 0.35rem;
          font-size: 0.79rem; font-weight: 600; padding: 0.35rem 0.7rem;
          border-radius: 0.5rem; border: 1px solid var(--bodhion-card-border);
          background: var(--bodhion-search-bg); color: var(--bodhion-text-primary); cursor: pointer;
          width: fit-content;
        }
        .msp-add-prompt-btn:hover { background: rgba(37,215,255,0.06); }
      `}</style>
    </div>
  );
}

export default ModelSettingsPanel;
