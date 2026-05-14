'use client';

import { useEffect, useState } from 'react';
import { getToken } from '@/lib/auth/session';
import {
  getMcpServerAnalytics,
  getMcpToolAnalytics,
  getMcpUserAnalytics,
  type McpServerUsageEntry,
  type McpToolEntry,
  type McpUserEntry,
} from '@/lib/api/admin/settings';

type Period = '24h' | '7d' | '30d';

const PERIODS: { label: string; value: Period }[] = [
  { label: '24 h',  value: '24h' },
  { label: '7 days', value: '7d' },
  { label: '30 days', value: '30d' },
];

function fmt(n: number | null | undefined, suffix = '') {
  if (n == null) return '—';
  return `${n.toLocaleString()}${suffix}`;
}

function SuccessBar({ rate }: { rate: number }) {
  const pct = Math.max(0, Math.min(100, rate));
  const color = pct >= 95 ? '#4ade80' : pct >= 80 ? '#fbbf24' : '#f87171';
  return (
    <div className="mca-bar-wrap">
      <div className="mca-bar-track">
        <div className="mca-bar-fill" style={{ width: `${pct}%`, background: color }} />
      </div>
      <span className="mca-bar-label" style={{ color }}>{pct.toFixed(1)}%</span>
    </div>
  );
}

