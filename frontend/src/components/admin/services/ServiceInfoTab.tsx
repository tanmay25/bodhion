'use client';

import { LayoutGrid } from 'lucide-react';
import type { ServiceForm, ServiceUpdateForm } from '@/lib/api/admin/services';

function isIconUrl(icon: string): boolean {
  return icon.startsWith('http://') || icon.startsWith('https://') || icon.startsWith('/') || icon.startsWith('data:');
}

export type InfoFormState = {
  id: string;
  type: string;
  name: string;
  description: string;
  route: string;
  icon: string;
  cta: string;
  status: string;
  sort_order: number;
  is_active: boolean;
};

interface ServiceInfoTabProps {
  form: InfoFormState;
  isCreating: boolean;
  onChange: (patch: Partial<InfoFormState>) => void;
}

export function ServiceInfoTab({ form, isCreating, onChange }: ServiceInfoTabProps) {
  return (
    <div className="svc-info-tab flex flex-col gap-4">

      {/* ID */}
      <div className="svc-field-group">
        <label className="svc-label">Service ID <span className="svc-required">*</span></label>
        <input
          className="svc-input"
          value={form.id}
          readOnly={!isCreating}
          placeholder="e.g. my-service"
          onChange={(e) => onChange({ id: e.target.value })}
          style={!isCreating ? { opacity: 0.55, cursor: 'not-allowed' } : undefined}
        />
        {isCreating && (
          <p className="svc-hint">Unique identifier — cannot be changed after creation.</p>
        )}
      </div>

      {/* Name */}
      <div className="svc-field-group">
        <label className="svc-label">Name <span className="svc-required">*</span></label>
        <input
          className="svc-input"
          value={form.name}
          placeholder="e.g. My Service"
          onChange={(e) => onChange({ name: e.target.value })}
        />
      </div>

      {/* Type */}
      <div className="svc-field-group">
        <label className="svc-label">Type</label>
        <input
          className="svc-input"
          value={form.type}
          placeholder="e.g. generic, iframe, external"
          onChange={(e) => onChange({ type: e.target.value })}
        />
        <p className="svc-hint">Categorises the service (free text).</p>
      </div>

      {/* Description */}
      <div className="svc-field-group">
        <label className="svc-label">Description</label>
        <textarea
          className="svc-input svc-textarea"
          value={form.description}
          placeholder="Short description shown to users…"
          onChange={(e) => onChange({ description: e.target.value })}
          rows={3}
        />
      </div>

      {/* Route */}
      <div className="svc-field-group">
        <label className="svc-label">Route / URL <span className="svc-required">*</span></label>
        <input
          className="svc-input"
          value={form.route}
          placeholder="e.g. /services/my-service or https://…"
          onChange={(e) => onChange({ route: e.target.value })}
        />
      </div>

      {/* Icon */}
      <div className="svc-field-group">
        <label className="svc-label">Icon URL</label>
        <div className="flex items-center gap-3">
          <div className="svc-icon-preview">
            {form.icon && isIconUrl(form.icon) ? (
              <img src={form.icon} alt="" className="h-full w-full object-contain" />
            ) : (
              <LayoutGrid style={{ width: '1.1rem', height: '1.1rem', color: 'var(--bodhion-text-secondary)' }} />
            )}
          </div>
          <input
            className="svc-input flex-1"
            value={form.icon}
            placeholder="https://example.com/icon.png"
            onChange={(e) => onChange({ icon: e.target.value })}
          />
        </div>
      </div>

      {/* CTA */}
      <div className="svc-field-group">
        <label className="svc-label">Call-to-Action label</label>
        <input
          className="svc-input"
          value={form.cta}
          placeholder="e.g. Open, Launch, Try now…"
          onChange={(e) => onChange({ cta: e.target.value })}
        />
      </div>

      {/* Status + Sort order row */}
      <div className="flex gap-3 flex-wrap">
        <div className="svc-field-group flex-1 min-w-[140px]">
          <label className="svc-label">Status</label>
          <select
            className="svc-input svc-select"
            value={form.status}
            onChange={(e) => onChange({ status: e.target.value })}
          >
            <option value="active">Active</option>
            <option value="coming-soon">Coming Soon</option>
          </select>
        </div>
        <div className="svc-field-group flex-1 min-w-[120px]">
          <label className="svc-label">Sort Order</label>
          <input
            className="svc-input"
            type="number"
            min={0}
            value={form.sort_order}
            onChange={(e) => onChange({ sort_order: Number(e.target.value) })}
          />
        </div>
      </div>

      {/* Is Active toggle */}
      <div className="svc-toggle-row">
        <div>
          <span className="svc-toggle-label">Active</span>
          <p className="svc-hint" style={{ marginTop: '0.1rem' }}>
            Inactive services are hidden from users.
          </p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={form.is_active}
          className={`svc-toggle${form.is_active ? ' svc-toggle--on' : ''}`}
          onClick={() => onChange({ is_active: !form.is_active })}
        >
          <span className="svc-toggle-thumb" />
        </button>
      </div>

      <style>{`
        .svc-info-tab { color: var(--bodhion-text-primary); }

        .svc-field-group { display: flex; flex-direction: column; gap: 0.3rem; }

        .svc-label {
          font-size: 0.78rem;
          font-weight: 600;
          color: var(--bodhion-text-secondary);
          letter-spacing: 0.04em;
        }
        .svc-required { color: var(--bodhion-accent); margin-left: 2px; }

        .svc-hint {
          font-size: 0.72rem;
          color: var(--bodhion-text-secondary);
          opacity: 0.75;
          margin: 0;
        }

        .svc-input {
          width: 100%;
          padding: 0.5rem 0.75rem;
          border-radius: 0.75rem;
          border: 1px solid var(--bodhion-search-border);
          background: var(--bodhion-search-bg);
          color: var(--bodhion-text-primary);
          font-size: 0.86rem;
          outline: none;
          transition: border-color 0.15s;
        }
        .svc-input:focus {
          border-color: var(--bodhion-accent);
          box-shadow: 0 0 0 2px rgba(37,215,255,0.12);
        }
        .svc-input::placeholder { color: var(--bodhion-text-secondary); opacity: 0.55; }

        .svc-textarea { resize: vertical; min-height: 5rem; font-family: inherit; }

        .svc-select {
          appearance: none;
          -webkit-appearance: none;
          cursor: pointer;
        }

        .svc-icon-preview {
          width: 2.6rem;
          height: 2.6rem;
          border-radius: 0.6rem;
          border: 1px solid var(--bodhion-shell-border);
          background: rgba(255,255,255,0.04);
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          overflow: hidden;
        }

        /* Toggle */
        .svc-toggle-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 1rem;
          padding: 0.75rem 1rem;
          border-radius: 1rem;
          border: 1px solid var(--bodhion-card-border);
          background: var(--bodhion-card-bg);
        }
        .svc-toggle-label {
          font-size: 0.86rem;
          font-weight: 600;
          color: var(--bodhion-text-primary);
        }
        .svc-toggle {
          position: relative;
          width: 2.4rem;
          height: 1.3rem;
          border-radius: 999px;
          border: none;
          background: rgba(255,255,255,0.12);
          cursor: pointer;
          flex-shrink: 0;
          transition: background 0.2s;
          padding: 0;
        }
        .svc-toggle--on {
          background: var(--bodhion-accent);
        }
        .svc-toggle-thumb {
          position: absolute;
          top: 0.15rem;
          left: 0.15rem;
          width: 1rem;
          height: 1rem;
          border-radius: 50%;
          background: #fff;
          transition: transform 0.2s;
        }
        .svc-toggle--on .svc-toggle-thumb {
          transform: translateX(1.1rem);
        }
      `}</style>
    </div>
  );
}

