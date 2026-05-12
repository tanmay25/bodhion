'use client';

// Admin Tools → Manage Ollama Models
// Mirrors src/lib/components/admin/Settings/Models/Manage/ManageOllama.svelte
// Features: list installed models, pull new model (streaming progress), delete model.

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Download, Trash2, X, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { getToken } from '@/lib/auth/session';
import { Button } from '@/components/ui/Button';
import {
  getOllamaConfig,
  getOllamaModels,
  deleteOllamaModel,
  pullOllamaModel,
  type OllamaModel,
} from '@/lib/api/ollama';

// ── Pull progress ─────────────────────────────────────────────────────────────
interface PullProgress {
  status: string;
  digest?: string;
  completed?: number;
  total?: number;
}

function progressPercent(p: PullProgress): number | null {
  if (p.total && p.completed !== undefined) {
    return Math.round((p.completed / p.total) * 100);
  }
  return null;
}

// ── Format bytes ──────────────────────────────────────────────────────────────
function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

// ── Single Ollama instance panel ──────────────────────────────────────────────
function OllamaInstancePanel({ urlIdx }: { urlIdx: number }) {
  const [models, setModels] = useState<OllamaModel[]>([]);
  const [loading, setLoading] = useState(true);
  const [pullTag, setPullTag] = useState('');
  const [pulling, setPulling] = useState(false);
  const [pullProgress, setPullProgress] = useState<PullProgress | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const loadModels = async () => {
    const token = getToken();
    if (!token) return;
    setLoading(true);
    try {
      const list = await getOllamaModels(token, urlIdx);
      setModels(list);
    } catch {
      toast.error('Failed to load Ollama models');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void loadModels(); }, [urlIdx]);

  const handlePull = async () => {
    const tag = pullTag.trim();
    if (!tag) { toast.error('Enter a model name'); return; }
    const token = getToken();
    if (!token) return;

    setPulling(true);
    setPullProgress({ status: 'Starting…' });

    try {
      const { response, controller } = await pullOllamaModel(token, tag, urlIdx);
      abortRef.current = controller;

      const reader = response.body
        ?.pipeThrough(new TextDecoderStream())
        .getReader();

      if (!reader) throw new Error('No response body');

      let buffer = '';
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += value;
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const data = JSON.parse(line) as PullProgress & { error?: string };
            if (data.error) throw new Error(data.error);
            setPullProgress(data);
          } catch (e) {
            if (e instanceof SyntaxError) continue;
            throw e;
          }
        }
      }

      toast.success(`${tag} pulled successfully`);
      setPullTag('');
      await loadModels();
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') {
        toast.info('Pull cancelled');
      } else {
        toast.error(`Pull failed: ${err instanceof Error ? err.message : String(err)}`);
      }
    } finally {
      setPulling(false);
      setPullProgress(null);
      abortRef.current = null;
    }
  };

  const handleDelete = async (model: OllamaModel) => {
    const token = getToken();
    if (!token) return;
    setDeletingId(model.id);
    try {
      await deleteOllamaModel(token, model.name, urlIdx);
      toast.success(`${model.name} deleted`);
      setModels((prev) => prev.filter((m) => m.id !== model.id));
    } catch {
      toast.error('Failed to delete model');
    } finally {
      setDeletingId(null);
      setConfirmDeleteId(null);
    }
  };

  return (
    <div className="mop-root">
      {/* Pull model */}
      <div className="mop-section">
        <div className="mop-section-title">Pull a Model</div>
        <div className="mop-pull-row">
          <input
            type="text"
            className="admin-input mop-pull-input"
            placeholder="e.g. llama3.2, mistral:7b, phi3"
            value={pullTag}
            onChange={(e) => setPullTag(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !pulling) void handlePull(); }}
            disabled={pulling}
          />
          {pulling ? (
            <button
              type="button"
              className="mop-cancel-btn"
              onClick={() => abortRef.current?.abort()}
            >
              <X className="h-3.5 w-3.5" /> Cancel
            </button>
          ) : (
            <Button type="button" onClick={() => void handlePull()} disabled={!pullTag.trim()}>
              <Download className="h-3.5 w-3.5" /> Pull
            </Button>
          )}
        </div>

        {pullProgress && (
          <div className="mop-progress-wrap">
            <div className="mop-progress-status">{pullProgress.status}</div>
            {pullProgress.total != null && pullProgress.completed != null && (
              <>
                <div className="mop-progress-bar-track">
                  <div
                    className="mop-progress-bar-fill"
                    style={{ width: `${progressPercent(pullProgress)}%` }}
                  />
                </div>
                <div className="mop-progress-numbers">
                  {formatBytes(pullProgress.completed)} / {formatBytes(pullProgress.total)}
                  {' · '}{progressPercent(pullProgress)}%
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* Installed models */}
      <div className="mop-section">
        <div className="mop-section-header">
          <div className="mop-section-title">
            Installed Models
            <span className="mop-count">{models.length}</span>
          </div>
          <button
            type="button"
            className="mop-refresh-btn"
            onClick={() => void loadModels()}
            disabled={loading}
            title="Refresh"
          >
            <RefreshCw className={`h-3.5 w-3.5${loading ? ' mop-spin' : ''}`} />
          </button>
        </div>

        {loading ? (
          <div className="mop-skeleton-list">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="mop-skeleton-row">
                <div className="mop-skeleton-name" />
                <div className="mop-skeleton-size" />
              </div>
            ))}
          </div>
        ) : models.length === 0 ? (
          <div className="mop-empty">No models installed on this instance.</div>
        ) : (
          <div className="mop-model-list">
            {models.map((model) => (
              <div key={model.id} className="mop-model-row">
                <div className="mop-model-info">
                  <span className="mop-model-name">{model.name}</span>
                  <span className="mop-model-size">{formatBytes(model.size)}</span>
                  {model.details?.parameter_size && (
                    <span className="mop-model-badge">{model.details.parameter_size}</span>
                  )}
                </div>

                {confirmDeleteId === model.id ? (
                  <div className="mop-confirm-row">
                    <span className="mop-confirm-text">Delete?</span>
                    <button
                      type="button"
                      className="mop-confirm-yes"
                      onClick={() => void handleDelete(model)}
                      disabled={deletingId === model.id}
                    >
                      {deletingId === model.id ? '…' : 'Yes'}
                    </button>
                    <button
                      type="button"
                      className="mop-confirm-no"
                      onClick={() => setConfirmDeleteId(null)}
                    >
                      No
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    className="mop-delete-btn"
                    onClick={() => setConfirmDeleteId(model.id)}
                    title={`Delete ${model.name}`}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <style>{`
        .mop-root { display: flex; flex-direction: column; gap: 1.25rem; }
        .mop-section { display: flex; flex-direction: column; gap: 0.6rem; }
        .mop-section-title {
          font-size: 0.78rem; font-weight: 700; text-transform: uppercase;
          letter-spacing: 0.07em; color: var(--bodhion-text-secondary);
          display: flex; align-items: center; gap: 0.4rem;
        }
        .mop-section-header { display: flex; align-items: center; justify-content: space-between; }
        .mop-count {
          font-size: 0.72rem; font-weight: 600; padding: 0.1rem 0.4rem;
          border-radius: 999px; background: rgba(37,215,255,0.12); color: #25d7ff;
        }
        .mop-pull-row { display: flex; gap: 0.5rem; }
        .mop-pull-input { flex: 1; }
        .mop-cancel-btn {
          display: inline-flex; align-items: center; gap: 0.35rem;
          padding: 0.35rem 0.75rem; border-radius: 0.5rem; font-size: 0.8rem; font-weight: 600;
          border: 1px solid rgba(255,80,80,0.3); background: rgba(255,80,80,0.1);
          color: #ff6060; cursor: pointer;
        }
        .mop-progress-wrap { display: flex; flex-direction: column; gap: 0.3rem; padding: 0.6rem; border-radius: 0.6rem; background: var(--bodhion-search-bg); }
        .mop-progress-status { font-size: 0.78rem; color: var(--bodhion-text-secondary); }
        .mop-progress-bar-track { height: 4px; border-radius: 2px; background: rgba(255,255,255,0.08); overflow: hidden; }
        .mop-progress-bar-fill { height: 100%; border-radius: 2px; background: var(--bodhion-accent, #25d7ff); transition: width 0.2s; }
        .mop-progress-numbers { font-size: 0.72rem; color: var(--bodhion-text-secondary); }
        .mop-refresh-btn { background: none; border: none; cursor: pointer; padding: 0.2rem; color: var(--bodhion-text-secondary); border-radius: 0.3rem; }
        .mop-refresh-btn:hover { color: var(--bodhion-text-primary); }
        @keyframes mop-spin-kf { to { transform: rotate(360deg); } }
        .mop-spin { animation: mop-spin-kf 1s linear infinite; }
        .mop-skeleton-list { display: flex; flex-direction: column; gap: 0.5rem; }
        .mop-skeleton-row { display: flex; align-items: center; justify-content: space-between; padding: 0.55rem 0.75rem; border-radius: 0.5rem; background: var(--bodhion-search-bg); }
        .mop-skeleton-name { height: 12px; width: 140px; border-radius: 4px; background: rgba(255,255,255,0.08); animation: pulse 1.5s ease infinite; }
        .mop-skeleton-size { height: 10px; width: 60px; border-radius: 4px; background: rgba(255,255,255,0.06); animation: pulse 1.5s ease infinite; }
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
        .mop-empty { font-size: 0.82rem; color: var(--bodhion-text-secondary); padding: 0.75rem 0; }
        .mop-model-list { display: flex; flex-direction: column; border-radius: 0.65rem; overflow: hidden; border: 1px solid var(--bodhion-card-border); }
        .mop-model-row {
          display: flex; align-items: center; justify-content: space-between;
          padding: 0.55rem 0.75rem; border-bottom: 1px solid var(--bodhion-card-border);
        }
        .mop-model-row:last-child { border-bottom: none; }
        .mop-model-info { display: flex; align-items: center; gap: 0.5rem; min-width: 0; }
        .mop-model-name { font-size: 0.83rem; font-weight: 600; color: var(--bodhion-text-primary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .mop-model-size { font-size: 0.72rem; color: var(--bodhion-text-secondary); flex-shrink: 0; }
        .mop-model-badge { font-size: 0.65rem; padding: 0.1rem 0.35rem; border-radius: 999px; border: 1px solid var(--bodhion-card-border); color: var(--bodhion-text-secondary); flex-shrink: 0; }
        .mop-delete-btn { background: none; border: none; cursor: pointer; padding: 0.25rem; color: var(--bodhion-text-secondary); border-radius: 0.35rem; flex-shrink: 0; }
        .mop-delete-btn:hover { color: #ff6060; background: rgba(255,80,80,0.1); }
        .mop-confirm-row { display: flex; align-items: center; gap: 0.4rem; flex-shrink: 0; }
        .mop-confirm-text { font-size: 0.76rem; color: var(--bodhion-text-secondary); }
        .mop-confirm-yes { font-size: 0.75rem; font-weight: 700; padding: 0.2rem 0.5rem; border-radius: 0.35rem; border: 1px solid rgba(255,80,80,0.3); background: rgba(255,80,80,0.1); color: #ff6060; cursor: pointer; }
        .mop-confirm-no { font-size: 0.75rem; font-weight: 600; padding: 0.2rem 0.5rem; border-radius: 0.35rem; border: 1px solid var(--bodhion-card-border); background: none; color: var(--bodhion-text-secondary); cursor: pointer; }
      `}</style>
    </div>
  );
}

// ── Public component — handles multi-instance select ─────────────────────────
export function ManageOllamaPanel() {
  const [ollamaUrls, setOllamaUrls] = useState<string[]>([]);
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [configLoading, setConfigLoading] = useState(true);
  const [ollamaEnabled, setOllamaEnabled] = useState(false);

  useEffect(() => {
    const token = getToken();
    if (!token) { setConfigLoading(false); return; }
    getOllamaConfig(token)
      .then((cfg) => {
        setOllamaEnabled(cfg?.ENABLE_OLLAMA_API ?? false);
        setOllamaUrls(cfg?.OLLAMA_BASE_URLS ?? []);
      })
      .catch(() => toast.error('Failed to load Ollama config'))
      .finally(() => setConfigLoading(false));
  }, []);

  if (configLoading) {
    return <div className="mop-root"><div className="mop-empty">Loading Ollama config…</div></div>;
  }

  if (!ollamaEnabled || ollamaUrls.length === 0) {
    return (
      <div className="mop-root">
        <div className="mop-empty">
          No Ollama instances configured. Add one in{' '}
          <Link href="/admin/settings/connections" style={{ color: 'var(--bodhion-accent, #25d7ff)' }}>
            Connections
          </Link>.
        </div>
      </div>
    );
  }

  return (
    <div className="mop-root">
      {ollamaUrls.length > 1 && (
        <div>
          <label className="mop-section-title" style={{ display: 'block', marginBottom: '0.4rem' }}>
            Ollama Instance
          </label>
          <select
            className="admin-models-view-select"
            value={selectedIdx}
            onChange={(e) => setSelectedIdx(Number(e.target.value))}
          >
            {ollamaUrls.map((url, idx) => (
              <option key={idx} value={idx}>{url}</option>
            ))}
          </select>
        </div>
      )}
      {ollamaUrls.length === 1 && (
        <div className="mop-section-title" style={{ color: 'var(--bodhion-text-secondary)', fontSize: '0.78rem' }}>
          Instance: <span style={{ color: 'var(--bodhion-text-primary)' }}>{ollamaUrls[0]}</span>
        </div>
      )}
      <OllamaInstancePanel key={selectedIdx} urlIdx={selectedIdx} />
    </div>
  );
}

export default ManageOllamaPanel;
