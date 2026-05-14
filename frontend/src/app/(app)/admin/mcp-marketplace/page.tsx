'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Search, RefreshCw, CheckCircle2, ExternalLink,
  Loader2, PlusCircle, Settings, Bell, X,
} from 'lucide-react';
import { toast } from 'sonner';
import { getToken } from '@/lib/auth/session';
import {
  getMcpRegistry,
  getMcpRegistryCategories,
  setToolServersConfig,
  getToolServersConfig,
  type RegistryServer,
  type RegistryCategory,
} from '@/lib/api/admin/settings';
import type { MCPServerConnection } from '@/types/config';

// ── Constants ─────────────────────────────────────────────────────────────────

const SEEN_VERSION_KEY = 'mcp_registry_last_seen_version';
const ALL_LABEL = 'All';

// ── Helpers ───────────────────────────────────────────────────────────────────

function authLabel(auth: string): string {
  if (auth === 'oauth_2.1') return 'OAuth 2.1';
  if (auth === 'bearer')    return 'API Key';
  return 'None';
}

function authColor(auth: string): string {
  if (auth === 'oauth_2.1') return 'mp-chip--oauth';
  if (auth === 'bearer')    return 'mp-chip--key';
  return 'mp-chip--none';
}

function makeConnection(s: RegistryServer): MCPServerConnection {
  return {
    url:             s.config_template.url ?? '',
    type:            'mcp',
    server_protocol: 'mcp',
    auth_type:       s.auth_type as MCPServerConnection['auth_type'],
    key:             '',
    info: {
      id:          s.id,
      name:        s.name,
      description: s.description,
      category:    s.category as MCPServerConnection['info']['category'],
    },
    config: {
      enable:                  true,
      access_grants:           [],
      function_name_filter_list: '',
    },
  };
}

// ── New-servers banner ────────────────────────────────────────────────────────

