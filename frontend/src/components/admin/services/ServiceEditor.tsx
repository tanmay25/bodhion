'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Save, PowerOff, Power } from 'lucide-react';
import { getToken } from '@/lib/auth/session';
import {
  adminCreateService,
  adminUpdateService,
  adminDeactivateService,
  type ServiceModel,
} from '@/lib/api/admin/services';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/Tabs';
import {
  ServiceInfoTab,
  type InfoFormState,
  emptyInfoForm,
  serviceToInfoForm,
  infoFormToCreatePayload,
  infoFormToUpdatePayload,
} from './ServiceInfoTab';
import { ServiceSettingsTab, type SettingsState } from './ServiceSettingsTab';
import { ServiceAccessTab, type GrantDraft } from './ServiceAccessTab';

interface ServiceEditorProps {
  service: ServiceModel | null;
  isCreating: boolean;
  onSaved: (svc: ServiceModel) => void;
  onDeactivated: (id: string) => void;
}

export function ServiceEditor({ service, isCreating, onSaved, onDeactivated }: ServiceEditorProps) {
  const [activeTab, setActiveTab] = useState('info');
  const [saving, setSaving] = useState(false);

  // Sub-form states
  const [infoForm, setInfoForm] = useState<InfoFormState>(emptyInfoForm());
  const [settings, setSettings] = useState<SettingsState>({});
  const [grants, setGrants] = useState<GrantDraft[]>([]);

  // Sync when selected service changes
  useEffect(() => {
    if (service) {
      setInfoForm(serviceToInfoForm(service));
      setSettings(service.settings ?? {});
      setGrants(
        (service.access_grants ?? []).map((g) => ({
          principal_type: g.principal_type as 'user' | 'group',
          principal_id: g.principal_id,
          permission: g.permission as 'read' | 'write',
        }))
      );
    } else {
      setInfoForm(emptyInfoForm());
      setSettings({});
      setGrants([]);
    }
    setActiveTab('info');
  }, [service?.id, isCreating]);

  const handleSave = async () => {
    const token = getToken();
    if (!token) return;

    // Basic validation
    if (!infoForm.id.trim()) { toast.error('Service ID is required.'); setActiveTab('info'); return; }
    if (!infoForm.name.trim()) { toast.error('Service name is required.'); setActiveTab('info'); return; }
    if (!infoForm.route.trim()) { toast.error('Route is required.'); setActiveTab('info'); return; }

    setSaving(true);
    try {
      let saved: ServiceModel;

      if (isCreating) {
        saved = await adminCreateService(token, {
          ...infoFormToCreatePayload(infoForm),
          access_grants: grants,
          settings,
        });
      } else {
        // Update info
        saved = await adminUpdateService(token, service!.id, {
          ...infoFormToUpdatePayload(infoForm),
          access_grants: grants,
          settings,
        });
      }

      toast.success(isCreating ? 'Service created.' : 'Service updated.');
      onSaved(saved);
    } catch (err: unknown) {
      const msg = (err as { detail?: string })?.detail ?? 'Failed to save service.';
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  const handleDeactivate = async () => {
    if (!service) return;
    const token = getToken();
    if (!token) return;
    setSaving(true);
    try {
      if (service.is_active) {
        await adminDeactivateService(token, service.id);
        toast.success('Service deactivated.');
      } else {
        // Reactivate via update
        await adminUpdateService(token, service.id, { is_active: true });
        toast.success('Service reactivated.');
      }
      onDeactivated(service.id);
    } catch {
      toast.error('Failed to update service status.');
    } finally {
      setSaving(false);
    }
  };

  // Empty state
  if (!service && !isCreating) {
    return (
      <div className="svc-editor-empty">
        <div className="svc-editor-empty-inner">
          <div className="svc-editor-empty-icon">⚙</div>
          <p className="svc-editor-empty-title">No service selected</p>
          <p className="svc-editor-empty-desc">
            Select a service from the list or click <strong>Add</strong> to create a new one.
          </p>
        </div>

        <style>{`
          .svc-editor-empty {
            display: flex;
            align-items: center;
            justify-content: center;
            height: 100%;
            min-height: 16rem;
          }
          .svc-editor-empty-inner {
            text-align: center;
            max-width: 22rem;
          }
          .svc-editor-empty-icon {
            font-size: 2.2rem;
            margin-bottom: 0.75rem;
            opacity: 0.25;
          }
          .svc-editor-empty-title {
            font-size: 1rem;
            font-weight: 700;
            color: var(--bodhion-text-primary);
            margin: 0 0 0.35rem;
          }
          .svc-editor-empty-desc {
            font-size: 0.84rem;
            color: var(--bodhion-text-secondary);
            line-height: 1.55;
            margin: 0;
          }
        `}</style>
      </div>
    );
  }

  return (
    <div className="svc-editor flex flex-col gap-3">
      {/* Editor header */}
      <div className="svc-editor-header">
        <div>
          <p className="svc-editor-label">{isCreating ? 'New Service' : 'Edit Service'}</p>
          <p className="svc-editor-id">
            {isCreating ? 'Fill in the details below' : `ID: ${service?.id}`}
          </p>
        </div>
        {/* Action buttons */}
        <div className="flex items-center gap-2">
          {!isCreating && service && (
            <button
              type="button"
              className={`svc-deactivate-btn${service.is_active ? '' : ' svc-deactivate-btn--reactivate'}`}
              onClick={handleDeactivate}
              disabled={saving}
            >
              {service.is_active
                ? <PowerOff style={{ width: '0.85rem', height: '0.85rem' }} />
                : <Power style={{ width: '0.85rem', height: '0.85rem' }} />}
              {service.is_active ? 'Deactivate' : 'Reactivate'}
            </button>
          )}
          <button
            type="button"
            className="svc-save-btn"
            onClick={handleSave}
            disabled={saving}
          >
            <Save style={{ width: '0.85rem', height: '0.85rem' }} />
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>

      {/* Sub-tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="svc-editor-tabs flex flex-col gap-3">
        <div className="svc-editor-tabs-shell">
          <TabsList className="svc-editor-tabs-list">
            <TabsTrigger value="info">Info</TabsTrigger>
            <TabsTrigger value="settings">Settings</TabsTrigger>
            <TabsTrigger value="access">Access</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="info">
          <ServiceInfoTab
            form={infoForm}
            isCreating={isCreating}
            onChange={(patch) => setInfoForm((f) => ({ ...f, ...patch }))}
          />
        </TabsContent>

        <TabsContent value="settings">
          <ServiceSettingsTab settings={settings} onChange={setSettings} />
        </TabsContent>

        <TabsContent value="access">
          <ServiceAccessTab grants={grants} onChange={setGrants} />
        </TabsContent>
      </Tabs>

      <style>{`
        .svc-editor { color: var(--bodhion-text-primary); }

        .svc-editor-header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 1rem;
          padding: 0.85rem 1.1rem;
          border-radius: 1.1rem;
          border: 1px solid var(--bodhion-card-border);
          background: var(--bodhion-card-bg);
        }
        .svc-editor-label {
          font-size: 0.72rem;
          font-weight: 700;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: var(--bodhion-text-secondary);
          margin: 0 0 0.2rem;
        }
        .svc-editor-id {
          font-size: 0.84rem;
          font-weight: 600;
          color: var(--bodhion-text-primary);
          font-family: 'Menlo', 'Consolas', monospace;
          margin: 0;
        }

        /* Save button */
        .svc-save-btn {
          display: inline-flex;
          align-items: center;
          gap: 0.35rem;
          padding: 0.4rem 0.95rem;
          border-radius: 0.75rem;
          border: none;
          background: var(--bodhion-primary-button);
          box-shadow: var(--bodhion-primary-button-shadow);
          color: #fff;
          font-size: 0.82rem;
          font-weight: 600;
          cursor: pointer;
          white-space: nowrap;
          transition: opacity 0.15s;
        }
        .svc-save-btn:disabled { opacity: 0.6; cursor: not-allowed; }
        .svc-save-btn:not(:disabled):hover { opacity: 0.88; }

        /* Deactivate button */
        .svc-deactivate-btn {
          display: inline-flex;
          align-items: center;
          gap: 0.35rem;
          padding: 0.4rem 0.85rem;
          border-radius: 0.75rem;
          border: 1px solid rgba(248,113,113,0.35);
          background: rgba(248,113,113,0.08);
          color: #f87171;
          font-size: 0.82rem;
          font-weight: 600;
          cursor: pointer;
          white-space: nowrap;
          transition: background 0.15s;
        }
        .svc-deactivate-btn--reactivate {
          border-color: rgba(74,222,128,0.35);
          background: rgba(74,222,128,0.08);
          color: #4ade80;
        }
        .svc-deactivate-btn:disabled { opacity: 0.5; cursor: not-allowed; }
        .svc-deactivate-btn:not(:disabled):hover { background: rgba(248,113,113,0.15); }
        .svc-deactivate-btn--reactivate:not(:disabled):hover { background: rgba(74,222,128,0.15); }

        /* Sub-tab shell */
        .svc-editor-tabs-shell {
          position: relative;
          background: var(--bodhion-shell-bg);
          backdrop-filter: blur(22px);
          -webkit-backdrop-filter: blur(22px);
          border: 1px solid var(--bodhion-shell-border);
          border-radius: 1rem;
          overflow: hidden;
        }
        .svc-editor-tabs-list {
          display: flex !important;
          align-items: center;
          gap: 0.15rem;
          padding: 0.3rem !important;
          background: transparent !important;
          border: none !important;
          min-height: 2.9rem;
        }
        .svc-editor-tabs {
          overflow: visible !important;
        }
      `}</style>
    </div>
  );
}
