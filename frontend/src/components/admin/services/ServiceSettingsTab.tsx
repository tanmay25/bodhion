'use client';

import { useState } from 'react';
import { Plus, Trash2, ChevronDown, ChevronRight } from 'lucide-react';

export type SettingsState = Record<string, Record<string, unknown>>;

interface ServiceSettingsTabProps {
  settings: SettingsState;
  onChange: (settings: SettingsState) => void;
}

function tryPrettyJson(val: unknown): string {
  try {
    return JSON.stringify(val, null, 2);
  } catch {
    return '{}';
  }
}

function tryParseJson(str: string): { ok: true; value: Record<string, unknown> } | { ok: false; error: string } {
  try {
    const parsed = JSON.parse(str);
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      return { ok: false, error: 'Must be a JSON object {}' };
    }
    return { ok: true, value: parsed as Record<string, unknown> };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}

function SettingSection({
  tabKey,
  data,
  onDataChange,
  onRemove,
}: {
  tabKey: string;
  data: Record<string, unknown>;
  onDataChange: (val: Record<string, unknown>) => void;
  onRemove: () => void;
}) {
  const [open, setOpen] = useState(true);
  const [raw, setRaw] = useState(tryPrettyJson(data));
  const [parseError, setParseError] = useState<string | null>(null);

  const handleBlur = () => {
    const result = tryParseJson(raw);
    if (result.ok) {
      setParseError(null);
      onDataChange(result.value);
    } else {
      setParseError(result.error);
    }
  };

  return (
    <div className="svc-settings-section">
      {/* Section header */}
      <div className="svc-settings-section-header">
        <button
          type="button"
          className="svc-settings-collapse-btn"
          onClick={() => setOpen((v) => !v)}
        >
          {open
            ? <ChevronDown style={{ width: '0.9rem', height: '0.9rem' }} />
            : <ChevronRight style={{ width: '0.9rem', height: '0.9rem' }} />}
          <span className="svc-settings-tab-key">{tabKey}</span>
        </button>
        <button
          type="button"
          className="svc-settings-remove-btn"
          title="Remove this settings tab"
          onClick={onRemove}
        >
          <Trash2 style={{ width: '0.8rem', height: '0.8rem' }} />
        </button>
      </div>

      {/* JSON editor */}
      {open && (
        <div className="svc-settings-editor-wrap">
          <textarea
            className={`svc-settings-editor${parseError ? ' svc-settings-editor--error' : ''}`}
            value={raw}
            onChange={(e) => setRaw(e.target.value)}
            onBlur={handleBlur}
            rows={8}
            spellCheck={false}
          />
          {parseError && (
            <p className="svc-settings-error">{parseError}</p>
          )}
        </div>
      )}
    </div>
  );
}

