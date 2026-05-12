'use client';

import type { ReactNode } from 'react';
import { Switch } from '@/components/ui/Switch';

interface SettingsSectionProps {
  title:        string;
  description?: string;
  /** Lime-green eyebrow badge shown above the title */
  eyebrow?:     string;
  children:     ReactNode;
  /** If provided, renders a Save button that calls this on click */
  onSave?:      () => void;
  saving?:      boolean;
  /** Additional content shown to the right of title (e.g. badge) */
  action?:      ReactNode;
}

export function SettingsSection({
  title,
  description,
  eyebrow,
  children,
  onSave,
  saving,
  action,
}: SettingsSectionProps) {
  return (
    <div className="bodhion-section-card">
      {/* Header */}
      <div className="bodhion-section-header">
        <div className="min-w-0">
          {eyebrow && (
            <div className="bodhion-section-eyebrow">{eyebrow}</div>
          )}
          <h3 className="bodhion-section-title">{title}</h3>
          {description && (
            <p className="bodhion-section-desc">{description}</p>
          )}
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </div>

      {/* Content */}
      <div className="bodhion-section-body">
        {children}
      </div>

      {/* Save footer */}
      {onSave && (
        <div
          className="bodhion-section-footer"
          style={{ borderTop: '1px solid var(--bodhion-card-border)' }}
        >
          <button
            type="button"
            onClick={onSave}
            disabled={saving}
            className="bodhion-action-btn"
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      )}

      <style>{`
        .bodhion-section-card {
          border-radius: 1.4rem;
          border: 1px solid var(--bodhion-card-border);
          background: var(--bodhion-card-bg);
          overflow: hidden;
        }
        .bodhion-section-header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 1rem;
          padding: 1.1rem 1.25rem 0.75rem;
        }
        .bodhion-section-eyebrow {
          display: inline-flex;
          align-items: center;
          border: 1px solid var(--bodhion-eyebrow-border, rgba(199,242,58,0.24));
          background: var(--bodhion-eyebrow-bg, rgba(118,209,26,0.08));
          padding: 0.2rem 0.55rem;
          border-radius: 999px;
          color: var(--bodhion-eyebrow-text, #c7f23a);
          font-size: 0.62rem;
          font-weight: 700;
          letter-spacing: 0.13em;
          text-transform: uppercase;
          width: fit-content;
          margin-bottom: 0.45rem;
        }
        .bodhion-section-title {
          font-size: 0.83rem;
          font-weight: 700;
          letter-spacing: 0.07em;
          text-transform: uppercase;
          color: var(--bodhion-accent, #25d7ff);
          line-height: 1.2;
        }
        .bodhion-section-desc {
          margin-top: 0.3rem;
          font-size: 0.79rem;
          line-height: 1.5;
          color: var(--bodhion-text-secondary);
        }
        .bodhion-section-body {
          display: flex;
          flex-direction: column;
          gap: 0.95rem;
          padding: 0.5rem 1.25rem 1.1rem;
        }
        .bodhion-section-footer {
          display: flex;
          justify-content: flex-end;
          padding: 0.65rem 1.25rem;
        }
        .bodhion-action-btn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 0.5rem;
          border-radius: 999px;
          border: 1px solid rgba(37,215,255,0.3);
          background: var(--bodhion-primary-button, linear-gradient(135deg, rgba(0,104,201,0.94), rgba(37,215,255,0.72)));
          box-shadow: var(--bodhion-primary-button-shadow, 0 10px 30px rgba(0,104,201,0.26));
          padding: 0.55rem 1.25rem;
          color: #eaf6ff;
          font-size: 0.84rem;
          font-weight: 700;
          cursor: pointer;
          transition: transform 0.15s ease, box-shadow 0.15s ease, filter 0.15s ease;
        }
        .bodhion-action-btn:hover:not(:disabled) {
          transform: translateY(-1px);
          filter: brightness(1.06);
          box-shadow: 0 14px 35px rgba(37,215,255,0.22);
        }
        .bodhion-action-btn:disabled {
          opacity: 0.55;
          cursor: not-allowed;
        }
      `}</style>
    </div>
  );
}

/** A labelled field row — label + optional description stacked, control below */
export function SettingsField({
  label,
  description,
  children,
  htmlFor,
}: {
  label:        string;
  description?: string;
  children:     ReactNode;
  htmlFor?:     string;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label
        htmlFor={htmlFor}
        className="text-sm font-semibold"
        style={{ color: 'var(--bodhion-text-primary)' }}
      >
        {label}
      </label>
      {description && (
        <p className="text-xs" style={{ color: 'var(--bodhion-text-secondary)' }}>
          {description}
        </p>
      )}
      {children}
    </div>
  );
}

/** A row with a toggle on the right side */
export function SettingsToggleRow({
  label,
  description,
  checked,
  onChange,
  disabled,
}: {
  label:        string;
  description?: string;
  checked:      boolean;
  onChange:     (v: boolean) => void;
  disabled?:    boolean;
}) {
  return (
    <div
      className="flex items-center justify-between gap-4 py-0.5"
      style={{ borderBottom: '1px solid var(--bodhion-card-border)' }}
    >
      <div className="flex flex-col min-w-0">
        <span className="text-sm font-semibold" style={{ color: 'var(--bodhion-text-primary)' }}>
          {label}
        </span>
        {description && (
          <span className="text-xs mt-0.5" style={{ color: 'var(--bodhion-text-secondary)' }}>
            {description}
          </span>
        )}
      </div>
      <Switch checked={checked} onCheckedChange={onChange} disabled={disabled} />
    </div>
  );
}

export default SettingsSection;
