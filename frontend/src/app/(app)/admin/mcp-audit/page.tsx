'use client';

import { useCallback, useEffect, useState } from 'react';
import { Download, Filter, RefreshCw, CheckCircle2, XCircle, ChevronDown, ChevronRight } from 'lucide-react';
import { getToken } from '@/lib/auth/session';
import {
  getMcpAuditLog,
  type McpAuditRow,
  type McpAuditFilters,
} from '@/lib/api/admin/settings';

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatTs(ts: number): string {
  return new Date(ts * 1000).toLocaleString();
}

function exportToCsv(rows: McpAuditRow[]) {
  const header = ['timestamp', 'user_id', 'server_name', 'tool_name', 'status', 'error_type', 'latency_ms', 'input_summary', 'chat_id'];
  const lines = [
    header.join(','),
    ...rows.map((r) =>
      header
        .map((h) => {
          const val = r[h as keyof McpAuditRow] ?? '';
          const str = String(val).replace(/"/g, '""');
          return `"${str}"`;
        })
        .join(','),
    ),
  ];
  const blob = new Blob([lines.join('\n')], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `mcp-audit-${Date.now()}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ── Expanded row ──────────────────────────────────────────────────────────────

function ExpandedRow({ row }: { row: McpAuditRow }) {
  return (
    <div className="ma-expanded">
      <div className="ma-expanded-grid">
        {row.input_summary && (
          <div>
            <span className="ma-detail-label">Input summary</span>
            <pre className="ma-detail-pre">{row.input_summary}</pre>
          </div>
        )}
        {row.chat_id && (
          <div>
            <span className="ma-detail-label">Chat ID</span>
            <code className="ma-detail-code">{row.chat_id}</code>
          </div>
        )}
        <div>
          <span className="ma-detail-label">Log ID</span>
          <code className="ma-detail-code">{row.id}</code>
        </div>
      </div>
    </div>
  );
}

// ── Row component ─────────────────────────────────────────────────────────────

function AuditRow({ row }: { row: McpAuditRow }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <tr className="ma-tr" onClick={() => setOpen((v) => !v)} style={{ cursor: 'pointer' }}>
        <td className="ma-td ma-td--expand">
          {open ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
        </td>
        <td className="ma-td ma-td--time">{formatTs(row.timestamp)}</td>
        <td className="ma-td ma-td--user" title={row.user_id ?? ''}>
          {row.user_id ? row.user_id.slice(0, 8) + '…' : '—'}
        </td>
        <td className="ma-td">
          <span className="ma-server-chip">{row.server_name ?? row.server_id ?? '—'}</span>
        </td>
        <td className="ma-td ma-td--tool">{row.tool_name ?? '—'}</td>
        <td className="ma-td">
          {row.status === 'success' ? (
            <span className="ma-badge ma-badge--ok">
              <CheckCircle2 className="h-3 w-3" /> success
            </span>
          ) : (
            <span className="ma-badge ma-badge--err">
              <XCircle className="h-3 w-3" /> {row.error_type ?? 'error'}
            </span>
          )}
        </td>
        <td className="ma-td ma-td--latency">
          {row.latency_ms != null ? `${row.latency_ms} ms` : '—'}
        </td>
      </tr>
      {open && (
        <tr>
          <td colSpan={7} className="ma-td ma-td--expanded">
            <ExpandedRow row={row} />
          </td>
        </tr>
      )}
    </>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function McpAuditPage() {
  const [rows,    setRows]    = useState<McpAuditRow[]>([]);
  const [total,   setTotal]   = useState(0);
  const [loading, setLoading] = useState(false);
  const [page,    setPage]    = useState(0);

  // Filters
  const [fServerId,  setFServerId]  = useState('');
  const [fUserId,    setFUserId]    = useState('');
  const [fToolName,  setFToolName]  = useState('');
  const [fStatus,    setFStatus]    = useState('');
  const [fStartDate, setFStartDate] = useState('');
  const [fEndDate,   setFEndDate]   = useState('');

  const PAGE_SIZE = 50;

  const load = useCallback(async (pg: number) => {
    setLoading(true);
    try {
      const token = await getToken();
      const filters: McpAuditFilters = {
        skip:  pg * PAGE_SIZE,
        limit: PAGE_SIZE,
      };
      if (fServerId.trim())  filters.server_id  = fServerId.trim();
      if (fUserId.trim())    filters.user_id    = fUserId.trim();
      if (fToolName.trim())  filters.tool_name  = fToolName.trim();
      if (fStatus)           filters.status     = fStatus;
      if (fStartDate)        filters.start_time = Math.floor(new Date(fStartDate).getTime() / 1000);
      if (fEndDate)          filters.end_time   = Math.floor(new Date(fEndDate).getTime() / 1000);

      const data = await getMcpAuditLog(token ?? '', filters);
      setRows(data?.rows ?? []);
      setTotal(data?.total ?? 0);
      setPage(pg);
    } catch {
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [fServerId, fUserId, fToolName, fStatus, fStartDate, fEndDate]);

  useEffect(() => { load(0); }, [load]);

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div className="ma-root">
      {/* Header */}
      <div className="ma-page-header">
        <div className="ma-page-header-glow" />
        <div className="relative px-5 py-4 space-y-2">
          <div className="bodhion-eyebrow-badge">BODHION ADMIN</div>
          <div>
            <h1 className="bodhion-page-title">MCP Audit Log</h1>
            <p className="bodhion-page-desc mt-1">
              Every MCP tool invocation — who called what, when, and whether it succeeded.
            </p>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="ma-filters">
        <div className="ma-filter-icon"><Filter className="h-3.5 w-3.5" /></div>
        <input className="ma-filter-input" placeholder="Server ID" value={fServerId} onChange={(e) => setFServerId(e.target.value)} />
        <input className="ma-filter-input" placeholder="User ID" value={fUserId} onChange={(e) => setFUserId(e.target.value)} />
        <input className="ma-filter-input" placeholder="Tool name" value={fToolName} onChange={(e) => setFToolName(e.target.value)} />
        <select className="ma-filter-select" value={fStatus} onChange={(e) => setFStatus(e.target.value)}>
          <option value="">All statuses</option>
          <option value="success">Success</option>
          <option value="error">Error</option>
        </select>
        <input className="ma-filter-input ma-filter-input--date" type="date" value={fStartDate} onChange={(e) => setFStartDate(e.target.value)} title="From date" />
        <input className="ma-filter-input ma-filter-input--date" type="date" value={fEndDate} onChange={(e) => setFEndDate(e.target.value)} title="To date" />
        <button className="ma-btn" onClick={() => load(0)} disabled={loading}>
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
        <button className="ma-btn ma-btn--ghost" onClick={() => exportToCsv(rows)} disabled={rows.length === 0}>
          <Download className="h-3.5 w-3.5" />
          CSV
        </button>
      </div>

      {/* Stats bar */}
      <div className="ma-stats">
        <span>{total.toLocaleString()} total events</span>
        {rows.length > 0 && (
          <span>Showing {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, total)}</span>
        )}
      </div>

      {/* Table */}
      <div className="ma-table-wrap">
        <table className="ma-table">
          <thead>
            <tr>
              <th className="ma-th" />
              <th className="ma-th">Timestamp</th>
              <th className="ma-th">User</th>
              <th className="ma-th">Server</th>
              <th className="ma-th">Tool</th>
              <th className="ma-th">Status</th>
              <th className="ma-th">Latency</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={7} className="ma-td ma-td--center">
                  <RefreshCw className="h-4 w-4 animate-spin inline mr-2" style={{ color: 'var(--bodhion-accent)' }} />
                  Loading…
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={7} className="ma-td ma-td--center">No audit events match the current filters.</td>
              </tr>
            ) : (
              rows.map((r) => <AuditRow key={r.id} row={r} />)
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="ma-pagination">
          <button className="ma-btn ma-btn--ghost" onClick={() => load(page - 1)} disabled={page === 0 || loading}>
            Previous
          </button>
          <span className="ma-page-info">Page {page + 1} / {totalPages}</span>
          <button className="ma-btn ma-btn--ghost" onClick={() => load(page + 1)} disabled={page >= totalPages - 1 || loading}>
            Next
          </button>
        </div>
      )}

      <style>{`
        .ma-root {
          display: flex;
          flex-direction: column;
          gap: 1rem;
          padding: 1rem;
          min-height: 100%;
          color: var(--bodhion-text-primary);
        }

        /* ── Header ── */
        .ma-page-header {
          position: relative;
          overflow: hidden;
          border-radius: 1.6rem;
          border: 1px solid rgba(255,255,255,0.1);
          background: var(--bodhion-shell-bg);
          backdrop-filter: blur(22px);
          flex-shrink: 0;
        }
        .ma-page-header-glow {
          position: absolute;
          inset: 0;
          background:
            linear-gradient(120deg, rgba(0,104,201,0.13), transparent 34%),
            linear-gradient(120deg, transparent 45%, rgba(37,215,255,0.11), transparent 72%);
          pointer-events: none;
        }
        .bodhion-eyebrow-badge {
          display: inline-flex;
          align-items: center;
          border: 1px solid rgba(199,242,58,0.24);
          background: rgba(118,209,26,0.08);
          padding: 0.28rem 0.65rem;
          border-radius: 999px;
          color: #c7f23a;
          font-size: 0.66rem;
          font-weight: 700;
          letter-spacing: 0.14em;
          text-transform: uppercase;
        }
        .bodhion-page-title {
          font-size: clamp(1.2rem, 1rem + 0.5vw, 1.85rem);
          font-weight: 800;
          line-height: 1.05;
          letter-spacing: -0.02em;
        }
        .bodhion-page-desc {
          font-size: 0.86rem;
          line-height: 1.55;
          color: var(--bodhion-text-secondary);
        }

        /* ── Filters ── */
        .ma-filters {
          display: flex;
          align-items: center;
          flex-wrap: wrap;
          gap: 0.5rem;
          padding: 0.75rem 1rem;
          border-radius: 1rem;
          border: 1px solid var(--bodhion-card-border, rgba(255,255,255,0.07));
          background: var(--bodhion-card-bg, rgba(8,22,42,0.55));
        }
        .ma-filter-icon {
          color: var(--bodhion-text-secondary);
          flex-shrink: 0;
        }
        .ma-filter-input, .ma-filter-select {
          padding: 0.35rem 0.65rem;
          border-radius: 0.55rem;
          border: 1px solid rgba(255,255,255,0.1);
          background: rgba(0,0,0,0.2);
          color: var(--bodhion-text-primary);
          font-size: 0.8rem;
          outline: none;
          min-width: 120px;
        }
        .ma-filter-input--date { min-width: 140px; }
        .ma-filter-input:focus, .ma-filter-select:focus {
          border-color: var(--bodhion-accent, #25d7ff);
        }

        /* ── Buttons ── */
        .ma-btn {
          display: inline-flex;
          align-items: center;
          gap: 0.35rem;
          padding: 0.38rem 0.8rem;
          border-radius: 0.6rem;
          font-size: 0.8rem;
          font-weight: 600;
          cursor: pointer;
          border: 1px solid transparent;
          background: var(--bodhion-accent, #25d7ff);
          color: #001a2c;
          white-space: nowrap;
          transition: opacity 0.15s;
        }
        .ma-btn:disabled { opacity: 0.45; cursor: not-allowed; }
        .ma-btn:hover:not(:disabled) { opacity: 0.88; }
        .ma-btn--ghost {
          background: rgba(255,255,255,0.05);
          color: var(--bodhion-text-secondary);
          border-color: rgba(255,255,255,0.08);
        }
        .ma-btn--ghost:hover:not(:disabled) { background: rgba(255,255,255,0.09); }

        /* ── Stats ── */
        .ma-stats {
          display: flex;
          gap: 1rem;
          font-size: 0.78rem;
          color: var(--bodhion-text-secondary);
          padding: 0 0.25rem;
        }

        /* ── Table ── */
        .ma-table-wrap {
          border-radius: 1rem;
          border: 1px solid var(--bodhion-card-border, rgba(255,255,255,0.07));
          background: var(--bodhion-card-bg, rgba(8,22,42,0.55));
          overflow: hidden;
          overflow-x: auto;
        }
        .ma-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 0.82rem;
        }
        .ma-th {
          padding: 0.6rem 0.75rem;
          text-align: left;
          font-weight: 600;
          font-size: 0.74rem;
          letter-spacing: 0.04em;
          text-transform: uppercase;
          color: var(--bodhion-text-secondary);
          border-bottom: 1px solid rgba(255,255,255,0.06);
          white-space: nowrap;
        }
        .ma-tr { border-bottom: 1px solid rgba(255,255,255,0.04); transition: background 0.1s; }
        .ma-tr:hover { background: rgba(255,255,255,0.03); }
        .ma-tr:last-child { border-bottom: none; }
        .ma-td {
          padding: 0.55rem 0.75rem;
          vertical-align: top;
          color: var(--bodhion-text-primary);
        }
        .ma-td--expand { width: 1.5rem; padding-right: 0; color: var(--bodhion-text-secondary); }
        .ma-td--time { white-space: nowrap; font-size: 0.78rem; color: var(--bodhion-text-secondary); }
        .ma-td--user { font-family: monospace; font-size: 0.78rem; color: var(--bodhion-text-secondary); }
        .ma-td--tool { font-family: monospace; font-size: 0.8rem; }
        .ma-td--latency { text-align: right; font-size: 0.78rem; color: var(--bodhion-text-secondary); }
        .ma-td--center { text-align: center; color: var(--bodhion-text-secondary); padding: 2rem; }
        .ma-td--expanded { padding: 0; background: rgba(0,0,0,0.15); }

        /* ── Server chip ── */
        .ma-server-chip {
          display: inline-flex;
          padding: 0.15rem 0.5rem;
          border-radius: 999px;
          font-size: 0.73rem;
          background: rgba(37,215,255,0.08);
          border: 1px solid rgba(37,215,255,0.18);
          color: var(--bodhion-accent, #25d7ff);
          white-space: nowrap;
        }

        /* ── Status badge ── */
        .ma-badge {
          display: inline-flex;
          align-items: center;
          gap: 0.25rem;
          padding: 0.15rem 0.5rem;
          border-radius: 999px;
          font-size: 0.73rem;
          font-weight: 600;
        }
        .ma-badge--ok {
          background: rgba(34,197,94,0.1);
          color: #4ade80;
          border: 1px solid rgba(34,197,94,0.22);
        }
        .ma-badge--err {
          background: rgba(239,68,68,0.1);
          color: #f87171;
          border: 1px solid rgba(239,68,68,0.22);
        }

        /* ── Expanded detail ── */
        .ma-expanded {
          padding: 0.75rem 1rem 0.75rem 2.5rem;
        }
        .ma-expanded-grid {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }
        .ma-detail-label {
          display: block;
          font-size: 0.72rem;
          font-weight: 600;
          letter-spacing: 0.05em;
          text-transform: uppercase;
          color: var(--bodhion-text-secondary);
          margin-bottom: 0.2rem;
        }
        .ma-detail-pre {
          font-family: monospace;
          font-size: 0.78rem;
          white-space: pre-wrap;
          word-break: break-all;
          color: var(--bodhion-text-primary);
          background: rgba(0,0,0,0.2);
          border-radius: 0.5rem;
          padding: 0.4rem 0.6rem;
          margin: 0;
          max-height: 8rem;
          overflow-y: auto;
        }
        .ma-detail-code {
          font-family: monospace;
          font-size: 0.78rem;
          color: var(--bodhion-text-secondary);
        }

        /* ── Pagination ── */
        .ma-pagination {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          justify-content: center;
          padding: 0.5rem;
        }
        .ma-page-info {
          font-size: 0.82rem;
          color: var(--bodhion-text-secondary);
        }
      `}</style>
    </div>
  );
}