/** Convert InfoFormState → ServiceForm payload for create */
export function infoFormToCreatePayload(f: InfoFormState): ServiceForm {
  return {
    id: f.id,
    type: f.type || 'generic',
    name: f.name,
    description: f.description || null,
    route: f.route,
    icon: f.icon || null,
    cta: f.cta || null,
    status: f.status,
    is_active: f.is_active,
    sort_order: f.sort_order,
  };
}

/** Convert InfoFormState → ServiceUpdateForm payload for update */
export function infoFormToUpdatePayload(f: InfoFormState): ServiceUpdateForm {
  return {
    type: f.type || 'generic',
    name: f.name,
    description: f.description || null,
    route: f.route,
    icon: f.icon || null,
    cta: f.cta || null,
    status: f.status,
    is_active: f.is_active,
    sort_order: f.sort_order,
  };
}

/** Build InfoFormState from an existing ServiceModel (for edit mode) */
export function serviceToInfoForm(svc: {
  id: string; type: string; name: string; description: string | null;
  route: string; icon: string | null; cta: string | null; status: string;
  sort_order: number; is_active: boolean;
}): InfoFormState {
  return {
    id: svc.id,
    type: svc.type,
    name: svc.name,
    description: svc.description ?? '',
    route: svc.route,
    icon: svc.icon ?? '',
    cta: svc.cta ?? '',
    status: svc.status,
    sort_order: svc.sort_order,
    is_active: svc.is_active,
  };
}

export function emptyInfoForm(): InfoFormState {
  return { id: '', type: 'generic', name: '', description: '', route: '', icon: '', cta: '', status: 'active', sort_order: 0, is_active: true };
}
