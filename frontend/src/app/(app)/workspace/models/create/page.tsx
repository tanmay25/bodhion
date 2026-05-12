'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { ArrowLeft, Lock, Unlock } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { getToken } from '@/lib/auth/session';
import { createModel, getBaseModels } from '@/lib/api/models';

type ModelDraft = {
  id: string;
  name: string;
  base_model_id: string;
  description: string;
};

// Generate a short ID from name + timestamp.
// Uses crypto.subtle when available (HTTPS/localhost), falls back to a simple hash otherwise.
async function generateModelId(name: string): Promise<string> {
  const clean = name.toLowerCase().replace(/[^a-z0-9]/g, '');
  const now = new Date();
  const dd   = String(now.getDate()).padStart(2, '0');
  const mm   = String(now.getMonth() + 1).padStart(2, '0');
  const yyyy = now.getFullYear();
  const hh   = String(now.getHours()).padStart(2, '0');
  const min  = String(now.getMinutes()).padStart(2, '0');
  const ss   = String(now.getSeconds()).padStart(2, '0');
  const source = `${clean}_${dd}${mm}${yyyy}${hh}${min}${ss}_BODHION`;

  if (typeof crypto !== 'undefined' && crypto.subtle) {
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(source));
    return Array.from(new Uint8Array(buf))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('')
      .slice(0, 16);
  }

  // Fallback for non-secure contexts (HTTP over non-localhost): djb2-variant hash
  let h = 5381;
  for (let i = 0; i < source.length; i++) {
    h = ((h << 5) + h) ^ source.charCodeAt(i);
    h = h >>> 0;
  }
  return h.toString(16).padStart(8, '0') + Date.now().toString(16).slice(-8);
}

