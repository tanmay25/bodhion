'use client';

import { useEffect, useState } from 'react';
import { Eye, EyeOff, Link2, Link2Off, Loader2, RefreshCw } from 'lucide-react';
import { getToken } from '@/lib/auth/session';
import {
  getUserAccessibleTools,
  getMcpCredentialStatus,
  saveMcpCredential,
  deleteMcpCredential,
  type McpCredentialStatus,
} from '@/lib/api/tools';

interface McpEntry {
  server_id:   string;
  name:        string;
  description: string;
  auth_type:   string;
  credential?: McpCredentialStatus | null;
}

// ── Single server row ─────────────────────────────────────────────────────────

function ServerCard({ entry, onRefresh }: { entry: McpEntry; onRefresh: () => void }) {
  const [showForm, setShowForm]     = useState(false);
  const [apiKey,   setApiKey]       = useState('');
  const [showKey,  setShowKey]      = useState(false);
  const [saving,   setSaving]       = useState(false);
  const [removing, setRemoving]     = useState(false);
  const [error,    setError]        = useState<string | null>(null);

  const connected = entry.credential?.connected ?? false;
  const needsKey  = entry.auth_type === 'bearer';

  const handleConnect = async () => {
    if (needsKey) { setShowForm(true); return; }
    // auth_type === 'none' — just upsert with no key
    setSaving(true);
    setError(null);
    try {
      const token = await getToken();
      await saveMcpCredential(token ?? '', entry.server_id, '');
      onRefresh();
    } catch (e) {
      setError('Failed to connect.');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveKey = async () => {
    if (!apiKey.trim()) { setError('API key is required.'); return; }
    setSaving(true);
    setError(null);
    try {
      const token = await getToken();
      await saveMcpCredential(token ?? '', entry.server_id, apiKey.trim());
      setShowForm(false);
      setApiKey('');
      onRefresh();
    } catch (e) {
      setError('Failed to save credential.');
    } finally {
      setSaving(false);
    }
  };

  const handleDisconnect = async () => {
    setRemoving(true);
    setError(null);
    try {
      const token = await getToken();
      await deleteMcpCredential(token ?? '', entry.server_id);
      onRefresh();
    } catch (e) {
      setError('Failed to disconnect.');
    } finally {
      setRemoving(false);
    }
  };

  return (
    <div className="cs-card">
      <div className="cs-card-header">
        <div className="cs-card-identity">
          <span className="cs-card-name">{entry.name}</span>
          {entry.description && (
            <span className="cs-card-desc">{entry.description}</span>
          )}
        </div>
        <div className="cs-card-actions">
          <span className={`cs-badge ${connected ? 'cs-badge--ok' : 'cs-badge--off'}`}>
            {connected ? 'Connected' : 'Not connected'}
          </span>
          {connected ? (
            <button
              type="button"
              className="cs-btn cs-btn--danger"
              onClick={handleDisconnect}
              disabled={removing}
            >
              {removing ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Link2Off className="h-3.5 w-3.5" />
              )}
              Disconnect
            </button>
          ) : (
            <button
              type="button"
              className="cs-btn cs-btn--primary"
              onClick={handleConnect}
              disabled={saving}
            >
              {saving ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Link2 className="h-3.5 w-3.5" />
              )}
              Connect
            </button>
          )}
        </div>
      </div>

      {showForm && !connected && (
        <div className="cs-key-form">
          <div className="cs-key-wrap">
            <input
              className="cs-key-input"
              type={showKey ? 'text' : 'password'}
              placeholder="Paste your API key…"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              autoFocus
              onKeyDown={(e) => e.key === 'Enter' && handleSaveKey()}
            />
            <button
              type="button"
              className="cs-eye-btn"
              onClick={() => setShowKey((v) => !v)}
              aria-label="Toggle key visibility"
            >
              {showKey ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
            </button>
          </div>
          <div className="cs-key-actions">
            <button
              type="button"
              className="cs-btn cs-btn--ghost"
              onClick={() => { setShowForm(false); setApiKey(''); setError(null); }}
            >
              Cancel
            </button>
            <button
              type="button"
              className="cs-btn cs-btn--primary"
              onClick={handleSaveKey}
              disabled={saving}
            >
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
              Save key
            </button>
          </div>
        </div>
      )}

      {error && <p className="cs-error">{error}</p>}
    </div>
  );
}

// ── Main tab ──────────────────────────────────────────────────────────────────

export function ConnectedServicesTab() {
  const [entries,  setEntries]  = useState<McpEntry[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [revision, setRevision] = useState(0);

  const refresh = () => setRevision((v) => v + 1);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      try {
        const token = await getToken();
        const tools = await getUserAccessibleTools(token ?? '');

        const mcpTools = (tools ?? []).filter((t) =>
          String(t.id).startsWith('server:mcp:'),
        );

        const built: McpEntry[] = await Promise.all(
          mcpTools.map(async (t) => {
            const rawId   = String(t.id); // "server:mcp:<server_id>"
            const serverId = rawId.replace(/^server:mcp:/, '');
            let credential: McpCredentialStatus | null = null;
            try {
              credential = await getMcpCredentialStatus(token ?? '', serverId);
            } catch {
              credential = null;
            }
            return {
              server_id:   serverId,
              name:        t.name,
              description: t.meta?.description ?? '',
              auth_type:   credential?.auth_type ?? 'bearer',
              credential,
            };
          }),
        );

        if (!cancelled) setEntries(built);
      } catch {
        if (!cancelled) setEntries([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, [revision]);

  return (
    <div className="cs-root">
      <div className="cs-header-row">
        <div>
          <h2 className="cs-section-title">Connected Services</h2>
          <p className="cs-section-desc">
            Manage your personal credentials for MCP tool servers your admin has enabled.
          </p>
        </div>
        <button
          type="button"
          className="cs-btn cs-btn--ghost cs-btn--icon"
          onClick={refresh}
          disabled={loading}
          aria-label="Refresh"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {loading ? (
        <div className="cs-loading">
          <Loader2 className="h-5 w-5 animate-spin" style={{ color: 'var(--bodhion-accent)' }} />
          <span>Loading services…</span>
        </div>
      ) : entries.length === 0 ? (
        <div className="cs-empty">
          No MCP tool servers are available. Ask your admin to enable some in Admin Settings → MCP Servers.
        </div>
      ) : (
        <div className="cs-list">
          {entries.map((e) => (
            <ServerCard key={e.server_id} entry={e} onRefresh={refresh} />
          ))}
        </div>
      )}

      <style>{`
        .cs-root {
          display: flex;
          flex-direction: column;
          gap: 1.25rem;
          padding: 0.25rem 0;
        }
        .cs-header-row {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 1rem;
        }
        .cs-section-title {
          font-size: 1rem;
          font-weight: 700;
          color: var(--bodhion-text-primary, #e8f4fd);
          margin-bottom: 0.2rem;
        }
        .cs-section-desc {
          font-size: 0.82rem;
          color: var(--bodhion-text-secondary, rgba(200,220,240,0.6));
          line-height: 1.5;
        }
        .cs-loading {
          display: flex;
          align-items: center;
          gap: 0.6rem;
          padding: 2rem 0;
          font-size: 0.85rem;
          color: var(--bodhion-text-secondary, rgba(200,220,240,0.6));
        }
        .cs-empty {
          padding: 2rem;
          text-align: center;
          font-size: 0.85rem;
          color: var(--bodhion-text-secondary, rgba(200,220,240,0.6));
          border: 1px dashed rgba(255,255,255,0.1);
          border-radius: 1rem;
        }
        .cs-list {
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
        }

        /* ── Card ── */
        .cs-card {
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
          padding: 1rem 1.15rem;
          border-radius: 1rem;
          border: 1px solid var(--bodhion-card-border, rgba(255,255,255,0.07));
          background: var(--bodhion-card-bg, rgba(8,22,42,0.55));
        }
        .cs-card-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 1rem;
          flex-wrap: wrap;
        }
        .cs-card-identity {
          display: flex;
          flex-direction: column;
          gap: 0.18rem;
          flex: 1;
          min-width: 0;
        }
        .cs-card-name {
          font-size: 0.9rem;
          font-weight: 600;
          color: var(--bodhion-text-primary, #e8f4fd);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .cs-card-desc {
          font-size: 0.78rem;
          color: var(--bodhion-text-secondary, rgba(200,220,240,0.6));
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .cs-card-actions {
          display: flex;
          align-items: center;
          gap: 0.6rem;
          flex-shrink: 0;
        }

        /* ── Badge ── */
        .cs-badge {
          display: inline-flex;
          align-items: center;
          padding: 0.18rem 0.55rem;
          border-radius: 999px;
          font-size: 0.72rem;
          font-weight: 600;
          letter-spacing: 0.03em;
        }
        .cs-badge--ok {
          background: rgba(34,197,94,0.12);
          color: #4ade80;
          border: 1px solid rgba(34,197,94,0.25);
        }
        .cs-badge--off {
          background: rgba(255,255,255,0.05);
          color: rgba(200,220,240,0.5);
          border: 1px solid rgba(255,255,255,0.08);
        }

        /* ── Buttons ── */
        .cs-btn {
          display: inline-flex;
          align-items: center;
          gap: 0.35rem;
          padding: 0.38rem 0.85rem;
          border-radius: 0.65rem;
          font-size: 0.8rem;
          font-weight: 600;
          cursor: pointer;
          border: 1px solid transparent;
          transition: opacity 0.15s;
          white-space: nowrap;
        }
        .cs-btn:disabled { opacity: 0.5; cursor: not-allowed; }
        .cs-btn--primary {
          background: var(--bodhion-accent, #25d7ff);
          color: #001a2c;
          border-color: transparent;
        }
        .cs-btn--primary:hover:not(:disabled) { opacity: 0.88; }
        .cs-btn--danger {
          background: rgba(239,68,68,0.12);
          color: #f87171;
          border-color: rgba(239,68,68,0.25);
        }
        .cs-btn--danger:hover:not(:disabled) { background: rgba(239,68,68,0.2); }
        .cs-btn--ghost {
          background: rgba(255,255,255,0.05);
          color: var(--bodhion-text-secondary, rgba(200,220,240,0.6));
          border-color: rgba(255,255,255,0.08);
        }
        .cs-btn--ghost:hover:not(:disabled) { background: rgba(255,255,255,0.09); }
        .cs-btn--icon { padding: 0.38rem; }

        /* ── Key form ── */
        .cs-key-form {
          display: flex;
          flex-direction: column;
          gap: 0.6rem;
          padding-top: 0.25rem;
        }
        .cs-key-wrap {
          position: relative;
          display: flex;
          align-items: center;
        }
        .cs-key-input {
          width: 100%;
          padding: 0.45rem 2.4rem 0.45rem 0.8rem;
          border-radius: 0.65rem;
          border: 1px solid rgba(255,255,255,0.1);
          background: rgba(0,0,0,0.25);
          color: var(--bodhion-text-primary, #e8f4fd);
          font-size: 0.83rem;
          outline: none;
          font-family: monospace;
        }
        .cs-key-input:focus { border-color: var(--bodhion-accent, #25d7ff); }
        .cs-eye-btn {
          position: absolute;
          right: 0.6rem;
          background: none;
          border: none;
          cursor: pointer;
          color: var(--bodhion-text-secondary, rgba(200,220,240,0.5));
          padding: 0.2rem;
          display: flex;
          align-items: center;
        }
        .cs-key-actions {
          display: flex;
          gap: 0.5rem;
          justify-content: flex-end;
        }
        .cs-error {
          font-size: 0.78rem;
          color: #f87171;
          margin: 0;
        }
      `}</style>
    </div>
  );
}
