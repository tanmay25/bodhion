'use client';

import { useEffect, useRef, useState } from 'react';
import { Plus, Trash2, Eye, EyeOff, ToggleLeft, ToggleRight } from 'lucide-react';
import { useWorkspaceStore } from '@/store/workspaceStore';
import { getToken } from '@/lib/auth/session';
import { updateUserSettings } from '@/lib/api/users';
import type { DirectConnections } from '@/types/config';

const EMPTY: DirectConnections = {
  OPENAI_API_BASE_URLS: [],
  OPENAI_API_KEYS: [],
  OPENAI_API_CONFIGS: {},
};

// Normalise so URLs/KEYS arrays are always the same length
function normalise(c: DirectConnections): DirectConnections {
  const urls = c.OPENAI_API_BASE_URLS.map((u) => u.replace(/\/$/, ''));
  const keys = [...c.OPENAI_API_KEYS];
  while (keys.length < urls.length) keys.push('');
  return { OPENAI_API_BASE_URLS: urls, OPENAI_API_KEYS: keys.slice(0, urls.length), OPENAI_API_CONFIGS: c.OPENAI_API_CONFIGS };
}

// ── Add-connection form ───────────────────────────────────────────────────────

function AddConnectionForm({ onAdd, onCancel }: { onAdd: (url: string, key: string) => void; onCancel: () => void }) {
  const [url, setUrl] = useState('');
  const [key, setKey] = useState('');
  const [showKey, setShowKey] = useState(false);

  return (
    <div className="conn-add-form">
      <div className="conn-add-form-title">New connection</div>
      <div className="conn-field-group">
        <label className="conn-label">API Base URL</label>
        <input
          className="conn-input"
          type="url"
          placeholder="https://api.openai.com/v1"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          autoFocus
        />
      </div>
      <div className="conn-field-group">
        <label className="conn-label">API Key</label>
        <div className="conn-input-wrap">
          <input
            className="conn-input conn-input--key"
            type={showKey ? 'text' : 'password'}
            placeholder="sk-…"
            value={key}
            onChange={(e) => setKey(e.target.value)}
          />
          <button type="button" className="conn-eye-btn" onClick={() => setShowKey((v) => !v)} aria-label="Toggle visibility">
            {showKey ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
          </button>
        </div>
      </div>
      <div className="conn-add-actions">
        <button type="button" className="conn-btn conn-btn--ghost" onClick={onCancel}>Cancel</button>
        <button
          type="button"
          className="conn-btn conn-btn--primary"
          disabled={!url.trim()}
          onClick={() => { if (url.trim()) onAdd(url.trim(), key.trim()); }}
        >
          Add
        </button>
      </div>
    </div>
  );
}

// ── Single connection row ─────────────────────────────────────────────────────

function ConnectionRow({
  url, apiKey, enabled,
  onUrlChange, onKeyChange, onToggle, onDelete,
}: {
  url: string; apiKey: string; enabled: boolean;
  onUrlChange: (v: string) => void;
  onKeyChange: (v: string) => void;
  onToggle: () => void;
  onDelete: () => void;
}) {
  const [showKey, setShowKey] = useState(false);

  return (
    <div className="conn-row">
      <div className="conn-row-fields">
        <input
          className="conn-input"
          type="url"
          value={url}
          onChange={(e) => onUrlChange(e.target.value)}
          placeholder="https://api.openai.com/v1"
        />
        <div className="conn-input-wrap">
          <input
            className="conn-input conn-input--key"
            type={showKey ? 'text' : 'password'}
            value={apiKey}
            onChange={(e) => onKeyChange(e.target.value)}
            placeholder="API Key"
          />
          <button type="button" className="conn-eye-btn" onClick={() => setShowKey((v) => !v)} aria-label="Toggle key visibility">
            {showKey ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
          </button>
        </div>
      </div>
      <div className="conn-row-actions">
        <button type="button" className="conn-icon-btn" onClick={onToggle} aria-label={enabled ? 'Disable' : 'Enable'}>
          {enabled
            ? <ToggleRight className="h-5 w-5 conn-toggle--on" />
            : <ToggleLeft className="h-5 w-5 conn-toggle--off" />}
        </button>
        <button type="button" className="conn-icon-btn conn-icon-btn--danger" onClick={onDelete} aria-label="Delete connection">
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

// ── Tab ───────────────────────────────────────────────────────────────────────

export function ConnectionsTab({ onRegisterSave }: { onRegisterSave: (fn: () => Promise<void>) => void }) {
  const settings = useWorkspaceStore((s) => s.settings);
  const patchSettings = useWorkspaceStore((s) => s.patchSettings);
  const [conn, setConn] = useState<DirectConnections>(EMPTY);
  const [showAdd, setShowAdd] = useState(false);

  // Initialise from stored user settings
  useEffect(() => {
    setConn(settings.directConnections ? normalise(settings.directConnections) : { ...EMPTY });
  }, [settings.directConnections]);

  const latestRef = useRef({ conn, settings });
  latestRef.current = { conn, settings };

  // Register save handler once — persists directConnections to backend
  useEffect(() => {
    onRegisterSave(async () => {
      const token = getToken();
      if (!token) throw new Error('Not authenticated');
      const { conn: c, settings: s } = latestRef.current;
      const normalised = normalise(c);
      await updateUserSettings(token, { ui: { ...s, directConnections: normalised } });
      patchSettings({ directConnections: normalised });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onRegisterSave]);

  const updateUrl = (idx: number, val: string) =>
    setConn((prev) => {
      const urls = [...prev.OPENAI_API_BASE_URLS];
      urls[idx] = val;
      return { ...prev, OPENAI_API_BASE_URLS: urls };
    });

  const updateKey = (idx: number, val: string) =>
    setConn((prev) => {
      const keys = [...prev.OPENAI_API_KEYS];
      keys[idx] = val;
      return { ...prev, OPENAI_API_KEYS: keys };
    });

  const toggleEnabled = (idx: number) =>
    setConn((prev) => {
      const cfg = { ...prev.OPENAI_API_CONFIGS };
      cfg[idx] = { ...(cfg[idx] ?? {}), enable: !(cfg[idx]?.enable ?? true) };
      return { ...prev, OPENAI_API_CONFIGS: cfg };
    });

  const deleteConn = (idx: number) =>
    setConn((prev) => {
      const urls = prev.OPENAI_API_BASE_URLS.filter((_, i) => i !== idx);
      const keys = prev.OPENAI_API_KEYS.filter((_, i) => i !== idx);
      const cfg: DirectConnections['OPENAI_API_CONFIGS'] = {};
      urls.forEach((_, newIdx) => {
        cfg[newIdx] = prev.OPENAI_API_CONFIGS[newIdx < idx ? newIdx : newIdx + 1] ?? {};
      });
      return { OPENAI_API_BASE_URLS: urls, OPENAI_API_KEYS: keys, OPENAI_API_CONFIGS: cfg };
    });

  const addConn = (url: string, key: string) => {
    setConn((prev) => {
      const urls = [...prev.OPENAI_API_BASE_URLS, url];
      const keys = [...prev.OPENAI_API_KEYS, key];
      const cfg = { ...prev.OPENAI_API_CONFIGS, [urls.length - 1]: { enable: true } };
      return { OPENAI_API_BASE_URLS: urls, OPENAI_API_KEYS: keys, OPENAI_API_CONFIGS: cfg };
    });
    setShowAdd(false);
  };

  return (
    <div className="settings-tab-content">
      <div className="settings-section">
        <div className="settings-section-title">Direct Connections</div>
        <div className="settings-section-desc">
          Connect to your own OpenAI-compatible API endpoints. CORS must be configured by the provider to allow requests from this app.
        </div>

        <div className="conn-list">
          {conn.OPENAI_API_BASE_URLS.length === 0 && !showAdd && (
            <div className="conn-empty">No connections yet. Click <strong>+</strong> to add one.</div>
          )}

          {conn.OPENAI_API_BASE_URLS.map((url, idx) => (
            <ConnectionRow
              key={idx}
              url={url}
              apiKey={conn.OPENAI_API_KEYS[idx] ?? ''}
              enabled={conn.OPENAI_API_CONFIGS[idx]?.enable ?? true}
              onUrlChange={(v) => updateUrl(idx, v)}
              onKeyChange={(v) => updateKey(idx, v)}
              onToggle={() => toggleEnabled(idx)}
              onDelete={() => deleteConn(idx)}
            />
          ))}

          {showAdd && (
            <AddConnectionForm onAdd={addConn} onCancel={() => setShowAdd(false)} />
          )}
        </div>

        {!showAdd && (
          <button type="button" className="conn-add-btn" onClick={() => setShowAdd(true)}>
            <Plus className="h-4 w-4" />
            Add connection
          </button>
        )}
      </div>
    </div>
  );
}
