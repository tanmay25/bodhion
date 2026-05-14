'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Plus, Trash2, Eye, EyeOff, ToggleLeft, ToggleRight,
  ChevronDown, ChevronUp, RefreshCw, Wifi, WifiOff, ShieldAlert,
  Server, Check, Pencil, X, AlertTriangle,
} from 'lucide-react';
import { toast } from 'sonner';
import { getToken } from '@/lib/auth/session';
import {
  getToolServersConfig,
  setToolServersConfig,
  getMcpServerHealth,
  getMcpHealthHistory,
  getMcpAlerts,
  validateMcpServer,
  type McpHealthRecord,
  type McpHealthHistoryResult,
  type McpAlert,
} from '@/lib/api/admin/settings';
import type {
  MCPServerConnection,
  MCPAuthType,
  MCPCategory,
  MCPHealthResult,
  MCPToolSpec,
} from '@/types/config';
import { cn } from '@/lib/utils/cn';

// ── Constants ────────────────────────────────────────────────────────────────

const CATEGORIES: MCPCategory[] = [
  'Email', 'Calendar', 'Dev Tools', 'Productivity',
  'Database', 'File System', 'Search', 'Custom',
];

function slugify(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function makeEmptyServer(): MCPServerConnection {
  return {
    url: '',
    type: 'mcp',
    server_protocol: 'mcp',
    auth_type: 'none',
    key: '',
    info: { id: '', name: '', description: '', category: 'Custom' },
    config: { enable: true, access_grants: [], function_name_filter_list: '' },
  };
}

// ── Status badge ─────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: MCPHealthResult['status'] | 'checking' | 'unknown' }) {
  if (status === 'checking') {
    return (
      <span className="mcp-badge mcp-badge--checking">
        <RefreshCw className="h-3 w-3 animate-spin" />
        Checking
      </span>
    );
  }
  if (status === 'ok') {
    return (
      <span className="mcp-badge mcp-badge--ok">
        <Wifi className="h-3 w-3" />
        Online
      </span>
    );
  }
  if (status === 'auth_error') {
    return (
      <span className="mcp-badge mcp-badge--auth">
        <ShieldAlert className="h-3 w-3" />
        Auth Error
      </span>
    );
  }
  if (status === 'unreachable') {
    return (
      <span className="mcp-badge mcp-badge--off">
        <WifiOff className="h-3 w-3" />
        Offline
      </span>
    );
  }
  return <span className="mcp-badge mcp-badge--unknown">—</span>;
}

// ── Health sparkline ──────────────────────────────────────────────────────────

function Sparkline({ data }: { data: McpHealthHistoryResult }) {
  const now = Math.floor(Date.now() / 1000);
  const buckets: Array<'ok' | 'error' | 'none'> = [];
  for (let i = 23; i >= 0; i--) {
    const bucketStart = now - (i + 1) * 3600;
    const bucketEnd   = now - i * 3600;
    const inBucket = data.records.filter(
      (r: McpHealthRecord) => r.timestamp >= bucketStart && r.timestamp < bucketEnd,
    );
    if (inBucket.length === 0) {
      buckets.push('none');
    } else {
      buckets.push(inBucket.some((r: McpHealthRecord) => r.status !== 'ok') ? 'error' : 'ok');
    }
  }
  const uptime = data.uptime_7d_pct != null ? `${data.uptime_7d_pct.toFixed(1)}%` : '—';
  return (
    <div className="mcp-sparkline" title={`7-day uptime: ${uptime}`}>
      <div className="mcp-sparkline-dots">
        {buckets.map((b, i) => (
          <span key={i} className={`mcp-dot mcp-dot--${b}`} />
        ))}
      </div>
      <span className="mcp-sparkline-uptime">{uptime}</span>
    </div>
  );
}

// ── Down-server alert banner ───────────────────────────────────────────────────

function AlertBanner({ alerts }: { alerts: McpAlert[] }) {
  if (alerts.length === 0) return null;
  return (
    <div className="mcp-alert-banner">
      <AlertTriangle className="h-4 w-4 mcp-alert-icon" />
      <span className="mcp-alert-text">
        {alerts.length === 1
          ? `${alerts[0].server_name || alerts[0].server_id} is down`
          : `${alerts.length} MCP servers are down`}
      </span>
      <div className="mcp-alert-list">
        {alerts.map((a) => (
          <span key={a.server_id} className="mcp-alert-chip">
            {a.server_name || a.server_id}
          </span>
        ))}
      </div>
    </div>
  );
}