export default function CreateModelPage() {
  const router = useRouter();
  const [draft, setDraft] = useState<ModelDraft>({ id: '', name: '', base_model_id: '', description: '' });
  const [baseModels, setBaseModels] = useState<{ id: string; name: string }[]>([]);
  const [idLocked, setIdLocked] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const token = getToken();
    if (!token) return;
    getBaseModels(token)
      .then((models) => setBaseModels(models.map((m) => ({ id: m.id, name: m.name ?? m.id }))))
      .catch(() => {});
  }, []);

  useEffect(() => {
    const saved = sessionStorage.getItem('model');
    if (!saved) return;
    try {
      const parsed = JSON.parse(saved) as { id?: string; name?: string; base_model_id?: string; meta?: { description?: string } };
      setDraft({ id: parsed.id ?? '', name: parsed.name ?? '', base_model_id: parsed.base_model_id ?? '', description: parsed.meta?.description ?? '' });
      if (parsed.id) setIdLocked(false);
    } catch { /* ignore */ }
    finally { sessionStorage.removeItem('model'); }
  }, []);

  const handleNameChange = async (value: string) => {
    const id = value.trim() ? await generateModelId(value) : '';
    setDraft((prev) => ({ ...prev, name: value, ...(idLocked && { id }) }));
  };

  const toggleLock = async () => {
    if (!idLocked) {
      // re-locking → regenerate from current name
      const id = draft.name.trim() ? await generateModelId(draft.name) : '';
      setDraft((prev) => ({ ...prev, id }));
    }
    setIdLocked((v) => !v);
  };

  const submit = async () => {
    const token = getToken();
    if (!token) return;
    if (!draft.name.trim() || !draft.id.trim()) { toast.error('Name and Model ID are required'); return; }
    if (!draft.base_model_id) { toast.error('Please select a base model'); return; }
    setSaving(true);
    try {
      await createModel(token, { id: draft.id.trim(), name: draft.name.trim(), base_model_id: draft.base_model_id, meta: { description: draft.description.trim() }, params: {} });
      toast.success('Model created');
      router.push('/workspace/models');
    } catch {
      toast.error('Failed to create model');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="workspace-model-edit-page">

      {/* Header */}
      <div className="workspace-model-edit-header">
        <div className="cm-header-top">
          <div className="workspace-model-edit-eyebrow">BODHION WORKSPACE</div>
          <button type="button" className="cm-back-btn" onClick={() => router.push('/workspace/models')}>
            <ArrowLeft size={14} />
            <span>Back to Models</span>
          </button>
        </div>
        <h1 className="workspace-model-edit-title">Create Model</h1>
        <p className="workspace-model-edit-copy">
          Define a custom workspace model built on an existing provider model.
        </p>
      </div>

      {/* Form */}
      <div className="workspace-model-edit-surface">
        <div className="workspace-model-edit-grid">

          {/* Base model */}
          <div className="workspace-model-edit-field workspace-model-edit-field--full">
            <label htmlFor="cm-base">Base Model <span className="cm-required">*</span></label>
            <select id="cm-base" value={draft.base_model_id} onChange={(e) => setDraft((p) => ({ ...p, base_model_id: e.target.value }))} className="cm-select" required>
              <option value="">Select a provider model…</option>
              {baseModels.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
          </div>

          {/* Name */}
          <div className="workspace-model-edit-field">
            <label htmlFor="cm-name">Name <span className="cm-required">*</span></label>
            <input id="cm-name" type="text" value={draft.name} onChange={(e) => void handleNameChange(e.target.value)} placeholder="My Custom Model" autoFocus />
          </div>

          {/* Model ID — locked by default */}
          <div className="workspace-model-edit-field">
            <label htmlFor="cm-id">Model ID <span className="cm-required">*</span></label>
            <div className="cm-id-wrap">
              <input
                id="cm-id"
                type="text"
                value={draft.id}
                readOnly={idLocked}
                onChange={(e) => setDraft((p) => ({ ...p, id: e.target.value }))}
                placeholder="auto-generated"
                className={idLocked ? 'cm-id-readonly' : ''}
              />
              <button type="button" className="cm-lock-btn" onClick={() => void toggleLock()} title={idLocked ? 'Click to edit ID manually' : 'Click to re-lock and regenerate'}>
                {idLocked ? <Lock size={13} /> : <Unlock size={13} />}
              </button>
            </div>
            <span className="cm-hint">
              {idLocked ? 'Auto-generated from name · click 🔒 to override' : 'Editing manually — auto-generation paused'}
            </span>
          </div>

          {/* Description */}
          <div className="workspace-model-edit-field workspace-model-edit-field--full">
            <label htmlFor="cm-desc">Description</label>
            <textarea id="cm-desc" value={draft.description} onChange={(e) => setDraft((p) => ({ ...p, description: e.target.value }))} placeholder="Optional — describe what this model is optimised for" rows={4} />
          </div>

        </div>

        {/* Actions */}
        <div className="workspace-model-edit-actions">
          <Button type="button" variant="outline" className="cm-btn-cancel" onClick={() => router.push('/workspace/models')}>Cancel</Button>
          <button type="button" className="cm-btn-create" disabled={saving} onClick={() => void submit()}>
            {saving ? 'Creating…' : 'Create Model'}
          </button>
        </div>
      </div>

      <style>{`
        .cm-back-btn {
          display: inline-flex; align-items: center; gap: 0.45rem;
          padding: 0.38rem 0.85rem 0.38rem 0.62rem;
          border-radius: 999px;
          border: 1px solid var(--bodhion-shell-border, rgba(143,169,189,0.14));
          background: var(--bodhion-muted-button-bg, rgba(255,255,255,0.04));
          cursor: pointer;
          font-size: 0.78rem; font-weight: 600;
          color: var(--bodhion-text-secondary, #8fa9bd);
          transition: color 0.15s, border-color 0.15s, background 0.15s;
        }
        .cm-back-btn:hover {
          color: var(--bodhion-accent, #25d7ff);
          border-color: var(--bodhion-shell-border-strong, rgba(37,215,255,0.24));
          background: rgba(37,215,255,0.06);
        }

        .cm-header-top {
          display: flex;
          align-items: center;
          justify-content: space-between;
        }

        .cm-required { color: var(--bodhion-accent, #25d7ff); }
        .cm-hint { font-size: 0.74rem; color: var(--bodhion-text-secondary, #8fa9bd); }

        .cm-select {
          width: 100%; border-radius: 0.8rem;
          border: 1px solid var(--bodhion-shell-border, rgba(143,169,189,0.14));
          background-color: var(--bodhion-search-bg, rgba(18,29,47,0.9));
          color: var(--bodhion-text-primary, #eaf6ff);
          padding: 0.62rem 2.2rem 0.62rem 0.75rem;
          font-size: 0.88rem; outline: none;
          appearance: none; -webkit-appearance: none;
          background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%238fa9bd' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E");
          background-repeat: no-repeat; background-position: right 0.75rem center;
          cursor: pointer; transition: border-color 0.15s;
        }
        .cm-select:focus {
          border-color: var(--bodhion-shell-border-strong, rgba(37,215,255,0.24));
          box-shadow: 0 0 0 2px rgba(37,215,255,0.08);
        }
        .cm-select option { background: var(--bodhion-sidebar-bg, #071524); color: var(--bodhion-text-primary, #eaf6ff); }

        /* ID field with lock button */
        .cm-id-wrap {
          display: flex; align-items: stretch;
          border-radius: 0.8rem; overflow: hidden;
          border: 1px solid var(--bodhion-shell-border, rgba(143,169,189,0.14));
          background: var(--bodhion-search-bg, rgba(18,29,47,0.9));
          transition: border-color 0.15s;
        }
        .cm-id-wrap:focus-within {
          border-color: var(--bodhion-shell-border-strong, rgba(37,215,255,0.24));
          box-shadow: 0 0 0 2px rgba(37,215,255,0.08);
        }
        .cm-id-wrap input {
          flex: 1; border: none !important; border-radius: 0 !important;
          background: transparent !important; box-shadow: none !important;
          padding: 0.62rem 0.75rem; font-size: 0.88rem;
          color: var(--bodhion-text-primary, #eaf6ff); outline: none;
          min-width: 0;
        }
        .cm-id-wrap input::placeholder { color: var(--bodhion-text-secondary, #8fa9bd); }
        .cm-id-readonly { opacity: 0.65; cursor: default; font-family: monospace; letter-spacing: 0.04em; }

        .cm-lock-btn {
          flex-shrink: 0; background: none; border: none;
          padding: 0 0.7rem; cursor: pointer;
          color: var(--bodhion-text-secondary, #8fa9bd);
          border-left: 1px solid var(--bodhion-shell-border, rgba(143,169,189,0.14));
          display: flex; align-items: center;
          transition: color 0.15s, background 0.15s;
        }
        .cm-lock-btn:hover { color: var(--bodhion-accent, #25d7ff); background: rgba(37,215,255,0.06); }

        .workspace-model-edit-field input:focus,
        .workspace-model-edit-field textarea:focus {
          border-color: var(--bodhion-shell-border-strong, rgba(37,215,255,0.24));
          box-shadow: 0 0 0 2px rgba(37,215,255,0.08);
        }

        .cm-btn-cancel {
          border-color: var(--bodhion-shell-border, rgba(143,169,189,0.14));
          color: var(--bodhion-text-secondary, #8fa9bd);
          background: var(--bodhion-muted-button-bg, rgba(255,255,255,0.04));
        }
        .cm-btn-cancel:hover {
          border-color: var(--bodhion-shell-border-strong, rgba(37,215,255,0.24));
          color: var(--bodhion-text-primary, #eaf6ff);
        }

        .cm-btn-create {
          display: inline-flex; align-items: center; justify-content: center;
          gap: 0.4rem; padding: 0.58rem 1.4rem; border-radius: 0.75rem;
          border: 1px solid var(--bodhion-shell-border-strong, rgba(37,215,255,0.24));
          background: var(--bodhion-primary-button, linear-gradient(135deg, rgba(0,104,201,0.94), rgba(37,215,255,0.72)));
          box-shadow: var(--bodhion-primary-button-shadow, 0 10px 30px rgba(0,104,201,0.26));
          color: var(--bodhion-nav-active-color, #f5fbff);
          font-size: 0.875rem; font-weight: 700; cursor: pointer;
          transition: transform 0.15s ease, filter 0.15s ease;
        }
        .cm-btn-create:hover:not(:disabled) { transform: translateY(-1px); filter: brightness(1.08); }
        .cm-btn-create:active:not(:disabled) { transform: scale(0.98); }
        .cm-btn-create:disabled { opacity: 0.55; cursor: not-allowed; }

        html.bodhion-light .cm-select, html.light .cm-select {
          background-color: rgba(255,255,255,0.88);
          color: var(--bodhion-text-primary, #143654);
        }
        html.bodhion-light .cm-select option, html.light .cm-select option {
          background: #f0f7ff; color: #143654;
        }
        html.bodhion-light .cm-id-wrap, html.light .cm-id-wrap {
          background: rgba(255,255,255,0.88);
        }
      `}</style>
    </div>
  );
}
