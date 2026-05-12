'use client';

import { SettingsSection, SettingsField, SettingsToggleRow } from '@/components/shared/SettingsSection';

const FIELD = 'admin-input h-9 w-full rounded-[0.85rem] px-3 text-sm';

interface Props {
  config:  Record<string, unknown>;
  set:     (key: string, value: unknown) => void;
  onSave:  () => void;
  saving:  boolean;
}

export function OverlayConfig({ config, set, onSave, saving }: Props) {
  const showAdmin    = !!config.SHOW_ADMIN_DETAILS;
  const enableKeys   = !!config.ENABLE_API_KEYS;
  const keysRestrict = !!config.ENABLE_API_KEYS_ENDPOINT_RESTRICTIONS;

  return (
    <SettingsSection
      title="Account Overlay & API Keys"
      eyebrow="Access"
      description="Pending user overlay content and API key access controls."
      onSave={onSave}
      saving={saving}
    >
      <SettingsToggleRow
        label="Show Admin Details in Account Pending Overlay"
        checked={showAdmin}
        onChange={(v) => set('SHOW_ADMIN_DETAILS', v)}
      />

      {showAdmin && (
        <SettingsField label="Admin Contact Email" description="Leave empty to use first admin user.">
          <input
            type="email"
            value={String(config.ADMIN_EMAIL ?? '')}
            onChange={(e) => set('ADMIN_EMAIL', e.target.value)}
            placeholder="Leave empty to use first admin user"
            className={FIELD}
          />
        </SettingsField>
      )}

      <SettingsField label="Pending User Overlay Title" description="Leave empty for default.">
        <textarea
          rows={2}
          value={String(config.PENDING_USER_OVERLAY_TITLE ?? '')}
          onChange={(e) => set('PENDING_USER_OVERLAY_TITLE', e.target.value)}
          placeholder="Enter a title for the pending user info overlay. Leave empty for default."
          className="admin-input w-full rounded-[0.85rem] px-3 py-2 text-sm"
        />
      </SettingsField>

      <SettingsField label="Pending User Overlay Content" description="Leave empty for default.">
        <textarea
          rows={3}
          value={String(config.PENDING_USER_OVERLAY_CONTENT ?? '')}
          onChange={(e) => set('PENDING_USER_OVERLAY_CONTENT', e.target.value)}
          placeholder="Enter content for the pending user info overlay. Leave empty for default."
          className="admin-input w-full rounded-[0.85rem] px-3 py-2 text-sm"
        />
      </SettingsField>

      <SettingsToggleRow
        label="Enable API Keys"
        description="Allow users to generate personal API keys."
        checked={enableKeys}
        onChange={(v) => set('ENABLE_API_KEYS', v)}
      />

      {enableKeys && (
        <>
          <SettingsToggleRow
            label="API Key Endpoint Restrictions"
            description="Restrict which API endpoints are accessible with API keys."
            checked={keysRestrict}
            onChange={(v) => set('ENABLE_API_KEYS_ENDPOINT_RESTRICTIONS', v)}
          />

          {keysRestrict && (
            <SettingsField
              label="Allowed Endpoints"
              description="Comma-separated list. e.g. /api/v1/messages, /api/v1/channels"
            >
              <input
                type="text"
                value={String(config.API_KEYS_ALLOWED_ENDPOINTS ?? '')}
                onChange={(e) => set('API_KEYS_ALLOWED_ENDPOINTS', e.target.value)}
                placeholder="/api/v1/messages, /api/v1/channels"
                className={FIELD}
              />
            </SettingsField>
          )}
        </>
      )}
    </SettingsSection>
  );
}

export default OverlayConfig;