// ── Tool preview panel ────────────────────────────────────────────────────────

function ToolPreviewPanel({
  tools,
  filterList,
  onFilterChange,
}: {
  tools: MCPToolSpec[];
  filterList: string;
  onFilterChange: (v: string) => void;
}) {
  const allowed = filterList
    ? filterList.split(',').map((s) => s.trim()).filter(Boolean)
    : [];

  const isEnabled = (name: string) =>
    allowed.length === 0 || allowed.includes(name);

  const toggle = (name: string) => {
    const current = allowed.length ? new Set(allowed) : new Set(tools.map((t) => t.name));
    if (current.has(name)) current.delete(name);
    else current.add(name);
    onFilterChange([...current].join(','));
  };

  if (tools.length === 0) {
    return (
      <div className="mcp-tools-empty">
        No tools discovered. Save the server and click "Refresh" to fetch tools.
      </div>
    );
  }

  return (
    <div className="mcp-tools-list">
      {tools.map((tool) => {
        const on = isEnabled(tool.name);
        return (
          <div key={tool.name} className={cn('mcp-tool-row', !on && 'mcp-tool-row--off')}>
            <div className="mcp-tool-info">
              <span className="mcp-tool-name">{tool.name}</span>
              {tool.description && (
                <span className="mcp-tool-desc">{tool.description}</span>
              )}
            </div>
            <button
              type="button"
              className="conn-icon-btn"
              onClick={() => toggle(tool.name)}
              aria-label={on ? 'Disable tool' : 'Enable tool'}
            >
              {on
                ? <ToggleRight className="h-5 w-5 conn-toggle--on" />
                : <ToggleLeft  className="h-5 w-5 conn-toggle--off" />}
            </button>
          </div>
        );
      })}
    </div>
  );
}

// ── Add / Edit form ───────────────────────────────────────────────────────────