function NewServersBanner({
  count,
  onDismiss,
}: { count: number; onDismiss: () => void }) {
  return (
    <div className="mp-banner">
      <Bell className="h-4 w-4 mp-banner-icon" />
      <span>
        <strong>{count} new MCP server{count !== 1 ? 's' : ''}</strong> available since your last visit.
      </span>
      <button type="button" className="mp-banner-close" onClick={onDismiss} aria-label="Dismiss">
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

// ── Server card ───────────────────────────────────────────────────────────────

function ServerCard({
  server,
  adding,
  onAdd,
}: {
  server: RegistryServer;
  adding: boolean;
  onAdd: (s: RegistryServer) => void;
}) {
  return (
    <div className={`mp-card ${server.installed ? 'mp-card--installed' : ''} ${server.bundled ? 'mp-card--bundled' : ''}`}>
      <div className="mp-card-top">
        <span className="mp-card-icon" role="img" aria-label={server.name}>
          {server.icon ?? '🔌'}
        </span>
        <div className="mp-card-badges">
          {server.bundled ? (
            <span className="mp-chip mp-chip--bundled">⬡ Built-in</span>
          ) : (
            <span className={`mp-chip ${authColor(server.auth_type)}`}>
              {authLabel(server.auth_type)}
            </span>
          )}
          {server.author === 'verified' && !server.bundled && (
            <span className="mp-chip mp-chip--verified">✓ Verified</span>
          )}
        </div>
      </div>

      <div className="mp-card-body">
        <h3 className="mp-card-name">{server.name}</h3>
        <p className="mp-card-desc">{server.description}</p>
      </div>

      <div className="mp-card-tags">
        {(server.tags ?? []).filter((t) => t !== 'bundled').slice(0, 3).map((t) => (
          <span key={t} className="mp-tag">{t}</span>
        ))}
      </div>

      <div className="mp-card-footer">
        {server.docs_url && (
          <a
            href={server.docs_url}
            target="_blank"
            rel="noopener noreferrer"
            className="mp-link"
          >
            Docs <ExternalLink className="h-3 w-3" />
          </a>
        )}
        {server.installed ? (
          <span className="mp-installed-badge">
            <CheckCircle2 className="h-3.5 w-3.5" /> {server.bundled ? 'Running' : 'Installed'}
          </span>
        ) : (
          <button
            type="button"
            className="mp-add-btn"
            onClick={() => onAdd(server)}
            disabled={adding}
          >
            {adding
              ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
              : <PlusCircle className="h-3.5 w-3.5" />}
            {server.bundled ? 'Enable' : 'Add to Bodhion'}
          </button>
        )}
      </div>
    </div>
  );
}

// ── Confirm-add modal ─────────────────────────────────────────────────────────

function AddModal({
  server,
  onConfirm,
  onCancel,
}: {
  server: RegistryServer;
  onConfirm: (url: string, key: string) => void;
  onCancel: () => void;
}) {
  const [url, setUrl] = useState(server.config_template.url ?? '');
  const [key, setKey] = useState('');
  const needsKey = server.auth_type === 'bearer';
  const isBundled = !!server.bundled;

  return (
    <div className="mp-modal-backdrop" onClick={(e) => e.target === e.currentTarget && onCancel()}>
      <div className="mp-modal">
        <div className="mp-modal-header">
          <span className="mp-modal-icon">{server.icon ?? '🔌'}</span>
          <div>
            <h2 className="mp-modal-title">{isBundled ? 'Enable' : 'Add'} {server.name}</h2>
            <p className="mp-modal-sub">
              {isBundled
                ? 'This server is bundled with Bodhion and runs locally.'
                : 'Fill in the connection details to add this server.'}
            </p>
          </div>
          <button type="button" className="mp-modal-close" onClick={onCancel}>
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mp-modal-body">
          {isBundled ? (
            <div className="mp-bundled-note">
              <span className="mp-chip mp-chip--bundled" style={{ fontSize: '0.72rem' }}>⬡ Built-in</span>
              <p style={{ margin: '0.5rem 0 0', fontSize: '0.82rem', lineHeight: 1.55 }}>
                Connecting to <code style={{ fontSize: '0.78rem' }}>{url}</code> on the internal Docker network.
                Make sure you started Bodhion with <code style={{ fontSize: '0.78rem' }}>--profile mcp-bundled</code>.
              </p>
            </div>
          ) : (
            <div className="mp-field">
              <label className="mp-label">Server URL <span className="mp-required">*</span></label>
              <input
                className="mp-input"
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://mcp.example.com"
                autoFocus
              />
              <p className="mp-hint">The MCP server endpoint for {server.name}.</p>
            </div>
          )}

          {needsKey && (
            <div className="mp-field">
              <label className="mp-label">API Key</label>
              <input
                className="mp-input"
                type="password"
                value={key}
                onChange={(e) => setKey(e.target.value)}
                placeholder="Your API key (can be added later)"
              />
            </div>
          )}

          {server.auth_type === 'oauth_2.1' && (
            <div className="mp-oauth-note">
              This server uses OAuth 2.1. Users will authenticate individually
              via the <strong>Connected Services</strong> panel in their settings.
            </div>
          )}
        </div>

        <div className="mp-modal-footer">
          <button type="button" className="mp-btn mp-btn--ghost" onClick={onCancel}>Cancel</button>
          <button
            type="button"
            className="mp-btn mp-btn--primary"
            disabled={!url.trim()}
            onClick={() => url.trim() && onConfirm(url.trim(), key)}
          >
            {isBundled ? 'Enable server' : 'Add server'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Build a Server guide ──────────────────────────────────────────────────────

function CodeBlock({ children }: { children: string }) {
  return (
    <pre className="mp-code-block"><code>{children}</code></pre>
  );
}

function GuideSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mp-guide-section">
      <h2 className="mp-guide-h2">{title}</h2>
      {children}
    </section>
  );
}

function BuildAServerGuide() {
  return (
    <div className="mp-guide">
      <div className="mp-guide-hero">
        <div className="mp-guide-hero-title">Build an MCP Server for Bodhion</div>
        <p className="mp-guide-hero-desc">
          Any tool or external service can become an AI skill in Bodhion by wrapping it as an MCP server.
          This guide takes you from zero to a marketplace-ready server in under an hour.
        </p>
        <div className="mp-guide-hero-badges">
          <span className="mp-guide-badge">Python</span>
          <span className="mp-guide-badge">TypeScript</span>
          <span className="mp-guide-badge">Docker</span>
          <span className="mp-guide-badge">Streamable HTTP</span>
        </div>
      </div>

      <div className="mp-guide-body">
        <GuideSection title="1. Scaffold a new server">
          <p className="mp-guide-p">
            Run the scaffolder from the Bodhion repo root. It generates a validator-passing skeleton in your language of choice:
          </p>
          <CodeBlock>{`# Python
python scripts/scaffold-mcp-server.py --name "My Skill" --lang python

# TypeScript
python scripts/scaffold-mcp-server.py --name "My Skill" --lang typescript`}</CodeBlock>
          <p className="mp-guide-p">
            The generated project includes <code className="mp-inline-code">server.py</code> (or <code className="mp-inline-code">src/index.ts</code>), a <code className="mp-inline-code">Dockerfile</code>, and a pre-filled <code className="mp-inline-code">bodhion-manifest.json</code>.
          </p>
        </GuideSection>

        <GuideSection title="2. Minimum protocol surface">
          <p className="mp-guide-p">Your server must implement three behaviours via the MCP SDK:</p>
          <div className="mp-guide-table-wrap">
            <table className="mp-guide-table">
              <thead><tr><th>Behaviour</th><th>Requirement</th></tr></thead>
              <tbody>
                <tr><td>Initialize</td><td>Accept MCP handshake, return server info</td></tr>
                <tr><td>list_tools</td><td>Return ≥ 1 tool with <code className="mp-inline-code">name</code>, <code className="mp-inline-code">description</code>, <code className="mp-inline-code">inputSchema</code> (type: object)</td></tr>
                <tr><td>call_tool</td><td>Return <code className="mp-inline-code">CallToolResult</code>; set <code className="mp-inline-code">isError: true</code> on failure</td></tr>
              </tbody>
            </table>
          </div>
          <p className="mp-guide-p">The scaffolded <code className="mp-inline-code">hello_world</code> tool satisfies all three. Replace it with your real logic.</p>
        </GuideSection>

        <GuideSection title="3. Auth type options">
          <div className="mp-guide-table-wrap">
            <table className="mp-guide-table">
              <thead><tr><th>auth_type</th><th>When to use</th><th>How credentials flow</th></tr></thead>
              <tbody>
                <tr><td><code className="mp-inline-code">none</code></td><td>Internal / bundled servers</td><td>No credentials sent</td></tr>
                <tr><td><code className="mp-inline-code">bearer</code></td><td>API-key protected services</td><td><code className="mp-inline-code">Authorization: Bearer &lt;key&gt;</code> header</td></tr>
                <tr><td><code className="mp-inline-code">oauth_2.1</code></td><td>Per-user identity (Gmail, GitHub…)</td><td>Bodhion handles PKCE flow; tokens stored per user</td></tr>
              </tbody>
            </table>
          </div>
        </GuideSection>

        <GuideSection title="4. Validate before submitting">
          <p className="mp-guide-p">Start your server via <code className="mp-inline-code">supergateway</code>, then run the validator:</p>
          <CodeBlock>{`# Terminal 1 — expose your stdio server as Streamable HTTP
npx supergateway --stdio 'python server.py' --port 8000 --host 0.0.0.0

# Terminal 2 — run the Bodhion compatibility validator
python scripts/validate-mcp-server.py --url http://localhost:8000

# With bearer auth
python scripts/validate-mcp-server.py --url http://localhost:8000 \\
    --header "Authorization: Bearer your-test-key"`}</CodeBlock>
          <p className="mp-guide-p">
            Exit code 0 = all checks pass. You can also use the <strong>Validate</strong> button in Admin → Settings → MCP Servers when adding your server.
          </p>
        </GuideSection>

        <GuideSection title="5. Submit to the marketplace">
          <ol className="mp-guide-ol">
            <li>Fill in <code className="mp-inline-code">bodhion-manifest.json</code> — set <code className="mp-inline-code">id</code>, <code className="mp-inline-code">name</code>, <code className="mp-inline-code">category</code>, <code className="mp-inline-code">auth_type</code>, and <code className="mp-inline-code">config_template.url</code>.</li>
            <li>Add your entry to <code className="mp-inline-code">backend/bodhion/static/mcp-registry/registry.json</code> and bump the version timestamp.</li>
            <li>Open a pull request. The CI workflow runs the validator against your server URL automatically.</li>
            <li>On merge, your server appears in this marketplace with a <strong>community</strong> badge.</li>
          </ol>
          <p className="mp-guide-p">
            Full instructions: <code className="mp-inline-code">backend/bodhion/static/mcp-registry/CONTRIBUTING.md</code>
          </p>
        </GuideSection>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function McpMarketplacePage() {
  const router = useRouter();

  const [servers,       setServers]      = useState<RegistryServer[]>([]);
  const [categories,    setCategories]   = useState<RegistryCategory[]>([]);
  const [regVersion,    setRegVersion]   = useState('');
  const [loading,       setLoading]      = useState(true);
  const [activeCategory,setActiveCategory] = useState(ALL_LABEL);
  const [query,         setQuery]        = useState('');
  const [addingId,      setAddingId]     = useState<string | null>(null);
  const [modalServer,   setModalServer]  = useState<RegistryServer | null>(null);
  const [newCount,      setNewCount]     = useState(0);
  const [bannerVisible, setBannerVisible]= useState(false);
  const [tab,           setTab]          = useState<'browse' | 'build'>('browse');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const token = await getToken();
      const [reg, cats] = await Promise.all([
        getMcpRegistry(token ?? ''),
        getMcpRegistryCategories(token ?? ''),
      ]);
      setServers(reg?.servers ?? []);
      setCategories(cats ?? []);
      const version = reg?.registry_version ?? '';
      setRegVersion(version);

      // New-servers banner: compare against last seen version
      if (version) {
        const seen = localStorage.getItem(SEEN_VERSION_KEY);
        if (seen && seen !== version) {
          // Count servers not in installed set that weren't present before
          const newServers = (reg?.servers ?? []).filter((s) => !s.installed).length;
          if (newServers > 0) {
            setNewCount(newServers);
            setBannerVisible(true);
          }
        }
      }
    } catch {
      toast.error('Failed to load MCP marketplace');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const dismissBanner = () => {
    setBannerVisible(false);
    if (regVersion) localStorage.setItem(SEEN_VERSION_KEY, regVersion);
  };

  // Dismiss banner and save version on unmount / navigate away
  useEffect(() => {
    return () => {
      if (regVersion) localStorage.setItem(SEEN_VERSION_KEY, regVersion);
    };
  }, [regVersion]);

  const filtered = useMemo(() => {
    let list = servers;
    if (activeCategory !== ALL_LABEL) {
      list = list.filter((s) => s.category === activeCategory);
    }
    if (query.trim()) {
      const q = query.toLowerCase();
      list = list.filter(
        (s) =>
          s.name.toLowerCase().includes(q) ||
          s.description.toLowerCase().includes(q) ||
          (s.tags ?? []).some((t) => t.includes(q)),
      );
    }
    return list;
  }, [servers, activeCategory, query]);

  const handleAdd = (server: RegistryServer) => {
    setModalServer(server);
  };

  const confirmAdd = async (url: string, key: string) => {
    if (!modalServer) return;
    setAddingId(modalServer.id);
    setModalServer(null);
    try {
      const token = await getToken();
      const existing = await getToolServersConfig(token ?? '');
      const all = existing?.TOOL_SERVER_CONNECTIONS ?? [];
      const newConn: MCPServerConnection = {
        ...makeConnection(modalServer),
        url,
        key: key || undefined,
      };
      await setToolServersConfig(token ?? '', [...all, newConn] as MCPServerConnection[]);
      setServers((prev) =>
        prev.map((s) => (s.id === modalServer.id ? { ...s, installed: true } : s)),
      );
      toast.success(`${modalServer.name} added to Bodhion`);
    } catch {
      toast.error(`Failed to add ${modalServer?.name}`);
    } finally {
      setAddingId(null);
    }
  };

  const allCategories = [ALL_LABEL, ...categories.map((c) => c.category)];

  return (
    <div className="mp-root">
      {/* Header */}
      <div className="mp-page-header">
        <div className="mp-page-header-glow" />
        <div className="relative px-5 py-4 space-y-2">
          <div className="mp-eyebrow-badge">BODHION ADMIN</div>
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="mp-page-title">MCP Marketplace</h1>
              <p className="mp-page-desc mt-1">
                Browse curated MCP tool servers and add them to your Bodhion platform with one click.
              </p>
            </div>
            <div className="flex gap-2 flex-shrink-0 mt-1">
              <button
                type="button"
                className="mp-btn mp-btn--ghost mp-btn--sm"
                onClick={load}
                disabled={loading}
              >
                <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
                Refresh
              </button>
              <button
                type="button"
                className="mp-btn mp-btn--ghost mp-btn--sm"
                onClick={() => router.push('/admin/settings/mcp-servers')}
              >
                <Settings className="h-3.5 w-3.5" />
                Manage installed
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Tab switcher */}
      <div className="mp-tabs">
        <button
          type="button"
          className={`mp-tab-btn${tab === 'browse' ? ' mp-tab-btn--active' : ''}`}
          onClick={() => setTab('browse')}
        >
          Browse Servers
        </button>
        <button
          type="button"
          className={`mp-tab-btn${tab === 'build' ? ' mp-tab-btn--active' : ''}`}
          onClick={() => setTab('build')}
        >
          Build a Server
        </button>
      </div>

      {tab === 'build' && <BuildAServerGuide />}

      {tab === 'browse' && <>
      {/* New-servers banner */}
      {bannerVisible && (
        <NewServersBanner count={newCount} onDismiss={dismissBanner} />
      )}

      {/* Search */}
      <div className="mp-search-wrap">
        <Search className="mp-search-icon" />
        <input
          className="mp-search-input"
          type="search"
          placeholder="Search by name, description, or tag…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      <div className="mp-layout">
        {/* Category sidebar */}
        <aside className="mp-sidebar">
          <div className="mp-sidebar-title">Categories</div>
          {allCategories.map((cat) => {
            const count = cat === ALL_LABEL
              ? servers.length
              : (categories.find((c) => c.category === cat)?.count ?? 0);
            return (
              <button
                key={cat}
                type="button"
                className={`mp-cat-btn ${activeCategory === cat ? 'mp-cat-btn--active' : ''}`}
                onClick={() => setActiveCategory(cat)}
              >
                <span>{cat}</span>
                <span className="mp-cat-count">{count}</span>
              </button>
            );
          })}
        </aside>

        {/* Cards grid */}
        <div className="mp-grid-wrap">
          {loading ? (
            <div className="mp-loading">
              <Loader2 className="h-5 w-5 animate-spin" style={{ color: 'var(--bodhion-accent)' }} />
              Loading marketplace…
            </div>
          ) : filtered.length === 0 ? (
            <div className="mp-empty">
              No servers match your search.
            </div>
          ) : (
            <div className="mp-grid">
              {filtered.map((s) => (
                <ServerCard
                  key={s.id}
                  server={s}
                  adding={addingId === s.id}
                  onAdd={handleAdd}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Add modal */}
      {modalServer && (
        <AddModal
          server={modalServer}
          onConfirm={confirmAdd}
          onCancel={() => setModalServer(null)}
        />
      )}
      </>}

      <style>{`
        .mp-root {
          display: flex;
          flex-direction: column;
          gap: 1rem;
          padding: 1rem;
          min-height: 100%;
          color: var(--bodhion-text-primary);
        }

        /* ── Page header ── */
        .mp-page-header {
          position: relative;
          overflow: hidden;
          border-radius: 1.6rem;
          border: 1px solid rgba(255,255,255,0.1);
          background: var(--bodhion-shell-bg);
          backdrop-filter: blur(22px);
        }
        .mp-page-header-glow {
          position: absolute; inset: 0;
          background:
            linear-gradient(120deg, rgba(0,104,201,0.13), transparent 34%),
            linear-gradient(120deg, transparent 45%, rgba(37,215,255,0.11), transparent 72%);
          pointer-events: none;
        }
        .mp-eyebrow-badge {
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
        .mp-page-title {
          font-size: clamp(1.2rem, 1rem + 0.5vw, 1.85rem);
          font-weight: 800;
          line-height: 1.05;
          letter-spacing: -0.02em;
        }
        .mp-page-desc {
          font-size: 0.86rem;
          line-height: 1.55;
          color: var(--bodhion-text-secondary);
          max-width: 55rem;
        }

        /* ── New-servers banner ── */
        .mp-banner {
          display: flex;
          align-items: center;
          gap: 0.6rem;
          padding: 0.65rem 1rem;
          border-radius: 0.85rem;
          background: rgba(37,215,255,0.08);
          border: 1px solid rgba(37,215,255,0.2);
          font-size: 0.84rem;
          color: var(--bodhion-text-primary);
        }
        .mp-banner-icon { color: var(--bodhion-accent, #25d7ff); flex-shrink: 0; }
        .mp-banner-close {
          margin-left: auto;
          background: none; border: none; cursor: pointer;
          color: var(--bodhion-text-secondary);
          padding: 0.2rem;
          display: flex; align-items: center;
        }

        /* ── Search ── */
        .mp-search-wrap {
          position: relative;
          display: flex;
          align-items: center;
        }
        .mp-search-icon {
          position: absolute;
          left: 0.8rem;
          width: 1rem; height: 1rem;
          color: var(--bodhion-text-secondary);
          pointer-events: none;
        }
        .mp-search-input {
          width: 100%;
          padding: 0.6rem 1rem 0.6rem 2.5rem;
          border-radius: 0.9rem;
          border: 1px solid var(--bodhion-card-border, rgba(255,255,255,0.07));
          background: var(--bodhion-card-bg, rgba(8,22,42,0.55));
          color: var(--bodhion-text-primary);
          font-size: 0.88rem;
          outline: none;
        }
        .mp-search-input:focus { border-color: var(--bodhion-accent, #25d7ff); }

        /* ── Layout ── */
        .mp-layout {
          display: grid;
          grid-template-columns: 12rem 1fr;
          gap: 1rem;
          align-items: start;
        }
        @media (max-width: 640px) { .mp-layout { grid-template-columns: 1fr; } }

        /* ── Sidebar ── */
        .mp-sidebar {
          display: flex;
          flex-direction: column;
          gap: 0.2rem;
          padding: 0.6rem;
          border-radius: 1rem;
          border: 1px solid var(--bodhion-card-border, rgba(255,255,255,0.07));
          background: var(--bodhion-card-bg, rgba(8,22,42,0.55));
          position: sticky;
          top: 1rem;
        }
        .mp-sidebar-title {
          font-size: 0.72rem;
          font-weight: 700;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: var(--bodhion-text-secondary);
          padding: 0.3rem 0.4rem 0.5rem;
        }
        .mp-cat-btn {
          display: flex;
          align-items: center;
          justify-content: space-between;
          width: 100%;
          padding: 0.4rem 0.6rem;
          border-radius: 0.55rem;
          border: none;
          background: none;
          color: var(--bodhion-text-secondary);
          font-size: 0.82rem;
          cursor: pointer;
          text-align: left;
          transition: background 0.1s, color 0.1s;
        }
        .mp-cat-btn:hover { background: rgba(255,255,255,0.05); color: var(--bodhion-text-primary); }
        .mp-cat-btn--active { background: rgba(37,215,255,0.1); color: var(--bodhion-accent, #25d7ff); font-weight: 600; }
        .mp-cat-count {
          font-size: 0.72rem;
          padding: 0.05rem 0.4rem;
          border-radius: 999px;
          background: rgba(255,255,255,0.07);
        }

        /* ── Grid ── */
        .mp-grid-wrap { min-width: 0; }
        .mp-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
          gap: 0.85rem;
        }
        .mp-loading, .mp-empty {
          display: flex;
          align-items: center;
          gap: 0.6rem;
          padding: 3rem 1rem;
          color: var(--bodhion-text-secondary);
          font-size: 0.85rem;
          justify-content: center;
        }

        /* ── Card ── */
        .mp-card {
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
          padding: 1.1rem;
          border-radius: 1.15rem;
          border: 1px solid var(--bodhion-card-border, rgba(255,255,255,0.07));
          background: var(--bodhion-card-bg, rgba(8,22,42,0.55));
          transition: border-color 0.15s, box-shadow 0.15s;
        }
        .mp-card:hover { border-color: rgba(37,215,255,0.2); box-shadow: 0 4px 24px rgba(0,0,0,0.22); }
        .mp-card--installed { border-color: rgba(34,197,94,0.18); }

        .mp-card-top {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 0.5rem;
        }
        .mp-card-icon { font-size: 1.8rem; line-height: 1; }
        .mp-card-badges { display: flex; flex-wrap: wrap; gap: 0.3rem; }

        .mp-card-body { display: flex; flex-direction: column; gap: 0.25rem; }
        .mp-card-name { font-size: 0.95rem; font-weight: 700; margin: 0; }
        .mp-card-desc {
          font-size: 0.78rem;
          line-height: 1.5;
          color: var(--bodhion-text-secondary);
          margin: 0;
          display: -webkit-box;
          -webkit-box-orient: vertical;
          -webkit-line-clamp: 3;
          overflow: hidden;
        }

        .mp-card-tags { display: flex; flex-wrap: wrap; gap: 0.3rem; }
        .mp-tag {
          font-size: 0.68rem;
          padding: 0.1rem 0.4rem;
          border-radius: 999px;
          background: rgba(255,255,255,0.05);
          color: var(--bodhion-text-secondary);
          border: 1px solid rgba(255,255,255,0.07);
        }

        .mp-card-footer {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-top: auto;
          padding-top: 0.5rem;
          border-top: 1px solid rgba(255,255,255,0.05);
        }
        .mp-link {
          display: inline-flex;
          align-items: center;
          gap: 0.2rem;
          font-size: 0.75rem;
          color: var(--bodhion-text-secondary);
          text-decoration: none;
        }
        .mp-link:hover { color: var(--bodhion-accent); }

        /* ── Chips ── */
        .mp-chip {
          display: inline-flex;
          align-items: center;
          padding: 0.15rem 0.5rem;
          border-radius: 999px;
          font-size: 0.68rem;
          font-weight: 600;
          border: 1px solid transparent;
        }
        .mp-chip--oauth    { background: rgba(139,92,246,0.12); color: #a78bfa; border-color: rgba(139,92,246,0.22); }
        .mp-chip--key      { background: rgba(251,191,36,0.1);  color: #fbbf24; border-color: rgba(251,191,36,0.2);  }
        .mp-chip--none     { background: rgba(255,255,255,0.05); color: var(--bodhion-text-secondary); border-color: rgba(255,255,255,0.08); }
        .mp-chip--verified { background: rgba(34,197,94,0.1);   color: #4ade80; border-color: rgba(34,197,94,0.2);  }
        .mp-chip--bundled  { background: rgba(37,215,255,0.1);  color: var(--bodhion-accent, #25d7ff); border-color: rgba(37,215,255,0.22); }

        .mp-card--bundled  { border-color: rgba(37,215,255,0.14); }
        .mp-card--bundled:hover { border-color: rgba(37,215,255,0.3); }

        .mp-bundled-note {
          padding: 0.75rem;
          border-radius: 0.7rem;
          background: rgba(37,215,255,0.06);
          border: 1px solid rgba(37,215,255,0.15);
        }

        /* ── Buttons ── */
        .mp-btn {
          display: inline-flex;
          align-items: center;
          gap: 0.35rem;
          padding: 0.38rem 0.85rem;
          border-radius: 0.65rem;
          font-size: 0.8rem;
          font-weight: 600;
          cursor: pointer;
          border: 1px solid transparent;
          background: var(--bodhion-accent, #25d7ff);
          color: #001a2c;
          transition: opacity 0.15s;
          white-space: nowrap;
        }
        .mp-btn:disabled { opacity: 0.5; cursor: not-allowed; }
        .mp-btn:hover:not(:disabled) { opacity: 0.88; }
        .mp-btn--ghost {
          background: rgba(255,255,255,0.05);
          color: var(--bodhion-text-secondary);
          border-color: rgba(255,255,255,0.08);
        }
        .mp-btn--ghost:hover:not(:disabled) { background: rgba(255,255,255,0.09); }
        .mp-btn--sm { padding: 0.3rem 0.7rem; font-size: 0.76rem; }
        .mp-btn--primary {
          background: var(--bodhion-accent, #25d7ff);
          color: #001a2c;
        }

        .mp-add-btn {
          display: inline-flex;
          align-items: center;
          gap: 0.3rem;
          padding: 0.3rem 0.75rem;
          border-radius: 0.55rem;
          font-size: 0.78rem;
          font-weight: 600;
          cursor: pointer;
          border: 1px solid rgba(37,215,255,0.3);
          background: rgba(37,215,255,0.08);
          color: var(--bodhion-accent, #25d7ff);
          transition: background 0.15s;
          white-space: nowrap;
        }
        .mp-add-btn:hover:not(:disabled) { background: rgba(37,215,255,0.14); }
        .mp-add-btn:disabled { opacity: 0.5; cursor: not-allowed; }

        .mp-installed-badge {
          display: inline-flex;
          align-items: center;
          gap: 0.3rem;
          font-size: 0.78rem;
          font-weight: 600;
          color: #4ade80;
        }

        /* ── Modal ── */
        .mp-modal-backdrop {
          position: fixed;
          inset: 0;
          background: rgba(0,0,0,0.6);
          backdrop-filter: blur(4px);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
          padding: 1rem;
        }
        .mp-modal {
          width: 100%;
          max-width: 28rem;
          border-radius: 1.4rem;
          border: 1px solid rgba(255,255,255,0.1);
          background: var(--bodhion-shell-bg);
          backdrop-filter: blur(24px);
          box-shadow: 0 32px 80px rgba(0,0,0,0.5);
          overflow: hidden;
        }
        .mp-modal-header {
          display: flex;
          align-items: flex-start;
          gap: 0.8rem;
          padding: 1.25rem 1.25rem 0.75rem;
          border-bottom: 1px solid rgba(255,255,255,0.06);
        }
        .mp-modal-icon { font-size: 1.6rem; flex-shrink: 0; }
        .mp-modal-title { font-size: 1rem; font-weight: 700; margin: 0; }
        .mp-modal-sub { font-size: 0.78rem; color: var(--bodhion-text-secondary); margin: 0.15rem 0 0; }
        .mp-modal-close {
          margin-left: auto;
          flex-shrink: 0;
          background: none; border: none; cursor: pointer;
          color: var(--bodhion-text-secondary);
          padding: 0.2rem;
          display: flex; align-items: center;
        }
        .mp-modal-body { display: flex; flex-direction: column; gap: 0.85rem; padding: 1.25rem; }
        .mp-modal-footer {
          display: flex;
          justify-content: flex-end;
          gap: 0.5rem;
          padding: 0.85rem 1.25rem;
          border-top: 1px solid rgba(255,255,255,0.06);
        }
        .mp-field { display: flex; flex-direction: column; gap: 0.35rem; }
        .mp-label { font-size: 0.8rem; font-weight: 600; color: var(--bodhion-text-primary); }
        .mp-required { color: #f87171; }
        .mp-hint { font-size: 0.74rem; color: var(--bodhion-text-secondary); margin: 0; }
        .mp-input {
          padding: 0.45rem 0.75rem;
          border-radius: 0.6rem;
          border: 1px solid rgba(255,255,255,0.1);
          background: rgba(0,0,0,0.25);
          color: var(--bodhion-text-primary);
          font-size: 0.83rem;
          outline: none;
          width: 100%;
        }
        .mp-input:focus { border-color: var(--bodhion-accent, #25d7ff); }
        .mp-oauth-note {
          font-size: 0.78rem;
          padding: 0.6rem 0.8rem;
          border-radius: 0.7rem;
          background: rgba(139,92,246,0.08);
          border: 1px solid rgba(139,92,246,0.18);
          color: var(--bodhion-text-secondary);
          line-height: 1.5;
        }

        /* ── Tab switcher ── */
        .mp-tabs {
          display: flex;
          gap: 0.25rem;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.09);
          border-radius: 0.75rem;
          padding: 0.2rem;
          width: fit-content;
        }
        .mp-tab-btn {
          font-size: 0.82rem;
          font-weight: 600;
          padding: 0.35rem 1rem;
          border-radius: 0.55rem;
          border: none;
          background: transparent;
          color: var(--bodhion-text-secondary);
          cursor: pointer;
          transition: background 0.15s, color 0.15s;
        }
        .mp-tab-btn:hover { color: var(--bodhion-text-primary); background: rgba(255,255,255,0.06); }
        .mp-tab-btn--active { background: var(--bodhion-accent, #25d7ff); color: #000; }

        /* ── Build a Server guide ── */
        .mp-guide {
          display: flex;
          flex-direction: column;
          gap: 1.25rem;
        }
        .mp-guide-hero {
          border: 1px solid var(--bodhion-card-border);
          border-radius: 1rem;
          background: var(--bodhion-card-bg);
          padding: 1.4rem 1.6rem;
        }
        .mp-guide-hero-title {
          font-size: 1.15rem;
          font-weight: 800;
          color: var(--bodhion-text-primary);
          margin-bottom: 0.5rem;
        }
        .mp-guide-hero-desc {
          font-size: 0.88rem;
          color: var(--bodhion-text-secondary);
          line-height: 1.65;
          max-width: 70ch;
        }
        .mp-guide-hero-badges {
          display: flex;
          gap: 0.4rem;
          flex-wrap: wrap;
          margin-top: 0.8rem;
        }
        .mp-guide-badge {
          font-size: 0.7rem;
          font-weight: 700;
          padding: 0.18rem 0.55rem;
          border-radius: 999px;
          background: rgba(37,215,255,0.1);
          color: rgba(37,215,255,0.9);
          border: 1px solid rgba(37,215,255,0.2);
        }
        .mp-guide-body {
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }
        .mp-guide-section {
          border: 1px solid var(--bodhion-card-border);
          border-radius: 1rem;
          background: var(--bodhion-card-bg);
          padding: 1rem 1.25rem;
        }
        .mp-guide-h2 {
          font-size: 0.95rem;
          font-weight: 700;
          color: var(--bodhion-text-primary);
          margin-bottom: 0.65rem;
        }
        .mp-guide-p {
          font-size: 0.84rem;
          color: var(--bodhion-text-secondary);
          line-height: 1.65;
          margin-bottom: 0.65rem;
        }
        .mp-guide-p:last-child { margin-bottom: 0; }
        .mp-code-block {
          background: rgba(0,0,0,0.35);
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 0.6rem;
          padding: 0.75rem 1rem;
          font-size: 0.78rem;
          font-family: 'JetBrains Mono', 'Fira Code', monospace;
          color: #e2e8f0;
          overflow-x: auto;
          margin: 0.5rem 0;
          white-space: pre;
        }
        .mp-inline-code {
          background: rgba(255,255,255,0.08);
          border-radius: 0.3rem;
          padding: 0.1rem 0.35rem;
          font-size: 0.8em;
          font-family: 'JetBrains Mono', 'Fira Code', monospace;
          color: rgba(37,215,255,0.9);
        }
        .mp-guide-table-wrap { overflow-x: auto; margin: 0.5rem 0; }
        .mp-guide-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 0.82rem;
        }
        .mp-guide-table th {
          text-align: left;
          font-size: 0.72rem;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          color: var(--bodhion-text-secondary);
          padding: 0.4rem 0.75rem;
          border-bottom: 1px solid var(--bodhion-card-border);
        }
        .mp-guide-table td {
          padding: 0.45rem 0.75rem;
          border-bottom: 1px solid rgba(255,255,255,0.04);
          color: var(--bodhion-text-primary);
        }
        .mp-guide-table tr:last-child td { border-bottom: none; }
        .mp-guide-ol {
          margin: 0.4rem 0 0.65rem 1.2rem;
          display: flex;
          flex-direction: column;
          gap: 0.4rem;
          font-size: 0.84rem;
          color: var(--bodhion-text-secondary);
          line-height: 1.6;
        }
      `}</style>
    </div>
  );
}
