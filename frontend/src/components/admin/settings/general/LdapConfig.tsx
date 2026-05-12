'use client';

import { SettingsSection, SettingsField, SettingsToggleRow } from '@/components/shared/SettingsSection';
import { SensitiveInput } from '@/components/shared/SensitiveInput';
import type { LdapServerConfig } from '@/lib/api/admin/settings';

const FIELD = 'admin-input h-9 w-full rounded-[0.85rem] px-3 text-sm';

interface Props {
  enabled:  boolean;
  server:   LdapServerConfig;
  onToggle: (v: boolean) => void;
  onServer: (updated: LdapServerConfig) => void;
  onSave:   () => void;
  saving:   boolean;
}

export function LdapConfig({ enabled, server, onToggle, onServer, onSave, saving }: Props) {
  const set = <K extends keyof LdapServerConfig>(key: K, value: LdapServerConfig[K]) =>
    onServer({ ...server, [key]: value });

  return (
    <SettingsSection
      title="LDAP / Active Directory"
      eyebrow="Enterprise Auth"
      description="Authenticate users against a corporate LDAP or Active Directory server."
      onSave={onSave}
      saving={saving}
    >
      <SettingsToggleRow
        label="Enable LDAP Authentication"
        description="When enabled, users can sign in with their LDAP credentials."
        checked={enabled}
        onChange={onToggle}
      />

      {enabled && (
        <div className="ldap-grid">

          {/* ── Connection ─────────────────────────────────────────────────── */}
          <div className="ldap-group ldap-group--wide">
            <div className="ldap-group-title">Connection</div>

            <SettingsField label="Server Label" description="Friendly name shown on the login page.">
              <input
                type="text"
                value={server.label}
                onChange={(e) => set('label', e.target.value)}
                placeholder="Corporate LDAP"
                className={FIELD}
                required
              />
            </SettingsField>

            <div className="grid grid-cols-2 gap-3">
              <SettingsField label="Host" description="Hostname or IP of the LDAP server.">
                <input
                  type="text"
                  value={server.host}
                  onChange={(e) => set('host', e.target.value)}
                  placeholder="ldap.example.com"
                  className={FIELD}
                  required
                />
              </SettingsField>

              <SettingsField label="Port" description="Default: 389, or 636 with TLS.">
                <input
                  type="number"
                  value={server.port ?? ''}
                  onChange={(e) =>
                    set('port', e.target.value === '' ? null : parseInt(e.target.value))
                  }
                  placeholder="389"
                  className={FIELD}
                />
              </SettingsField>
            </div>
          </div>

          {/* ── Bind Credentials ───────────────────────────────────────────── */}
          <div className="ldap-group ldap-group--wide">
            <div className="ldap-group-title">Bind Credentials</div>

            <div className="grid grid-cols-2 gap-3">
              <SettingsField label="Application DN" description="The DN used to bind for searches.">
                <input
                  type="text"
                  value={server.app_dn}
                  onChange={(e) => set('app_dn', e.target.value)}
                  placeholder="cn=svc-bodhion,dc=example,dc=com"
                  className={FIELD}
                />
              </SettingsField>

              <SettingsField label="Application DN Password">
                <SensitiveInput
                  value={server.app_dn_password}
                  onChange={(v) => set('app_dn_password', v)}
                  placeholder="Bind password"
                />
              </SettingsField>
            </div>
          </div>

          {/* ── Search ─────────────────────────────────────────────────────── */}
          <div className="ldap-group ldap-group--wide">
            <div className="ldap-group-title">Search</div>

            <SettingsField
              label="Search Base"
              description="The DN to search for users."
            >
              <input
                type="text"
                value={server.search_base}
                onChange={(e) => set('search_base', e.target.value)}
                placeholder="ou=users,dc=example,dc=com"
                className={FIELD}
                required
              />
            </SettingsField>

            <SettingsField
              label="Search Filters"
              description="Optional LDAP filter. e.g. (&(objectClass=inetOrgPerson)(uid=%s))"
            >
              <input
                type="text"
                value={server.search_filters}
                onChange={(e) => set('search_filters', e.target.value)}
                placeholder="(&(objectClass=inetOrgPerson)(uid=%s))"
                className={FIELD}
              />
            </SettingsField>
          </div>

          {/* ── Attribute Mapping ──────────────────────────────────────────── */}
          <div className="ldap-group">
            <div className="ldap-group-title">Attribute Mapping</div>
            <div className="ldap-group-desc">Map LDAP attributes to Bodhion user fields.</div>

            <SettingsField
              label="Attribute for Mail"
              description="LDAP attribute that contains the user's email address."
            >
              <input
                type="text"
                value={server.attribute_for_mail}
                onChange={(e) => set('attribute_for_mail', e.target.value)}
                placeholder="mail"
                className={FIELD}
                required
              />
            </SettingsField>

            <SettingsField
              label="Attribute for Username"
              description="LDAP attribute used as the login username."
            >
              <input
                type="text"
                value={server.attribute_for_username}
                onChange={(e) => set('attribute_for_username', e.target.value)}
                placeholder="uid"
                className={FIELD}
                required
              />
            </SettingsField>
          </div>

          {/* ── TLS ────────────────────────────────────────────────────────── */}
          <div className="ldap-group">
            <div className="ldap-group-title">TLS / Security</div>
            <div className="ldap-group-desc">Encrypt LDAP traffic with TLS.</div>

            <SettingsToggleRow
              label="Use TLS"
              checked={server.use_tls}
              onChange={(v) => set('use_tls', v)}
            />

            {server.use_tls && (
              <>
                <SettingsField label="Certificate Path" description="Path to CA certificate file on the server.">
                  <input
                    type="text"
                    value={server.certificate_path ?? ''}
                    onChange={(e) => set('certificate_path', e.target.value || null)}
                    placeholder="/etc/ssl/certs/ldap-ca.pem"
                    className={FIELD}
                  />
                </SettingsField>

                <SettingsToggleRow
                  label="Validate Certificate"
                  description="Reject connections with invalid or self-signed certificates."
                  checked={server.validate_cert}
                  onChange={(v) => set('validate_cert', v)}
                />

                <SettingsField label="Ciphers" description="OpenSSL cipher string. Default: ALL.">
                  <input
                    type="text"
                    value={server.ciphers ?? ''}
                    onChange={(e) => set('ciphers', e.target.value || null)}
                    placeholder="ALL"
                    className={FIELD}
                  />
                </SettingsField>
              </>
            )}
          </div>

        </div>
      )}

      <style>{`
        .ldap-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 0.9rem;
        }
        .ldap-group {
          display: flex;
          flex-direction: column;
          gap: 0.85rem;
          padding: 1rem;
          border-radius: 1.1rem;
          border: 1px solid var(--bodhion-card-border);
          background: var(--bodhion-card-bg);
          box-shadow:
            inset 0 1px 0 rgba(255,255,255,0.025),
            0 8px 20px rgba(0,0,0,0.1);
        }
        .ldap-group--wide {
          grid-column: 1 / -1;
        }
        .ldap-group-title {
          font-size: 0.78rem;
          font-weight: 700;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: var(--bodhion-accent, #25d7ff);
        }
        .ldap-group-desc {
          font-size: 0.76rem;
          line-height: 1.45;
          color: var(--bodhion-text-secondary);
          margin-top: -0.35rem;
        }
        @media (max-width: 860px) {
          .ldap-grid { grid-template-columns: 1fr; }
        }
      `}</style>
    </SettingsSection>
  );
}

export default LdapConfig;