function ServerForm({
  initial,
  onSave,
  onCancel,
  isEditing,
}: {
  initial: MCPServerConnection;
  onSave: (s: MCPServerConnection) => void;
  onCancel: () => void;
  isEditing: boolean;
}) {
  const [draft, setDraft] = useState<MCPServerConnection>(initial);
  const [showKey, setShowKey] = useState(false);
  const nameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    nameRef.current?.focus();
  }, []);

  const patch = (partial: Partial<MCPServerConnection>) =>
    setDraft((d) => ({ ...d, ...partial }));

  const patchInfo = (partial: Partial<MCPServerConnection['info']>) =>
    setDraft((d) => ({ ...d, info: { ...d.info, ...partial } }));

  const patchConfig = (partial: Partial<MCPServerConnection['config']>) =>
    setDraft((d) => ({ ...d, config: { ...d.config, ...partial } }));

  const handleNameChange = (name: string) => {
    patchInfo({ name });
    if (!isEditing) {
      patchInfo({ id: slugify(name) });
    }
  };

  const valid = draft.url.trim() && draft.info.name.trim() && draft.info.id.trim();

  const [validating, setValidating] = useState(false);
  const [validateResult, setValidateResult] = useState<{ok: boolean; tool_count: number; latency_ms: number; error?: string} | null>(null);

  const runValidate = async () => {
    const url = draft.url.trim();
    if (!url) return;
    const token = getToken();
    if (!token) return;
    setValidating(true);
    setValidateResult(null);
    try {
      const res = await validateMcpServer(token, url, draft.auth_type ?? 'none', draft.key ?? '');
      setValidateResult(res);
    } catch {
      setValidateResult({ ok: false, tool_count: 0, latency_ms: 0, error: 'Request failed' });
    } finally {
      setValidating(false);
    }
  };

  return (
    <div className="mcp-form">
      <div className="mcp-form-title">{isEditing ? 'Edit MCP Server' : 'Add MCP Server'}</div>

      <div className="mcp-form-grid">
        <div className="conn-field-group">
          <label className="conn-label">Server name <span className="mcp-required">*</span></label>
          <input
            ref={nameRef}
            className="conn-input"
            type="text"
            value={draft.info.name}
            onChange={(e) => handleNameChange(e.target.value)}
            placeholder="Gmail MCP"
          />
        </div>

        <div className="conn-field-group">
          <label className="conn-label">Server ID <span className="mcp-required">*</span></label>
          <input
            className="conn-input"
            type="text"
            value={draft.info.id}
            onChange={(e) => patchInfo({ id: e.target.value.replace(/\s/g, '-').toLowerCase() })}
            placeholder="gmail-mcp"
          />
        </div>

        <div className="conn-field-group mcp-form-wide">
          <label className="conn-label">URL <span className="mcp-required">*</span></label>
          <input
            className="conn-input"
            type="url"
            value={draft.url}
            onChange={(e) => patch({ url: e.target.value })}
            placeholder="https://mcp.example.com"
          />
        </div>

        <div className="conn-field-group">
          <label className="conn-label">Category</label>
          <select
            className="intg-select"
            value={draft.info.category ?? 'Custom'}
            onChange={(e) => patchInfo({ category: e.target.value as MCPCategory })}
          >
            {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>

        <div className="conn-field-group">
          <label className="conn-label">Auth type</label>
          <select
            className="intg-select"
            value={draft.auth_type ?? 'none'}
            onChange={(e) => patch({ auth_type: e.target.value as MCPAuthType })}
          >
            <option value="none">None</option>
            <option value="bearer">Bearer token</option>
            <option value="oauth_2.1">OAuth 2.1</option>
          </select>
        </div>

        {draft.auth_type === 'bearer' && (
          <div className="conn-field-group mcp-form-wide">
            <label className="conn-label">API Key</label>
            <div className="conn-input-wrap">
              <input
                className="conn-input conn-input--key"
                type={showKey ? 'text' : 'password'}
                value={draft.key ?? ''}
                onChange={(e) => patch({ key: e.target.value })}
                placeholder="sk-..."
              />
              <button
                type="button"
                className="conn-eye-btn"
                onClick={() => setShowKey((v) => !v)}
                aria-label="Toggle visibility"
              >
                {showKey ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
              </button>
            </div>
          </div>
        )}

        <div className="conn-field-group mcp-form-wide">
          <label className="conn-label">Description</label>
          <input
            className="conn-input"
            type="text"
            value={draft.info.description ?? ''}
            onChange={(e) => patchInfo({ description: e.target.value })}
            placeholder="Short description of what this server provides"
          />
        </div>

        <div className="conn-field-group mcp-form-wide">
          <label className="conn-label">
            Function filter
            <span className="mcp-field-hint"> — comma-separated allowlist; empty = all tools enabled</span>
          </label>
          <input
            className="conn-input"
            type="text"
            value={draft.config.function_name_filter_list ?? ''}
            onChange={(e) => patchConfig({ function_name_filter_list: e.target.value })}
            placeholder="send_email,list_emails"
          />
        </div>

        <div className="conn-field-group">
          <label className="conn-label">
            Rate limit
            <span className="mcp-field-hint"> calls/min</span>
          </label>
          <input
            className="conn-input"
            type="number"
            min={0}
            value={draft.config.rate_limit?.calls_per_minute ?? ''}
            onChange={(e) => {
              const v = e.target.value ? parseInt(e.target.value, 10) : undefined;
              patchConfig({ rate_limit: { ...draft.config.rate_limit, calls_per_minute: v } });
            }}
            placeholder="0 = unlimited"
          />
        </div>

        <div className="conn-field-group">
          <label className="conn-label">
            Rate limit
            <span className="mcp-field-hint"> calls/day</span>
          </label>
          <input
            className="conn-input"
            type="number"
            min={0}
            value={draft.config.rate_limit?.calls_per_day ?? ''}
            onChange={(e) => {
              const v = e.target.value ? parseInt(e.target.value, 10) : undefined;
              patchConfig({ rate_limit: { ...draft.config.rate_limit, calls_per_day: v } });
            }}
            placeholder="0 = unlimited"
          />
        </div>
      </div>

      <div className="conn-add-actions">
        {/* ── Validate button + inline result ── */}
        <button
          type="button"
          className="conn-btn conn-btn--ghost"
          disabled={!draft.url.trim() || validating}
          onClick={runValidate}
          title="Test connectivity and tool discovery against this URL"
        >
          {validating
            ? <RefreshCw className="h-3.5 w-3.5 animate-spin" />
            : <Wifi className="h-3.5 w-3.5" />}
          {validating ? 'Validating…' : 'Validate'}
        </button>

        {validateResult && (
          <span className={`mcp-validate-chip ${validateResult.ok ? 'mcp-validate-chip--ok' : 'mcp-validate-chip--fail'}`}>
            {validateResult.ok
              ? `✓ ${validateResult.tool_count} tool${validateResult.tool_count !== 1 ? 's' : ''} · ${validateResult.latency_ms} ms`
              : `✗ ${validateResult.error ?? 'Unreachable'}`}
          </span>
        )}

        <div className="mcp-form-actions-right">
          <button type="button" className="conn-btn conn-btn--ghost" onClick={onCancel}>
            Cancel
          </button>
          <button
            type="button"
            className="conn-btn conn-btn--primary"
            disabled={!valid}
            onClick={() => valid && onSave(draft)}
          >
            {isEditing ? 'Save changes' : 'Add server'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Server row ────────────────────────────────────────────────────────────────

function ServerRow({
  server,
  health,
  tools,
  loadingHealth,
  sparkline,
  onToggleEnable,
  onEdit,
  onDelete,
  onRefresh,
  onTestHealth,
  onFilterChange,
}: {
  server: MCPServerConnection;
  health: MCPHealthResult | null;
  tools: MCPToolSpec[];
  loadingHealth: boolean;
  sparkline?: McpHealthHistoryResult;
  onToggleEnable: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onRefresh: () => void;
  onTestHealth: () => void;
  onFilterChange: (v: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const enabled = server.config.enable;
  const statusKey = loadingHealth
    ? 'checking'
    : health?.status ?? 'unknown';

  return (
    <div className={cn('mcp-row', expanded && 'mcp-row--open', !enabled && 'mcp-row--disabled')}>
      {/* ── Header ── */}
      <div className="mcp-row-header">
        <div className="mcp-row-identity">
          <Server className="h-4 w-4 mcp-server-icon" />
          <div>
            <div className="mcp-row-name">{server.info.name || '(unnamed)'}</div>
            <div className="mcp-row-url">{server.url}</div>
          </div>
        </div>

        <div className="mcp-row-meta">
          {server.info.category && (
            <span className="mcp-category-chip">{server.info.category}</span>
          )}
          <StatusBadge status={statusKey} />
          {health && (
            <span className="mcp-tool-count">{health.tool_count} tool{health.tool_count !== 1 ? 's' : ''}</span>
          )}
          {sparkline && <Sparkline data={sparkline} />}
        </div>

        <div className="intg-row-actions">
          <button
            type="button"
            className="conn-icon-btn"
            title={enabled ? 'Disable' : 'Enable'}
            onClick={onToggleEnable}
          >
            {enabled
              ? <ToggleRight className="h-5 w-5 conn-toggle--on" />
              : <ToggleLeft  className="h-5 w-5 conn-toggle--off" />}
          </button>
          <button
            type="button"
            className="conn-icon-btn"
            title="Test connection"
            onClick={onTestHealth}
          >
            <Wifi className="h-4 w-4" />
          </button>
          <button
            type="button"
            className="conn-icon-btn"
            title="Refresh tools"
            onClick={onRefresh}
          >
            <RefreshCw className={cn('h-4 w-4', loadingHealth && 'animate-spin')} />
          </button>
          <button
            type="button"
            className="conn-icon-btn"
            title="Edit"
            onClick={onEdit}
          >
            <Pencil className="h-4 w-4" />
          </button>
          <button
            type="button"
            className="conn-icon-btn"
            title="Expand tools"
            onClick={() => setExpanded((v) => !v)}
          >
            {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
          <button
            type="button"
            className="conn-icon-btn conn-icon-btn--danger"
            title="Delete"
            onClick={onDelete}
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* ── Tool preview ── */}
      {expanded && (
        <div className="mcp-row-tools">
          <div className="mcp-tools-header">
            <span className="mcp-tools-label">Discovered tools</span>
            {server.info.description && (
              <span className="mcp-server-desc">{server.info.description}</span>
            )}
          </div>
          <ToolPreviewPanel
            tools={tools}
            filterList={server.config.function_name_filter_list ?? ''}
            onFilterChange={onFilterChange}
          />
        </div>
      )}
    </div>
  );
}

// ── Main tab ──────────────────────────────────────────────────────────────────

export function MCPServersTab() {
  const [servers, setServers] = useState<MCPServerConnection[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving,  setSaving]  = useState(false);
  const [dirty,   setDirty]   = useState(false);

  const [editingIdx, setEditingIdx]   = useState<number | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);

  const [healthMap, setHealthMap]     = useState<Record<string, MCPHealthResult>>({});
  const [loadingHealth, setLoadingHealth] = useState<Record<string, boolean>>({});
  const [toolsMap, setToolsMap]       = useState<Record<string, MCPToolSpec[]>>({});
  const [sparklineMap, setSparklineMap] = useState<Record<string, McpHealthHistoryResult>>({});
  const [alerts, setAlerts]           = useState<McpAlert[]>([]);

  // ── Load ──
  useEffect(() => {
    const token = getToken();
    if (!token) return;
    getToolServersConfig(token)
      .then((res) => {
        const mcpOnly = (res.TOOL_SERVER_CONNECTIONS ?? []).filter(
          (c) => (c as MCPServerConnection).type === 'mcp' || (c as MCPServerConnection).server_protocol === 'mcp',
        ) as MCPServerConnection[];
        setServers(mcpOnly);
      })
      .catch(() => toast.error('Failed to load MCP server config'))
      .finally(() => setLoading(false));
  }, []);

  // ── Sparkline loader (runs when server list changes) ──
  useEffect(() => {
    if (servers.length === 0) return;
    const token = getToken();
    if (!token) return;
    servers.forEach((server) => {
      if (!server.info.id) return;
      getMcpHealthHistory(token, server.info.id)
        .then((data) => setSparklineMap((m) => ({ ...m, [server.info.id]: data })))
        .catch(() => {});
    });
  }, [servers]);

  // ── Alert poller (every 30 s) ──
  useEffect(() => {
    const fetchAlerts = async () => {
      const token = getToken();
      if (!token) return;
      try {
        const res = await getMcpAlerts(token);
        setAlerts(res.alerts ?? []);
      } catch {
        // silently ignore polling errors
      }
    };
    fetchAlerts();
    const interval = setInterval(fetchAlerts, 30_000);
    return () => clearInterval(interval);
  }, []);

  // ── Helpers ──
  const markDirty = () => setDirty(true);

  const save = useCallback(async (nextServers: MCPServerConnection[]) => {
    const token = getToken();
    if (!token) return;
    setSaving(true);
    try {
      await setToolServersConfig(token, nextServers);
      setDirty(false);
      toast.success('MCP server config saved');
    } catch {
      toast.error('Failed to save MCP server config');
    } finally {
      setSaving(false);
    }
  }, []);

  const checkHealth = useCallback(async (server: MCPServerConnection) => {
    const token = getToken();
    if (!token || !server.info.id) return;
    setLoadingHealth((m) => ({ ...m, [server.info.id]: true }));
    try {
      const result = await getMcpServerHealth(token, server.info.id);
      setHealthMap((m) => ({ ...m, [server.info.id]: result }));
      if (result.specs?.length) {
        setToolsMap((m) => ({ ...m, [server.info.id]: result.specs! }));
      }
    } catch {
      setHealthMap((m) => ({
        ...m,
        [server.info.id]: {
          server_id: server.info.id,
          status: 'unreachable',
          latency_ms: 0,
          tool_count: 0,
          checked_at: Date.now() / 1000,
        },
      }));
    } finally {
      setLoadingHealth((m) => ({ ...m, [server.info.id]: false }));
    }
  }, []);

  const refreshTools = useCallback(async (server: MCPServerConnection) => {
    const token = getToken();
    if (!token || !server.info.id) return;
    setLoadingHealth((m) => ({ ...m, [server.info.id]: true }));
    try {
      const result = await getMcpServerHealth(token, server.info.id);
      setHealthMap((m) => ({ ...m, [server.info.id]: result }));
      if (result.specs?.length) {
        setToolsMap((m) => ({ ...m, [server.info.id]: result.specs! }));
      }
      toast.success(`Refreshed ${result.tool_count} tool${result.tool_count !== 1 ? 's' : ''} from ${server.info.name}`);
    } catch {
      toast.error(`Could not reach ${server.info.name}`);
    } finally {
      setLoadingHealth((m) => ({ ...m, [server.info.id]: false }));
    }
  }, []);

  // ── CRUD ──
  const addServer = (s: MCPServerConnection) => {
    const next = [...servers, s];
    setServers(next);
    setShowAddForm(false);
    markDirty();
    save(next);
  };

  const updateServer = (idx: number, s: MCPServerConnection) => {
    const next = servers.map((sv, i) => (i === idx ? s : sv));
    setServers(next);
    setEditingIdx(null);
    markDirty();
    save(next);
  };

  const toggleEnable = (idx: number) => {
    const next = servers.map((sv, i) =>
      i === idx ? { ...sv, config: { ...sv.config, enable: !sv.config.enable } } : sv,
    );
    setServers(next);
    markDirty();
    save(next);
  };

  const deleteServer = (idx: number) => {
    const next = servers.filter((_, i) => i !== idx);
    setServers(next);
    markDirty();
    save(next);
  };

  const patchFilter = (idx: number, filterList: string) => {
    const next = servers.map((sv, i) =>
      i === idx
        ? { ...sv, config: { ...sv.config, function_name_filter_list: filterList } }
        : sv,
    );
    setServers(next);
    markDirty();
  };

  // ── Bulk actions ──
  const setAllEnabled = (enabled: boolean) => {
    const next = servers.map((sv) => ({ ...sv, config: { ...sv.config, enable: enabled } }));
    setServers(next);
    markDirty();
    save(next);
  };

  if (loading) {
    return (
      <div className="flex flex-col gap-4 pt-2">
        {[1, 2].map((i) => (
          <div key={i} className="h-16 w-full animate-pulse rounded-[1.1rem]"
            style={{ background: 'var(--bodhion-card-bg)', border: '1px solid var(--bodhion-card-border)' }} />
        ))}
      </div>
    );
  }

  return (
    <div className="settings-tab-content">

      {/* ── Header ── */}
      <div className="settings-section">
        <div className="mcp-tab-header">
          <div>
            <div className="settings-section-title">MCP Servers</div>
            <div className="settings-section-desc">
              Connect to Model Context Protocol servers to give the AI access to external skills — email, calendar, GitHub, databases, and more.
            </div>
          </div>
          <div className="mcp-bulk-actions">
            <button
              type="button"
              className="conn-btn conn-btn--ghost conn-btn--sm"
              onClick={() => setAllEnabled(true)}
              disabled={saving}
            >
              <Check className="h-3.5 w-3.5" />
              Enable all
            </button>
            <button
              type="button"
              className="conn-btn conn-btn--ghost conn-btn--sm"
              onClick={() => setAllEnabled(false)}
              disabled={saving}
            >
              <X className="h-3.5 w-3.5" />
              Disable all
            </button>
          </div>
        </div>

        {/* ── Server list ── */}
        <div className="conn-list">
          {alerts.length > 0 && <AlertBanner alerts={alerts} />}

          {servers.length === 0 && !showAddForm && (
            <div className="conn-empty">
              No MCP servers configured. Add one below to get started.
            </div>
          )}

          {servers.map((server, idx) => {
            if (editingIdx === idx) {
              return (
                <ServerForm
                  key={server.info.id || idx}
                  initial={server}
                  isEditing
                  onSave={(s) => updateServer(idx, s)}
                  onCancel={() => setEditingIdx(null)}
                />
              );
            }
            return (
              <ServerRow
                key={server.info.id || idx}
                server={server}
                health={healthMap[server.info.id] ?? null}
                tools={toolsMap[server.info.id] ?? []}
                loadingHealth={loadingHealth[server.info.id] ?? false}
                sparkline={sparklineMap[server.info.id]}
                onToggleEnable={() => toggleEnable(idx)}
                onEdit={() => setEditingIdx(idx)}
                onDelete={() => deleteServer(idx)}
                onRefresh={() => refreshTools(server)}
                onTestHealth={() => checkHealth(server)}
                onFilterChange={(v) => patchFilter(idx, v)}
              />
            );
          })}

          {showAddForm && (
            <ServerForm
              initial={makeEmptyServer()}
              isEditing={false}
              onSave={addServer}
              onCancel={() => setShowAddForm(false)}
            />
          )}
        </div>

        {!showAddForm && editingIdx === null && (
          <button
            type="button"
            className="conn-add-btn"
            onClick={() => setShowAddForm(true)}
          >
            <Plus className="h-4 w-4" />
            Add MCP server
          </button>
        )}

        {dirty && !saving && (
          <p className="mcp-unsaved-hint">You have unsaved changes.</p>
        )}
      </div>

      <style>{`
        /* ── MCP tab header ── */
        .mcp-tab-header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 1rem;
          flex-wrap: wrap;
          margin-bottom: 1rem;
        }
        .mcp-bulk-actions {
          display: flex;
          gap: 0.5rem;
          flex-shrink: 0;
        }

        /* ── Status badges ── */
        .mcp-badge {
          display: inline-flex;
          align-items: center;
          gap: 0.3rem;
          padding: 0.2rem 0.55rem;
          border-radius: 999px;
          font-size: 0.72rem;
          font-weight: 600;
          white-space: nowrap;
        }
        .mcp-badge--ok       { background: rgba(34,197,94,0.15);  color: #4ade80; border: 1px solid rgba(34,197,94,0.3); }
        .mcp-badge--auth     { background: rgba(245,158,11,0.15); color: #fbbf24; border: 1px solid rgba(245,158,11,0.3); }
        .mcp-badge--off      { background: rgba(239,68,68,0.12);  color: #f87171; border: 1px solid rgba(239,68,68,0.25); }
        .mcp-badge--checking { background: rgba(99,102,241,0.12); color: #818cf8; border: 1px solid rgba(99,102,241,0.25); }
        .mcp-badge--unknown  { background: rgba(255,255,255,0.06); color: var(--bodhion-text-secondary); border: 1px solid rgba(255,255,255,0.1); }

        /* ── Server row ── */
        .mcp-row {
          border: 1px solid var(--bodhion-card-border);
          border-radius: 1rem;
          background: var(--bodhion-card-bg);
          overflow: hidden;
          transition: border-color 0.15s;
        }
        .mcp-row:hover { border-color: var(--bodhion-shell-border-strong); }
        .mcp-row--disabled { opacity: 0.55; }
        .mcp-row--open { border-color: var(--bodhion-shell-border-strong); }
        .mcp-row + .mcp-row { margin-top: 0.5rem; }

        .mcp-row-header {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          padding: 0.7rem 0.85rem;
          flex-wrap: wrap;
        }
        .mcp-row-identity {
          display: flex;
          align-items: center;
          gap: 0.6rem;
          flex: 1;
          min-width: 0;
        }
        .mcp-server-icon { color: var(--bodhion-accent); flex-shrink: 0; }
        .mcp-row-name {
          font-weight: 600;
          font-size: 0.88rem;
          color: var(--bodhion-text-primary);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .mcp-row-url {
          font-size: 0.75rem;
          color: var(--bodhion-text-secondary);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          max-width: 28ch;
        }
        .mcp-row-meta {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          flex-wrap: wrap;
        }
        .mcp-category-chip {
          font-size: 0.7rem;
          font-weight: 600;
          padding: 0.15rem 0.5rem;
          border-radius: 999px;
          background: rgba(37,215,255,0.1);
          color: rgba(37,215,255,0.9);
          border: 1px solid rgba(37,215,255,0.2);
        }
        .mcp-tool-count {
          font-size: 0.74rem;
          color: var(--bodhion-text-secondary);
        }

        /* ── Tool preview ── */
        .mcp-row-tools {
          border-top: 1px solid var(--bodhion-card-border);
          padding: 0.75rem 0.85rem;
        }
        .mcp-tools-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 0.5rem;
          margin-bottom: 0.6rem;
        }
        .mcp-tools-label {
          font-size: 0.78rem;
          font-weight: 700;
          color: var(--bodhion-text-secondary);
          text-transform: uppercase;
          letter-spacing: 0.06em;
        }
        .mcp-server-desc {
          font-size: 0.76rem;
          color: var(--bodhion-text-secondary);
          font-style: italic;
        }
        .mcp-tools-list { display: flex; flex-direction: column; gap: 0.3rem; }
        .mcp-tool-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 0.5rem;
          padding: 0.4rem 0.5rem;
          border-radius: 0.5rem;
          background: rgba(255,255,255,0.03);
        }
        .mcp-tool-row--off { opacity: 0.45; }
        .mcp-tool-info { display: flex; flex-direction: column; gap: 0.1rem; min-width: 0; }
        .mcp-tool-name { font-size: 0.82rem; font-weight: 600; color: var(--bodhion-text-primary); }
        .mcp-tool-desc {
          font-size: 0.74rem;
          color: var(--bodhion-text-secondary);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          max-width: 55ch;
        }
        .mcp-tools-empty {
          font-size: 0.8rem;
          color: var(--bodhion-text-secondary);
          text-align: center;
          padding: 0.75rem 0;
          font-style: italic;
        }

        /* ── Add/Edit form ── */
        .mcp-form {
          border: 1px solid var(--bodhion-shell-border-strong);
          border-radius: 1rem;
          background: var(--bodhion-card-bg);
          padding: 1rem 1.1rem;
        }
        .mcp-form + .mcp-row { margin-top: 0.5rem; }
        .mcp-row + .mcp-form  { margin-top: 0.5rem; }
        .mcp-form-title {
          font-size: 0.88rem;
          font-weight: 700;
          color: var(--bodhion-text-primary);
          margin-bottom: 0.85rem;
        }
        .mcp-form-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 0.7rem 1rem;
        }
        .mcp-form-wide { grid-column: 1 / -1; }
        .mcp-required { color: #f87171; margin-left: 0.15rem; }
        .mcp-field-hint {
          font-weight: 400;
          font-size: 0.75rem;
          color: var(--bodhion-text-secondary);
        }

        /* ── Sparkline ── */
        .mcp-sparkline {
          display: flex;
          align-items: center;
          gap: 0.4rem;
        }
        .mcp-sparkline-dots {
          display: flex;
          gap: 2px;
          align-items: flex-end;
        }
        .mcp-dot {
          width: 5px;
          height: 14px;
          border-radius: 2px;
          display: inline-block;
        }
        .mcp-dot--ok    { background: #4ade80; }
        .mcp-dot--error { background: #f87171; }
        .mcp-dot--none  { background: rgba(255,255,255,0.12); }
        .mcp-sparkline-uptime {
          font-size: 0.7rem;
          font-weight: 600;
          color: var(--bodhion-text-secondary);
          white-space: nowrap;
        }

        /* ── Down-server alert banner ── */
        .mcp-alert-banner {
          display: flex;
          align-items: center;
          gap: 0.6rem;
          background: rgba(239,68,68,0.1);
          border: 1px solid rgba(239,68,68,0.3);
          border-radius: 0.75rem;
          padding: 0.55rem 0.85rem;
          margin-bottom: 0.6rem;
          flex-wrap: wrap;
        }
        .mcp-alert-icon { color: #f87171; flex-shrink: 0; }
        .mcp-alert-text {
          font-size: 0.82rem;
          font-weight: 600;
          color: #f87171;
        }
        .mcp-alert-list {
          display: flex;
          gap: 0.35rem;
          flex-wrap: wrap;
          margin-left: auto;
        }
        .mcp-alert-chip {
          font-size: 0.72rem;
          font-weight: 600;
          padding: 0.15rem 0.5rem;
          border-radius: 999px;
          background: rgba(239,68,68,0.15);
          color: #f87171;
          border: 1px solid rgba(239,68,68,0.3);
        }

        /* ── Validate chip ── */
        .mcp-validate-chip {
          font-size: 0.75rem;
          font-weight: 600;
          padding: 0.25rem 0.6rem;
          border-radius: 999px;
          white-space: nowrap;
          max-width: 32ch;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .mcp-validate-chip--ok {
          background: rgba(34,197,94,0.12);
          color: #4ade80;
          border: 1px solid rgba(34,197,94,0.25);
        }
        .mcp-validate-chip--fail {
          background: rgba(239,68,68,0.1);
          color: #f87171;
          border: 1px solid rgba(239,68,68,0.25);
        }
        .mcp-form-actions-right {
          display: flex;
          gap: 0.5rem;
          margin-left: auto;
        }

        /* ── Misc ── */
        .conn-btn--sm {
          font-size: 0.78rem !important;
          padding: 0.3rem 0.6rem !important;
        }
        .mcp-unsaved-hint {
          margin-top: 0.6rem;
          font-size: 0.78rem;
          color: var(--bodhion-text-secondary);
          font-style: italic;
        }
      `}</style>
    </div>
  );
}
