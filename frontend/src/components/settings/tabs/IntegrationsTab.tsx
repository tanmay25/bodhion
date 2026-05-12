'use client';

import { useEffect, useRef, useState } from 'react';
import {
  Plus, Trash2, Eye, EyeOff,
  ChevronDown, ChevronUp, ToggleLeft, ToggleRight,
} from 'lucide-react';
import { useWorkspaceStore } from '@/store/workspaceStore';
import { getToken } from '@/lib/auth/session';
import { updateUserSettings } from '@/lib/api/users';
import type { ToolServerConfig, TerminalServerConfig } from '@/types/config';
import { cn } from '@/lib/utils/cn';

// ── Shared: eye-toggle input ──────────────────────────────────────────────────

function SecretInput({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  const [show, setShow] = useState(false);
  return (
    <div className="conn-input-wrap">
      <input
        className="conn-input conn-input--key"
        type={show ? 'text' : 'password'}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder ?? 'API Key'}
      />
      <button
        type="button"
        className="conn-eye-btn"
        onClick={() => setShow((v) => !v)}
        aria-label="Toggle visibility"
      >
        {show ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
      </button>
    </div>
  );
}

// ── Tool-server row ───────────────────────────────────────────────────────────

function ToolServerRow({
  server,
  onChange,
  onDelete,
}: {
  server: ToolServerConfig;
  onChange: (updated: ToolServerConfig) => void;
  onDelete: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const enabled = server.config?.enable ?? true;

  return (
    <div className={cn('intg-row', expanded && 'intg-row--open')}>
      {/* Header */}
      <div className="intg-row-header">
        <input
          className="conn-input intg-url-input"
          type="url"
          value={server.url}
          onChange={(e) => onChange({ ...server, url: e.target.value })}
          placeholder="https://tools.example.com"
        />
        <div className="intg-row-actions">
          <button
            type="button"
            className="conn-icon-btn"
            onClick={() => onChange({ ...server, config: { ...(server.config ?? {}), enable: !enabled } })}
            aria-label={enabled ? 'Disable' : 'Enable'}
          >
            {enabled
              ? <ToggleRight className="h-5 w-5 conn-toggle--on" />
              : <ToggleLeft  className="h-5 w-5 conn-toggle--off" />}
          </button>
          <button
            type="button"
            className="conn-icon-btn"
            onClick={() => setExpanded((v) => !v)}
            aria-label="Expand"
          >
            {expanded
              ? <ChevronUp   className="h-4 w-4" />
              : <ChevronDown className="h-4 w-4" />}
          </button>
          <button
            type="button"
            className="conn-icon-btn conn-icon-btn--danger"
            onClick={onDelete}
            aria-label="Delete"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Expanded config */}
      {expanded && (
        <div className="intg-row-body">
          <div className="intg-field-row">
            <label className="conn-label">Auth type</label>
            <select
              className="intg-select"
              value={server.auth_type ?? 'bearer'}
              onChange={(e) =>
                onChange({ ...server, auth_type: e.target.value as 'bearer' | 'session' })
              }
            >
              <option value="bearer">Bearer token</option>
              <option value="session">Session (cookie)</option>
            </select>
          </div>

          {(server.auth_type ?? 'bearer') === 'bearer' && (
            <div className="intg-field-row">
              <label className="conn-label">API Key</label>
              <SecretInput
                value={server.key ?? ''}
                onChange={(v) => onChange({ ...server, key: v })}
              />
            </div>
          )}

          <div className="intg-field-row">
            <label className="conn-label">Spec path</label>
            <input
              className="conn-input"
              type="text"
              value={server.path ?? '/openapi.json'}
              onChange={(e) => onChange({ ...server, path: e.target.value })}
              placeholder="/openapi.json"
            />
          </div>
        </div>
      )}
    </div>
  );
}

// ── Terminal-server row ───────────────────────────────────────────────────────

function TerminalRow({
  server,
  onChange,
  onDelete,
}: {
  server: TerminalServerConfig;
  onChange: (updated: TerminalServerConfig) => void;
  onDelete: () => void;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className={cn('intg-row', expanded && 'intg-row--open')}>
      <div className="intg-row-header">
        <input
          className="conn-input intg-url-input"
          type="url"
          value={server.url}
          onChange={(e) => onChange({ ...server, url: e.target.value })}
          placeholder="https://terminal.example.com"
        />
        <div className="intg-row-actions">
          <button
            type="button"
            className="conn-icon-btn"
            onClick={() => onChange({ ...server, enabled: !server.enabled })}
            aria-label={server.enabled ? 'Disable' : 'Enable'}
          >
            {server.enabled
              ? <ToggleRight className="h-5 w-5 conn-toggle--on" />
              : <ToggleLeft  className="h-5 w-5 conn-toggle--off" />}
          </button>
          <button
            type="button"
            className="conn-icon-btn"
            onClick={() => setExpanded((v) => !v)}
            aria-label="Expand"
          >
            {expanded
              ? <ChevronUp   className="h-4 w-4" />
              : <ChevronDown className="h-4 w-4" />}
          </button>
          <button
            type="button"
            className="conn-icon-btn conn-icon-btn--danger"
            onClick={onDelete}
            aria-label="Delete"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>

      {expanded && (
        <div className="intg-row-body">
          <div className="intg-field-row">
            <label className="conn-label">Display name</label>
            <input
              className="conn-input"
              type="text"
              value={server.name ?? ''}
              onChange={(e) => onChange({ ...server, name: e.target.value })}
              placeholder="My Terminal"
            />
          </div>

          <div className="intg-field-row">
            <label className="conn-label">Auth type</label>
            <select
              className="intg-select"
              value={server.auth_type ?? 'bearer'}
              onChange={(e) =>
                onChange({ ...server, auth_type: e.target.value as 'bearer' | 'session' })
              }
            >
              <option value="bearer">Bearer token</option>
              <option value="session">Session (cookie)</option>
            </select>
          </div>

          {(server.auth_type ?? 'bearer') === 'bearer' && (
            <div className="intg-field-row">
              <label className="conn-label">API Key</label>
              <SecretInput
                value={server.key ?? ''}
                onChange={(v) => onChange({ ...server, key: v })}
              />
            </div>
          )}

          <div className="intg-field-row">
            <label className="conn-label">Spec path</label>
            <input
              className="conn-input"
              type="text"
              value={server.path ?? '/openapi.json'}
              onChange={(e) => onChange({ ...server, path: e.target.value })}
              placeholder="/openapi.json"
            />
          </div>
        </div>
      )}
    </div>
  );
}

// ── Inline add form ───────────────────────────────────────────────────────────

function AddToolForm({ onAdd, onCancel }: {
  onAdd: (s: ToolServerConfig) => void;
  onCancel: () => void;
}) {
  const [url, setUrl]     = useState('');
  const [authType, setAuthType] = useState<'bearer' | 'session'>('bearer');
  const [key, setKey]     = useState('');
  const [path, setPath]   = useState('/openapi.json');

  return (
    <div className="conn-add-form">
      <div className="conn-add-form-title">New tool server</div>

      <div className="conn-field-group">
        <label className="conn-label">URL</label>
        <input
          className="conn-input"
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://tools.example.com"
          autoFocus
        />
      </div>

      <div className="conn-field-group">
        <label className="conn-label">Auth type</label>
        <select
          className="intg-select"
          value={authType}
          onChange={(e) => setAuthType(e.target.value as 'bearer' | 'session')}
        >
          <option value="bearer">Bearer token</option>
          <option value="session">Session (cookie)</option>
        </select>
      </div>

      {authType === 'bearer' && (
        <div className="conn-field-group">
          <label className="conn-label">API Key</label>
          <SecretInput value={key} onChange={setKey} />
        </div>
      )}

      <div className="conn-field-group">
        <label className="conn-label">Spec path</label>
        <input
          className="conn-input"
          type="text"
          value={path}
          onChange={(e) => setPath(e.target.value)}
          placeholder="/openapi.json"
        />
      </div>

      <div className="conn-add-actions">
        <button type="button" className="conn-btn conn-btn--ghost" onClick={onCancel}>Cancel</button>
        <button
          type="button"
          className="conn-btn conn-btn--primary"
          disabled={!url.trim()}
          onClick={() => url.trim() && onAdd({ url: url.trim(), auth_type: authType, key, path, config: { enable: true } })}
        >
          Add
        </button>
      </div>
    </div>
  );
}

function AddTerminalForm({ onAdd, onCancel }: {
  onAdd: (s: TerminalServerConfig) => void;
  onCancel: () => void;
}) {
  const [url, setUrl]     = useState('');
  const [name, setName]   = useState('');
  const [authType, setAuthType] = useState<'bearer' | 'session'>('bearer');
  const [key, setKey]     = useState('');
  const [path, setPath]   = useState('/openapi.json');

  return (
    <div className="conn-add-form">
      <div className="conn-add-form-title">New terminal server</div>

      <div className="conn-field-group">
        <label className="conn-label">URL</label>
        <input
          className="conn-input"
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://terminal.example.com"
          autoFocus
        />
      </div>

      <div className="conn-field-group">
        <label className="conn-label">Display name</label>
        <input
          className="conn-input"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="My Terminal"
        />
      </div>

      <div className="conn-field-group">
        <label className="conn-label">Auth type</label>
        <select
          className="intg-select"
          value={authType}
          onChange={(e) => setAuthType(e.target.value as 'bearer' | 'session')}
        >
          <option value="bearer">Bearer token</option>
          <option value="session">Session (cookie)</option>
        </select>
      </div>

      {authType === 'bearer' && (
        <div className="conn-field-group">
          <label className="conn-label">API Key</label>
          <SecretInput value={key} onChange={setKey} />
        </div>
      )}

      <div className="conn-field-group">
        <label className="conn-label">Spec path</label>
        <input
          className="conn-input"
          type="text"
          value={path}
          onChange={(e) => setPath(e.target.value)}
          placeholder="/openapi.json"
        />
      </div>

      <div className="conn-add-actions">
        <button type="button" className="conn-btn conn-btn--ghost" onClick={onCancel}>Cancel</button>
        <button
          type="button"
          className="conn-btn conn-btn--primary"
          disabled={!url.trim()}
          onClick={() =>
            url.trim() &&
            onAdd({ url: url.trim(), name: name.trim() || undefined, auth_type: authType, key, path, enabled: true })
          }
        >
          Add
        </button>
      </div>
    </div>
  );
}

// ── Main tab ──────────────────────────────────────────────────────────────────

export function IntegrationsTab({ onRegisterSave }: { onRegisterSave: (fn: () => Promise<void>) => void }) {
  const settings      = useWorkspaceStore((s) => s.settings);
  const patchSettings = useWorkspaceStore((s) => s.patchSettings);

  const [toolServers,     setToolServers]     = useState<ToolServerConfig[]>([]);
  const [terminalServers, setTerminalServers] = useState<TerminalServerConfig[]>([]);
  const [showAddTool,     setShowAddTool]     = useState(false);
  const [showAddTerminal, setShowAddTerminal] = useState(false);

  useEffect(() => {
    setToolServers(settings.toolServers    ?? []);
    setTerminalServers(settings.terminalServers ?? []);
  }, [settings.toolServers, settings.terminalServers]);

  const latestRef = useRef({ toolServers, terminalServers, settings });
  latestRef.current = { toolServers, terminalServers, settings };

  useEffect(() => {
    onRegisterSave(async () => {
      const token = getToken();
      if (!token) throw new Error('Not authenticated');
      const { toolServers: ts, terminalServers: trs, settings: s } = latestRef.current;
      await updateUserSettings(token, { ui: { ...s, toolServers: ts, terminalServers: trs } });
      patchSettings({ toolServers: ts, terminalServers: trs });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onRegisterSave]);

  const updateTool = (idx: number, updated: ToolServerConfig) =>
    setToolServers((prev) => prev.map((s, i) => (i === idx ? updated : s)));

  const deleteTool = (idx: number) =>
    setToolServers((prev) => prev.filter((_, i) => i !== idx));

  const addTool = (server: ToolServerConfig) => {
    setToolServers((prev) => [...prev, server]);
    setShowAddTool(false);
  };

  const updateTerminal = (idx: number, updated: TerminalServerConfig) =>
    setTerminalServers((prev) => prev.map((s, i) => (i === idx ? updated : s)));

  const deleteTerminal = (idx: number) =>
    setTerminalServers((prev) => prev.filter((_, i) => i !== idx));

  const addTerminal = (server: TerminalServerConfig) => {
    setTerminalServers((prev) => [...prev, server]);
    setShowAddTerminal(false);
  };

  return (
    <div className="settings-tab-content">

      {/* ── Tool Servers ────────────────────────────────────── */}
      <div className="settings-section">
        <div className="settings-section-title">Tool Servers</div>
        <div className="settings-section-desc">
          Connect to OpenAPI-compatible external tool servers. CORS must be configured by the provider.
        </div>

        <div className="conn-list">
          {toolServers.length === 0 && !showAddTool && (
            <div className="conn-empty">No tool servers configured.</div>
          )}
          {toolServers.map((server, idx) => (
            <ToolServerRow
              key={idx}
              server={server}
              onChange={(u) => updateTool(idx, u)}
              onDelete={() => deleteTool(idx)}
            />
          ))}
          {showAddTool && (
            <AddToolForm onAdd={addTool} onCancel={() => setShowAddTool(false)} />
          )}
        </div>

        {!showAddTool && (
          <button type="button" className="conn-add-btn" onClick={() => setShowAddTool(true)}>
            <Plus className="h-4 w-4" />
            Add tool server
          </button>
        )}
      </div>

      <div className="intg-divider" />

      {/* ── Terminal Servers ────────────────────────────────── */}
      <div className="settings-section">
        <div className="intg-section-heading">
          <div className="settings-section-title">Terminal Servers</div>
          <span className="intg-badge">Experimental</span>
        </div>
        <div className="settings-section-desc">
          Connect to Open Terminal instances to browse files and use them as always-on tools. Only one can be active at a time.
        </div>

        <div className="conn-list">
          {terminalServers.length === 0 && !showAddTerminal && (
            <div className="conn-empty">No terminal servers configured.</div>
          )}
          {terminalServers.map((server, idx) => (
            <TerminalRow
              key={idx}
              server={server}
              onChange={(u) => updateTerminal(idx, u)}
              onDelete={() => deleteTerminal(idx)}
            />
          ))}
          {showAddTerminal && (
            <AddTerminalForm onAdd={addTerminal} onCancel={() => setShowAddTerminal(false)} />
          )}
        </div>

        {!showAddTerminal && (
          <button type="button" className="conn-add-btn" onClick={() => setShowAddTerminal(true)}>
            <Plus className="h-4 w-4" />
            Add terminal server
          </button>
        )}
      </div>

    </div>
  );
}
