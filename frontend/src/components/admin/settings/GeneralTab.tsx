'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { getToken } from '@/lib/auth/session';
import { SettingsSection, SettingsField, SettingsToggleRow } from '@/components/shared/SettingsSection';
import {
  getAdminConfig,
  updateAdminConfig,
  getWebhookUrl,
  updateWebhookUrl,
  getVersionUpdates,
  getBanners,
  setBanners,
  getGroups,
  getLdapConfig,
  updateLdapConfig,
  getLdapServer,
  updateLdapServer,
  defaultLdapServer,
  type Banner,
  type Group,
  type LdapServerConfig,
} from '@/lib/api/admin/settings';
import { OverlayConfig }       from './general/OverlayConfig';
import { FeaturesConfig }      from './general/FeaturesConfig';
import { BannersConfig }       from './general/BannersConfig';
import { LdapConfig }          from './general/LdapConfig';
import { AdminLoadingSplash }  from '@/components/admin/AdminLoadingSplash';

const FIELD = 'admin-input h-9 w-full rounded-[0.85rem] px-3 text-sm';

export function GeneralTab() {
  const [loading,    setLoading]    = useState(true);
  const [saving,     setSaving]     = useState(false);
  const [config,     setConfig]     = useState<Record<string, unknown>>({});
  const [webhook,    setWebhook]    = useState('');
  const [version,    setVersion]    = useState<{ current: string; latest: string } | null>(null);
  const [groups,      setGroups]      = useState<Group[]>([]);
  const [bannerList,  setBannerList]  = useState<Banner[]>([]);
  const [ldapEnabled, setLdapEnabled] = useState(false);
  const [ldapServer,  setLdapServer]  = useState<LdapServerConfig>(defaultLdapServer());
  const [ldapSaving,  setLdapSaving]  = useState(false);

  useEffect(() => {
    const token = getToken();
    if (!token) return;
    Promise.all([
      getAdminConfig(token),
      getWebhookUrl(token).catch(() => ''),
      getVersionUpdates(token).catch(() => null),
      getGroups(token).catch(() => []),
      getBanners(token).catch(() => []),
      getLdapConfig(token).catch(() => ({ ENABLE_LDAP: false })),
      getLdapServer(token).catch(() => defaultLdapServer()),
    ]).then(([cfg, wh, ver, grps, bans, ldapCfg, ldapSrv]) => {
      setConfig((cfg as Record<string, unknown>) ?? {});
      setWebhook((wh as { url: string })?.url ?? '');
      setVersion(ver);
      setGroups((grps as Group[]) ?? []);
      setBannerList((bans as Banner[]) ?? []);
      setLdapEnabled(!!(ldapCfg as { ENABLE_LDAP: boolean }).ENABLE_LDAP);
      setLdapServer((ldapSrv as LdapServerConfig) ?? defaultLdapServer());
    }).finally(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    const token = getToken();
    if (!token) return;
    setSaving(true);
    try {
      await Promise.all([
        updateAdminConfig(token, config),
        updateWebhookUrl(token, webhook),
        setBanners(token, bannerList),
      ]);
      toast.success('Settings saved');
    } catch {
      toast.error('Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const set = (key: string, value: unknown) =>
    setConfig((prev) => ({ ...prev, [key]: value }));

  const handleLdapSave = async () => {
    const token = getToken();
    if (!token) return;
    setLdapSaving(true);
    try {
      await updateLdapConfig(token, ldapEnabled);
      if (ldapEnabled) {
        await updateLdapServer(token, ldapServer);
      }
      toast.success('LDAP settings saved');
    } catch {
      toast.error('Failed to save LDAP settings');
    } finally {
      setLdapSaving(false);
    }
  };

  if (loading) return <AdminLoadingSplash title="Loading settings…" subtitle="Fetching platform configuration" minHeight="420px" />;

  const updateAvailable =
    version && version.latest && version.current &&
    version.latest !== version.current;

  return (
    <div className="flex flex-col gap-5">

      {/* ── Platform identity summary cards ──────────────────────────────── */}
      <div className="bodhion-summary-row">
        {/* Card 1: Platform identity */}
        <div className="bodhion-summary-card bodhion-platform-card">
          <div className="bodhion-platform-logo-row">
            {/* Dark logo (default) */}
            <img
              src="/static/logo-bodhion-dark.jpeg"
              alt="Bodhion"
              className="bodhion-logo bodhion-logo--dark"
            />
            {/* Light logo */}
            <img
              src="/static/logo-bodhion-light.jpeg"
              alt="Bodhion"
              className="bodhion-logo bodhion-logo--light"
            />
            <span className="bodhion-platform-name">Bodhion</span>
          </div>
          <p className="bodhion-platform-tagline">Enterprise AI Platform</p>
          <div className="bodhion-version-row">
            <span className="bodhion-version-badge">
              v{version?.current ?? '—'}
            </span>
            <span className="bodhion-summary-hint">
              {updateAvailable
                ? `v${version?.latest} available`
                : 'Latest release'}
            </span>
          </div>
        </div>

        {/* Card 2: Signups */}
        <div className="bodhion-summary-card">
          <div className="bodhion-summary-label">Signups</div>
          <div className="bodhion-summary-value">
            {config.ENABLE_SIGNUP ? 'Open' : 'Restricted'}
          </div>
          <div className="bodhion-summary-hint">
            Default role: {String(config.DEFAULT_USER_ROLE ?? '—')}
          </div>
        </div>

        {/* Card 3: API Keys */}
        <div className="bodhion-summary-card">
          <div className="bodhion-summary-label">API Keys</div>
          <div className="bodhion-summary-value">
            {config.ENABLE_API_KEYS ? 'Enabled' : 'Disabled'}
          </div>
          <div className="bodhion-summary-hint">
            {config.ENABLE_API_KEYS_ENDPOINT_RESTRICTIONS
              ? 'Endpoint restrictions on'
              : 'No endpoint restrictions'}
          </div>
        </div>
      </div>

      {/* ── Overview ─────────────────────────────────────────────────────── */}
      <SettingsSection
        title="Overview"
        eyebrow="Platform"
        description="Platform status, support resources, and license information at a glance."
      >
        {/* Version row */}
        <div className="bodhion-overview-row">
          <div>
            <div className="bodhion-field-label">Version</div>
            <div className="bodhion-field-desc">
              Current: <strong style={{ color: 'var(--bodhion-text-primary)' }}>v{version?.current ?? '—'}</strong>
              {updateAvailable && (
                <span className="bodhion-update-pill">v{version?.latest} available</span>
              )}
            </div>
          </div>
        </div>

        {/* Support & Resources row */}
        <div className="bodhion-overview-row">
          <div>
            <div className="bodhion-field-label">Support &amp; Resources</div>
            <div className="bodhion-field-desc">
              Access Bodhion documentation, release notes, and support.
            </div>
          </div>
          <a
            href="mailto:t.mondal25@gmail.com"
            className="bodhion-resource-link"
          >
            Contact
          </a>
        </div>

        {/* License row */}
        <div className="bodhion-overview-row">
          <div>
            <div className="bodhion-field-label">License</div>
            <div className="bodhion-field-desc">
              Bodhion Enterprise license. Contact your administrator for licensing information.
            </div>
          </div>
        </div>
      </SettingsSection>

      {/* ── Authentication ────────────────────────────────────────────────── */}
      <SettingsSection
        title="Authentication"
        eyebrow="Security"
        description="Default access rules, onboarding policy, and JWT session settings."
        onSave={handleSave}
        saving={saving}
      >
        <SettingsField label="Default User Role" description="Role assigned to new sign-ups.">
          <select
            value={String(config.DEFAULT_USER_ROLE ?? 'pending')}
            onChange={(e) => set('DEFAULT_USER_ROLE', e.target.value)}
            className="admin-select h-9 w-full rounded-[0.85rem] px-3 text-sm"
          >
            {['pending', 'user', 'admin'].map((r) => (
              <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>
            ))}
          </select>
        </SettingsField>

        <SettingsField label="Default Group" description="Group automatically assigned to new sign-ups.">
          <select
            value={String(config.DEFAULT_GROUP_ID ?? '')}
            onChange={(e) => set('DEFAULT_GROUP_ID', e.target.value)}
            className="admin-select h-9 w-full rounded-[0.85rem] px-3 text-sm"
          >
            <option value="">None</option>
            {groups.map((g) => (
              <option key={g.id} value={g.id}>{g.name}</option>
            ))}
          </select>
        </SettingsField>

        <SettingsToggleRow
          label="Enable New Sign-ups"
          description="Allow new users to register."
          checked={!!config.ENABLE_SIGNUP}
          onChange={(v) => set('ENABLE_SIGNUP', v)}
        />

        <SettingsField label="JWT Expiry" description="e.g. 1h, 24h, 7d, -1 (never)">
          <input
            type="text"
            value={String(config.JWT_EXPIRES_IN ?? '')}
            onChange={(e) => set('JWT_EXPIRES_IN', e.target.value)}
            placeholder="-1"
            className={FIELD}
          />
          {String(config.JWT_EXPIRES_IN) === '-1' && (
            <p className="mt-1 rounded-lg px-3 py-2 text-xs bg-yellow-500/20 text-yellow-700 dark:text-yellow-200">
              Warning: No expiration can pose security risks.
            </p>
          )}
        </SettingsField>
      </SettingsSection>

      {/* ── Account Overlay & API Keys ────────────────────────────────────── */}
      <OverlayConfig config={config} set={set} onSave={handleSave} saving={saving} />

      {/* ── Features ─────────────────────────────────────────────────────── */}
      <FeaturesConfig
        config={config}
        set={set}
        webhook={webhook}
        onWebhookChange={setWebhook}
        onSave={handleSave}
        saving={saving}
      />

      {/* ── Banners ───────────────────────────────────────────────────────── */}
      <BannersConfig
        banners={bannerList}
        onChange={setBannerList}
        onSave={handleSave}
        saving={saving}
      />

      {/* ── LDAP ──────────────────────────────────────────────────────────── */}
      <LdapConfig
        enabled={ldapEnabled}
        server={ldapServer}
        onToggle={setLdapEnabled}
        onServer={setLdapServer}
        onSave={handleLdapSave}
        saving={ldapSaving}
      />

      <style>{`
        /* Summary row */
        .bodhion-summary-row {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
          gap: 0.85rem;
        }
        .bodhion-summary-card {
          display: flex;
          flex-direction: column;
          gap: 0.28rem;
          padding: 0.9rem 1rem;
          border-radius: 1rem;
          border: 1px solid var(--bodhion-card-border);
          background: var(--bodhion-card-bg);
          min-height: 88px;
        }
        .bodhion-summary-label {
          font-size: 0.7rem;
          letter-spacing: 0.09em;
          text-transform: uppercase;
          color: var(--bodhion-text-secondary);
          font-weight: 600;
        }
        .bodhion-summary-value {
          font-size: 1rem;
          font-weight: 700;
          color: var(--bodhion-text-primary);
          line-height: 1.2;
        }
        .bodhion-summary-hint {
          font-size: 0.78rem;
          color: var(--bodhion-text-secondary);
        }

        /* Platform card internals */
        .bodhion-platform-card { gap: 0.42rem !important; justify-content: center; }
        .bodhion-platform-logo-row {
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }
        .bodhion-logo {
          width: 26px;
          height: 26px;
          border-radius: 6px;
          object-fit: contain;
          flex-shrink: 0;
        }
        /* Dark-mode: show dark logo, hide light logo */
        .bodhion-logo--light { display: none; }
        html.light .bodhion-logo--dark,
        html.bodhion-light .bodhion-logo--dark { display: none; }
        html.light .bodhion-logo--light,
        html.bodhion-light .bodhion-logo--light { display: block; }

        .bodhion-platform-name {
          font-size: 1rem;
          font-weight: 800;
          letter-spacing: -0.01em;
          color: var(--bodhion-text-primary);
          line-height: 1;
        }
        .bodhion-platform-tagline {
          font-size: 0.7rem;
          color: var(--bodhion-text-secondary);
          letter-spacing: 0.02em;
          line-height: 1.3;
        }
        .bodhion-version-row {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          margin-top: 0.05rem;
        }
        .bodhion-version-badge {
          display: inline-flex;
          align-items: center;
          padding: 0.12rem 0.48rem;
          border-radius: 999px;
          border: 1px solid var(--bodhion-accent, #25d7ff);
          background: rgba(37, 215, 255, 0.08);
          color: var(--bodhion-accent, #25d7ff);
          font-size: 0.68rem;
          font-weight: 700;
          letter-spacing: 0.04em;
          flex-shrink: 0;
        }

        /* Overview section rows */
        .bodhion-overview-row {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 1rem;
          padding: 0.55rem 0;
          border-bottom: 1px solid var(--bodhion-card-border);
        }
        .bodhion-overview-row:last-child { border-bottom: none; }
        .bodhion-field-label {
          font-size: 0.82rem;
          font-weight: 600;
          color: var(--bodhion-text-primary);
          margin-bottom: 0.18rem;
        }
        .bodhion-field-desc {
          font-size: 0.78rem;
          color: var(--bodhion-text-secondary);
          line-height: 1.5;
        }
        .bodhion-update-pill {
          display: inline-flex;
          margin-left: 0.5rem;
          padding: 0.1rem 0.45rem;
          border-radius: 999px;
          background: rgba(251, 146, 60, 0.15);
          border: 1px solid rgba(251, 146, 60, 0.35);
          color: rgb(251, 146, 60);
          font-size: 0.7rem;
          font-weight: 600;
        }
        .bodhion-resource-link {
          display: inline-flex;
          align-items: center;
          flex-shrink: 0;
          padding: 0.3rem 0.8rem;
          border-radius: 999px;
          border: 1px solid var(--bodhion-card-border);
          background: rgba(255, 255, 255, 0.04);
          color: var(--bodhion-text-secondary);
          font-size: 0.76rem;
          font-weight: 600;
          text-decoration: none;
          transition: border-color 0.15s ease, color 0.15s ease, background 0.15s ease;
          white-space: nowrap;
        }
        .bodhion-resource-link:hover {
          border-color: var(--bodhion-accent, #25d7ff);
          color: var(--bodhion-accent, #25d7ff);
          background: rgba(37, 215, 255, 0.07);
        }
      `}</style>
    </div>
  );
}


export default GeneralTab;
