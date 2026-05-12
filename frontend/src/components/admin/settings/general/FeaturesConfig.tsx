'use client';

import { SettingsSection, SettingsField, SettingsToggleRow } from '@/components/shared/SettingsSection';

const FIELD = 'admin-input h-9 w-full rounded-[0.85rem] px-3 text-sm';

interface Props {
  config:          Record<string, unknown>;
  set:             (key: string, value: unknown) => void;
  webhook:         string;
  onWebhookChange: (v: string) => void;
  onSave:          () => void;
  saving:          boolean;
}

export function FeaturesConfig({ config, set, webhook, onWebhookChange, onSave, saving }: Props) {
  const foldersEnabled = !!config.ENABLE_FOLDERS;

  return (
    <SettingsSection
      title="Features"
      eyebrow="Experience"
      description="Toggle collaboration, memory, folders, and workspace capabilities for all users."
      onSave={onSave}
      saving={saving}
    >
      {/* ── 2-column feature group grid ── */}
      <div className="feat-grid">

        {/* Group 1: Workspace Features */}
        <div className="feat-group">
          <div className="feat-group-title">Workspace Features</div>
          <div className="feat-group-desc">Core collaboration and workspace controls for all users.</div>

          <SettingsToggleRow
            label="Community Sharing"
            description="Allow users to share content within the BODHION WORKSPACE."
            checked={!!config.ENABLE_COMMUNITY_SHARING}
            onChange={(v) => set('ENABLE_COMMUNITY_SHARING', v)}
          />
          <SettingsToggleRow
            label="Message Rating"
            checked={!!config.ENABLE_MESSAGE_RATING}
            onChange={(v) => set('ENABLE_MESSAGE_RATING', v)}
          />
          <SettingsToggleRow
            label="Folders"
            checked={foldersEnabled}
            onChange={(v) => set('ENABLE_FOLDERS', v)}
          />
          {foldersEnabled && (
            <SettingsField
              label="Folder Max File Count"
              description="Maximum files per folder. Leave empty for unlimited."
            >
              <input
                type="number"
                min={0}
                value={config.FOLDER_MAX_FILE_COUNT != null ? Number(config.FOLDER_MAX_FILE_COUNT) : ''}
                onChange={(e) =>
                  set('FOLDER_MAX_FILE_COUNT', e.target.value === '' ? null : parseInt(e.target.value))
                }
                placeholder="Unlimited"
                className={FIELD}
              />
            </SettingsField>
          )}
        </div>

        {/* Group 2: User Tools */}
        <div className="feat-group">
          <div className="feat-group-title">User Tools</div>
          <div className="feat-group-desc">Optional user-facing capabilities and workspace utilities.</div>

          <SettingsToggleRow
            label="Notes (Beta)"
            checked={!!config.ENABLE_NOTES}
            onChange={(v) => set('ENABLE_NOTES', v)}
          />
          <SettingsToggleRow
            label="Channels (Beta)"
            checked={!!config.ENABLE_CHANNELS}
            onChange={(v) => set('ENABLE_CHANNELS', v)}
          />
          <SettingsToggleRow
            label="Memories (Beta)"
            checked={!!config.ENABLE_MEMORIES}
            onChange={(v) => set('ENABLE_MEMORIES', v)}
          />
          <SettingsToggleRow
            label="User Webhooks"
            checked={!!config.ENABLE_USER_WEBHOOKS}
            onChange={(v) => set('ENABLE_USER_WEBHOOKS', v)}
          />
          <SettingsToggleRow
            label="User Status"
            checked={!!config.ENABLE_USER_STATUS}
            onChange={(v) => set('ENABLE_USER_STATUS', v)}
          />
        </div>

        {/* Group 3: Branding & Links (full-width) */}
        <div className="feat-group feat-group--wide">
          <div className="feat-group-title">Branding &amp; Links</div>
          <div className="feat-group-desc">Watermarks and outbound URLs used across the product experience.</div>

          <SettingsField label="Response Watermark" description="Leave empty for none.">
            <textarea
              rows={2}
              value={String(config.RESPONSE_WATERMARK ?? '')}
              onChange={(e) => set('RESPONSE_WATERMARK', e.target.value)}
              placeholder="Enter a watermark for the response. Leave empty for none."
              className="admin-input w-full rounded-[0.85rem] px-3 py-2 text-sm"
            />
          </SettingsField>

          <SettingsField
            label="WebUI URL"
            description="Public URL used to generate links in notifications."
          >
            <input
              type="text"
              value={String(config.WEBUI_URL ?? '')}
              onChange={(e) => set('WEBUI_URL', e.target.value)}
              placeholder="http://localhost:3000"
              className={FIELD}
            />
          </SettingsField>

          <SettingsField label="Webhook URL" description="Called on new user sign-up.">
            <input
              type="url"
              value={webhook}
              onChange={(e) => onWebhookChange(e.target.value)}
              placeholder="https://example.com/webhook"
              className={FIELD}
            />
          </SettingsField>
        </div>

      </div>

      <style>{`
        .feat-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 0.9rem;
        }
        .feat-group {
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
          padding: 1rem;
          border-radius: 1.1rem;
          border: 1px solid var(--bodhion-card-border);
          background: var(--bodhion-card-bg);
          box-shadow:
            inset 0 1px 0 rgba(255,255,255,0.025),
            0 8px 20px rgba(0,0,0,0.1);
        }
        .feat-group--wide {
          grid-column: 1 / -1;
        }
        .feat-group-title {
          font-size: 0.78rem;
          font-weight: 700;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: var(--bodhion-accent, #25d7ff);
        }
        .feat-group-desc {
          font-size: 0.76rem;
          line-height: 1.45;
          color: var(--bodhion-text-secondary);
          margin-top: -0.25rem;
        }
        @media (max-width: 860px) {
          .feat-grid { grid-template-columns: 1fr; }
        }
      `}</style>
    </SettingsSection>
  );
}

export default FeaturesConfig;
