'use client';

import { useCallback, useMemo, useRef, useState } from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import {
  Settings, User, Info, Volume2, Database, Monitor,
  Wrench, Smile, Search, X, Link2,
} from 'lucide-react';
import { toast } from 'sonner';
import { useUIStore } from '@/store/uiStore';
import { useAuthStore } from '@/store/authStore';
import { cn } from '@/lib/utils/cn';
import { GeneralTab } from './tabs/GeneralTab';
import { InterfaceTab } from './tabs/InterfaceTab';
import { ConnectionsTab } from './tabs/ConnectionsTab';
import { IntegrationsTab } from './tabs/IntegrationsTab';
import { PersonalizationTab } from './tabs/PersonalizationTab';
import { AccountTab } from './tabs/AccountTab';
import { AboutTab } from './tabs/AboutTab';
import { AudioTab } from './tabs/AudioTab';
import { DataControlsTab } from './tabs/DataControlsTab';

// ── Tab definitions ────────────────────────────────────────────────────────────
const BASE_TABS = [
  { id: 'general',      label: 'General',        icon: Settings,    hasSave: true  },
  { id: 'interface',    label: 'Interface',       icon: Monitor,     hasSave: true  },
  { id: 'integrations', label: 'Integrations',    icon: Wrench,      hasSave: true  },
  { id: 'personalize',  label: 'Personalization', icon: Smile,       hasSave: true  },
  { id: 'audio',        label: 'Audio',           icon: Volume2,     hasSave: true  },
  { id: 'data',         label: 'Data Controls',   icon: Database,    hasSave: false },
  { id: 'account',      label: 'Account',         icon: User,        hasSave: true  },
  { id: 'about',        label: 'About',           icon: Info,        hasSave: false },
] as const;

const CONNECTIONS_TAB = { id: 'connections' as const, label: 'Connections', icon: Link2, hasSave: true };

type TabId = typeof BASE_TABS[number]['id'] | 'connections';

// ── Main modal ─────────────────────────────────────────────────────────────────
export function SettingsModal() {
  const showSettings = useUIStore((s) => s.showSettings);
  const setShowSettings = useUIStore((s) => s.setShowSettings);
  const user = useAuthStore((s) => s.user);
  const config = useAuthStore((s) => s.config);
  const [activeTab, setActiveTab] = useState<TabId>('general');
  const [search, setSearch] = useState('');
  const [saving, setSaving] = useState(false);
  const saveFnRef = useRef<null | (() => Promise<void>)>(null);

  const registerSave = useCallback((fn: () => Promise<void>) => {
    saveFnRef.current = fn;
  }, []);

  const canSeeConnections =
    user?.role === 'admin' || Boolean(config?.features?.enable_direct_connections);

  const tabs = useMemo(() => {
    // Insert Connections after Interface when the flag is on
    const base = canSeeConnections
      ? [BASE_TABS[0], BASE_TABS[1], CONNECTIONS_TAB, ...BASE_TABS.slice(2)]
      : [...BASE_TABS];
    const all = [...base];
    if (!search.trim()) return all;
    const q = search.toLowerCase();
    return all.filter((t) => t.label.toLowerCase().includes(q));
  }, [user?.role, canSeeConnections, search]);

  const activeTabMeta = ([
    ...BASE_TABS,
    CONNECTIONS_TAB,
  ] as const).find((t) => t.id === activeTab);

  const handleSave = async () => {
    if (!saveFnRef.current) return;
    setSaving(true);
    try {
      await saveFnRef.current();
      toast.success('Settings saved successfully', { closeButton: true });
    } catch (err) {
      // FastAPI can return detail as a string OR as an array of validation objects
      const raw = (err as { detail?: unknown })?.detail;
      const msg =
        typeof raw === 'string'
          ? raw
          : Array.isArray(raw)
          ? raw.map((e: { msg?: string }) => e?.msg ?? JSON.stringify(e)).join('; ')
          : err instanceof Error
          ? err.message
          : 'Failed to save settings';
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <DialogPrimitive.Root open={showSettings} onOpenChange={setShowSettings}>
      <DialogPrimitive.Portal>
        {/* Overlay */}
        <DialogPrimitive.Overlay className="settings-modal-overlay" />

        {/* Panel */}
        <DialogPrimitive.Content
          className="settings-modal"
          aria-describedby={undefined}
          onInteractOutside={(e) => {
            // Prevent the modal from closing when the user clicks inside
            // the Sonner toaster (e.g. the toast close button).
            const target = (e as CustomEvent).detail?.originalEvent?.target as HTMLElement | null;
            if (target?.closest('[data-sonner-toaster]')) {
              e.preventDefault();
            }
          }}
        >
          <DialogPrimitive.Title className="sr-only">Settings</DialogPrimitive.Title>
          {/* ── Header ─────────────────────────────────────────── */}
          <div className="settings-modal-header">
            <div>
              <div className="settings-modal-eyebrow">BODHION SETTINGS</div>
              <div className="settings-modal-title">{activeTabMeta?.label ?? 'Settings'}</div>
            </div>
            <DialogPrimitive.Close className="settings-modal-close" aria-label="Close settings">
              <X className="h-4 w-4" />
            </DialogPrimitive.Close>
          </div>

          {/* ── Body ───────────────────────────────────────────── */}
          <div className="settings-modal-body">
            {/* Sidebar */}
            <aside className="settings-sidebar">
              <div className="settings-search-wrap">
                <Search className="settings-search-icon h-3.5 w-3.5" />
                <input
                  className="settings-search-input"
                  type="text"
                  placeholder="Search settings…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>

              <nav className="settings-tab-list" role="tablist">
                {tabs.map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    role="tab"
                    aria-selected={activeTab === tab.id}
                    className={cn('settings-tab-item', activeTab === tab.id && 'settings-tab-item--active')}
                    onClick={() => {
                      setActiveTab(tab.id as TabId);
                      saveFnRef.current = null;
                    }}
                  >
                    <tab.icon className="settings-tab-icon h-4 w-4" />
                    <span>{tab.label}</span>
                  </button>
                ))}

                {tabs.length === 0 && (
                  <div className="settings-tab-empty">No results for &ldquo;{search}&rdquo;</div>
                )}
              </nav>
            </aside>

            {/* Content */}
            <main className="settings-content" role="tabpanel">
              {activeTab === 'general'     && <GeneralTab onRegisterSave={registerSave} />}
              {activeTab === 'interface'   && <InterfaceTab onRegisterSave={registerSave} />}
              {activeTab === 'connections' && <ConnectionsTab onRegisterSave={registerSave} />}
              {activeTab === 'account'     && <AccountTab onRegisterSave={registerSave} />}
              {activeTab === 'about'       && <AboutTab />}
              {activeTab === 'integrations' && <IntegrationsTab onRegisterSave={registerSave} />}
              {activeTab === 'personalize' && <PersonalizationTab onRegisterSave={registerSave} />}
              {activeTab === 'audio' && <AudioTab onRegisterSave={registerSave} />}
              {activeTab === 'data'  && <DataControlsTab />}
            </main>
          </div>

          {/* ── Footer ─────────────────────────────────────────── */}
          {activeTabMeta?.hasSave && (
            <div className="settings-modal-footer">
              <button
                type="button"
                className="settings-btn settings-btn--save"
                onClick={() => void handleSave()}
                disabled={saving}
              >
                {saving ? 'Saving…' : 'Save Changes'}
              </button>
            </div>
          )}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