export default function McpAnalyticsPage() {
  const [period, setPeriod] = useState<Period>('7d');
  const [servers, setServers] = useState<McpServerUsageEntry[]>([]);
  const [tools,   setTools]   = useState<McpToolEntry[]>([]);
  const [users,   setUsers]   = useState<McpUserEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = getToken();
    if (!token) return;
    setLoading(true);
    Promise.all([
      getMcpServerAnalytics(token, period),
      getMcpToolAnalytics(token, period, 20),
      getMcpUserAnalytics(token, period),
    ]).then(([srv, tool, usr]) => {
      setServers(srv.servers ?? []);
      setTools(tool.tools ?? []);
      setUsers(usr.rows ?? []);
    }).catch(() => {}).finally(() => setLoading(false));
  }, [period]);

  return (
    <div className="mca-page flex min-h-full flex-col gap-3 p-4">

      {/* ── Sticky page header ── */}
      <div className="bodhion-page-header sticky top-0 z-20 overflow-hidden rounded-[1.6rem] border border-white/10 flex-shrink-0">
        <div className="bodhion-page-header-glow" />
        <div className="relative px-5 py-4 flex items-center justify-between flex-wrap gap-3">
          <div className="space-y-1">
            <div className="bodhion-eyebrow-badge">BODHION ADMIN</div>
            <h1 className="bodhion-page-title">MCP Analytics</h1>
            <p className="bodhion-page-desc">
              Tool call volumes, success rates, latency, and per-user activity across all MCP servers.
            </p>
          </div>
          {/* Period selector */}
          <div className="mca-period-tabs">
            {PERIODS.map((p) => (
              <button
                key={p.value}
                type="button"
                className={`mca-period-btn${period === p.value ? ' mca-period-btn--active' : ''}`}
                onClick={() => setPeriod(p.value)}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Content ── */}
      <div className="bodhion-scroll min-h-0 flex-1">
        {loading ? (
          <div className="mca-loading">
            {[1, 2, 3].map((i) => (
              <div key={i} className="mca-skeleton" />
            ))}
          </div>
        ) : (
          <div className="mca-grid">

            {/* Server usage table */}
            <div className="mca-card">
              <div className="mca-card-title">Server Usage</div>
              {servers.length === 0 ? (
                <div className="mca-empty">No data for this period.</div>
              ) : (
                <div className="mca-table-wrap">
                  <table className="mca-table">
                    <thead>
                      <tr>
                        <th>Server</th>
                        <th className="mca-th-right">Calls</th>
                        <th>Success rate</th>
                        <th className="mca-th-right">Avg latency</th>
                        <th className="mca-th-right">Users</th>
                      </tr>
                    </thead>
                    <tbody>
                      {servers.map((s) => (
                        <tr key={s.server_id}>
                          <td>
                            <div className="mca-cell-name">{s.server_name || s.server_id}</div>
                            <div className="mca-cell-sub">{s.server_id}</div>
                          </td>
                          <td className="mca-td-right">
                            <span className="mca-num">{fmt(s.total_calls)}</span>
                            {s.error_count > 0 && (
                              <span className="mca-err-count"> ({s.error_count} err)</span>
                            )}
                          </td>
                          <td><SuccessBar rate={s.success_rate} /></td>
                          <td className="mca-td-right mca-num">{fmt(s.avg_latency_ms, ' ms')}</td>
                          <td className="mca-td-right mca-num">{fmt(s.unique_users)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Top tools table */}
            <div className="mca-card">
              <div className="mca-card-title">Top Tools</div>
              {tools.length === 0 ? (
                <div className="mca-empty">No data for this period.</div>
              ) : (
                <div className="mca-table-wrap">
                  <table className="mca-table">
                    <thead>
                      <tr>
                        <th>Tool</th>
                        <th>Server</th>
                        <th className="mca-th-right">Calls</th>
                        <th className="mca-th-right">Errors</th>
                      </tr>
                    </thead>
                    <tbody>
                      {tools.map((t, i) => (
                        <tr key={`${t.tool_name}-${i}`}>
                          <td className="mca-cell-name">{t.tool_name}</td>
                          <td className="mca-cell-sub">{t.server_name || t.server_id || '—'}</td>
                          <td className="mca-td-right mca-num">{fmt(t.call_count)}</td>
                          <td className="mca-td-right">
                            {t.error_count > 0
                              ? <span className="mca-err-count">{t.error_count}</span>
                              : <span className="mca-num">0</span>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Per-user activity table */}
            <div className="mca-card">
              <div className="mca-card-title">User Activity</div>
              {users.length === 0 ? (
                <div className="mca-empty">No data for this period.</div>
              ) : (
                <div className="mca-table-wrap">
                  <table className="mca-table">
                    <thead>
                      <tr>
                        <th>User</th>
                        <th>Server</th>
                        <th className="mca-th-right">Calls</th>
                      </tr>
                    </thead>
                    <tbody>
                      {users.map((u, i) => (
                        <tr key={`${u.user_id}-${i}`}>
                          <td>
                            <div className="mca-cell-name">{u.user_name || u.user_id}</div>
                            <div className="mca-cell-sub">{u.user_email || u.user_id}</div>
                          </td>
                          <td className="mca-cell-sub">{u.server_name || u.server_id || '—'}</td>
                          <td className="mca-td-right mca-num">{fmt(u.call_count)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

          </div>
        )}
      </div>

      <style>{`
        .mca-page { color: var(--bodhion-text-primary); }

        /* ── Page header (shared pattern) ── */
        .bodhion-page-header {
          background: var(--bodhion-shell-bg);
          backdrop-filter: blur(22px);
          box-shadow: 0 24px 70px rgba(0,0,0,0.3);
        }
        .bodhion-page-header-glow {
          position: absolute; inset: 0;
          background:
            linear-gradient(120deg, rgba(0,104,201,0.13), transparent 34%),
            linear-gradient(120deg, transparent 45%, rgba(37,215,255,0.11), transparent 72%);
          pointer-events: none;
        }
        .bodhion-eyebrow-badge {
          display: inline-flex; align-items: center;
          border: 1px solid rgba(199,242,58,0.24);
          background: rgba(118,209,26,0.08);
          padding: 0.28rem 0.65rem; border-radius: 999px;
          color: #c7f23a;
          font-size: 0.66rem; font-weight: 700;
          letter-spacing: 0.14em; text-transform: uppercase; width: fit-content;
        }
        .bodhion-page-title {
          font-size: clamp(1.2rem, 1rem + 0.5vw, 1.85rem);
          font-weight: 800; line-height: 1.05;
          letter-spacing: -0.02em; color: var(--bodhion-text-primary);
        }
        .bodhion-page-desc {
          font-size: 0.86rem; line-height: 1.55;
          color: var(--bodhion-text-secondary); max-width: 60rem;
        }
        .bodhion-scroll { overflow-y: auto; padding-bottom: 2rem; }

        /* ── Period tabs ── */
        .mca-period-tabs {
          display: flex;
          gap: 0.25rem;
          background: rgba(255,255,255,0.05);
          border: 1px solid rgba(255,255,255,0.1);
          border-radius: 0.65rem;
          padding: 0.2rem;
          flex-shrink: 0;
        }
        .mca-period-btn {
          font-size: 0.78rem;
          font-weight: 600;
          padding: 0.3rem 0.8rem;
          border-radius: 0.45rem;
          border: none;
          background: transparent;
          color: var(--bodhion-text-secondary);
          cursor: pointer;
          transition: background 0.15s, color 0.15s;
        }
        .mca-period-btn:hover { color: var(--bodhion-text-primary); background: rgba(255,255,255,0.07); }
        .mca-period-btn--active { background: var(--bodhion-accent); color: #fff; }

        /* ── Layout ── */
        .mca-grid {
          display: flex;
          flex-direction: column;
          gap: 1rem;
          padding-top: 0.25rem;
        }
        .mca-loading {
          display: flex; flex-direction: column; gap: 1rem; padding-top: 0.25rem;
        }
        .mca-skeleton {
          height: 10rem;
          border-radius: 1rem;
          background: var(--bodhion-card-bg);
          border: 1px solid var(--bodhion-card-border);
          animation: pulse 1.5s ease-in-out infinite;
        }
        @keyframes pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.45; } }

        /* ── Card ── */
        .mca-card {
          border: 1px solid var(--bodhion-card-border);
          border-radius: 1rem;
          background: var(--bodhion-card-bg);
          overflow: hidden;
        }
        .mca-card-title {
          font-size: 0.82rem;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.06em;
          color: var(--bodhion-text-secondary);
          padding: 0.7rem 1rem 0.5rem;
          border-bottom: 1px solid var(--bodhion-card-border);
        }
        .mca-empty {
          padding: 1.5rem 1rem;
          text-align: center;
          font-size: 0.82rem;
          color: var(--bodhion-text-secondary);
          font-style: italic;
        }

        /* ── Table ── */
        .mca-table-wrap { overflow-x: auto; }
        .mca-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 0.82rem;
        }
        .mca-table th {
          text-align: left;
          font-size: 0.72rem;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          color: var(--bodhion-text-secondary);
          padding: 0.45rem 1rem;
          border-bottom: 1px solid var(--bodhion-card-border);
          white-space: nowrap;
        }
        .mca-th-right { text-align: right !important; }
        .mca-table td {
          padding: 0.5rem 1rem;
          border-bottom: 1px solid rgba(255,255,255,0.04);
          color: var(--bodhion-text-primary);
          vertical-align: middle;
        }
        .mca-table tr:last-child td { border-bottom: none; }
        .mca-table tr:hover td { background: rgba(255,255,255,0.025); }
        .mca-td-right { text-align: right; }
        .mca-cell-name { font-weight: 600; }
        .mca-cell-sub {
          font-size: 0.74rem;
          color: var(--bodhion-text-secondary);
          margin-top: 0.1rem;
        }
        .mca-num { font-variant-numeric: tabular-nums; }
        .mca-err-count { color: #f87171; font-size: 0.74rem; }

        /* ── Success rate bar ── */
        .mca-bar-wrap { display: flex; align-items: center; gap: 0.5rem; min-width: 10rem; }
        .mca-bar-track {
          flex: 1;
          height: 6px;
          border-radius: 3px;
          background: rgba(255,255,255,0.08);
          overflow: hidden;
        }
        .mca-bar-fill { height: 100%; border-radius: 3px; transition: width 0.3s; }
        .mca-bar-label { font-size: 0.74rem; font-weight: 700; white-space: nowrap; }
      `}</style>
    </div>
  );
}