export function ServiceSettingsTab({ settings, onChange }: ServiceSettingsTabProps) {
  const [newTabKey, setNewTabKey] = useState('');
  const [addError, setAddError] = useState<string | null>(null);

  const handleAddTab = () => {
    const key = newTabKey.trim();
    if (!key) {
      setAddError('Tab name cannot be empty.');
      return;
    }
    if (key in settings) {
      setAddError(`Tab "${key}" already exists.`);
      return;
    }
    setAddError(null);
    onChange({ ...settings, [key]: {} });
    setNewTabKey('');
  };

  const handleDataChange = (tabKey: string, val: Record<string, unknown>) => {
    onChange({ ...settings, [tabKey]: val });
  };

  const handleRemove = (tabKey: string) => {
    const next = { ...settings };
    delete next[tabKey];
    onChange(next);
  };

  const tabKeys = Object.keys(settings);

  return (
    <div className="svc-settings-tab flex flex-col gap-3">
      {tabKeys.length === 0 && (
        <div className="svc-settings-empty">
          No settings tabs configured. Add one below to store service-specific configuration.
        </div>
      )}

      {tabKeys.map((key) => (
        <SettingSection
          key={key}
          tabKey={key}
          data={settings[key]}
          onDataChange={(val) => handleDataChange(key, val)}
          onRemove={() => handleRemove(key)}
        />
      ))}

      {/* Add tab row */}
      <div className="svc-settings-add-row">
        <input
          className="svc-settings-add-input"
          value={newTabKey}
          placeholder="New tab name (e.g. llm, rag, ui)"
          onChange={(e) => { setNewTabKey(e.target.value); setAddError(null); }}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddTab(); } }}
        />
        <button type="button" className="svc-settings-add-btn" onClick={handleAddTab}>
          <Plus style={{ width: '0.85rem', height: '0.85rem' }} />
          Add Tab
        </button>
      </div>
      {addError && <p className="svc-settings-error">{addError}</p>}

      <style>{`
        .svc-settings-tab { color: var(--bodhion-text-primary); }

        .svc-settings-empty {
          font-size: 0.82rem;
          color: var(--bodhion-text-secondary);
          text-align: center;
          padding: 1.5rem 1rem;
          border-radius: 1rem;
          border: 1px dashed var(--bodhion-card-border);
        }

        .svc-settings-section {
          border-radius: 1rem;
          border: 1px solid var(--bodhion-card-border);
          background: var(--bodhion-card-bg);
          overflow: hidden;
        }
        .svc-settings-section-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0.6rem 0.85rem;
          border-bottom: 1px solid var(--bodhion-card-border);
        }
        .svc-settings-collapse-btn {
          display: flex;
          align-items: center;
          gap: 0.4rem;
          background: none;
          border: none;
          color: var(--bodhion-text-primary);
          cursor: pointer;
          font-size: 0.84rem;
          font-weight: 600;
          padding: 0;
        }
        .svc-settings-tab-key {
          font-family: 'Menlo', 'Consolas', monospace;
          font-size: 0.8rem;
          color: var(--bodhion-accent);
        }
        .svc-settings-remove-btn {
          background: none;
          border: none;
          color: var(--bodhion-text-secondary);
          cursor: pointer;
          display: flex;
          align-items: center;
          padding: 0.2rem;
          border-radius: 0.4rem;
          transition: color 0.15s, background 0.15s;
        }
        .svc-settings-remove-btn:hover {
          color: #f87171;
          background: rgba(248,113,113,0.1);
        }

        .svc-settings-editor-wrap { padding: 0.75rem; }
        .svc-settings-editor {
          width: 100%;
          padding: 0.6rem 0.75rem;
          border-radius: 0.75rem;
          border: 1px solid var(--bodhion-search-border);
          background: var(--bodhion-search-bg);
          color: var(--bodhion-text-primary);
          font-size: 0.78rem;
          font-family: 'Menlo', 'Consolas', monospace;
          resize: vertical;
          outline: none;
          transition: border-color 0.15s;
        }
        .svc-settings-editor:focus {
          border-color: var(--bodhion-accent);
          box-shadow: 0 0 0 2px rgba(37,215,255,0.12);
        }
        .svc-settings-editor--error {
          border-color: #f87171 !important;
        }
        .svc-settings-error {
          font-size: 0.72rem;
          color: #f87171;
          margin: 0.25rem 0 0;
        }

        /* Add row */
        .svc-settings-add-row {
          display: flex;
          gap: 0.5rem;
          align-items: center;
        }
        .svc-settings-add-input {
          flex: 1;
          padding: 0.45rem 0.75rem;
          border-radius: 0.75rem;
          border: 1px solid var(--bodhion-search-border);
          background: var(--bodhion-search-bg);
          color: var(--bodhion-text-primary);
          font-size: 0.84rem;
          outline: none;
          transition: border-color 0.15s;
        }
        .svc-settings-add-input:focus {
          border-color: var(--bodhion-accent);
          box-shadow: 0 0 0 2px rgba(37,215,255,0.12);
        }
        .svc-settings-add-input::placeholder {
          color: var(--bodhion-text-secondary);
          opacity: 0.55;
        }
        .svc-settings-add-btn {
          display: inline-flex;
          align-items: center;
          gap: 0.3rem;
          padding: 0.45rem 0.9rem;
          border-radius: 0.75rem;
          border: 1px solid var(--bodhion-shell-border-strong);
          background: rgba(37,215,255,0.08);
          color: var(--bodhion-accent);
          font-size: 0.8rem;
          font-weight: 600;
          cursor: pointer;
          white-space: nowrap;
          transition: background 0.15s;
        }
        .svc-settings-add-btn:hover {
          background: rgba(37,215,255,0.15);
        }
      `}</style>
    </div>
  );
}
