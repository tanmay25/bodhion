'use client';

import { use, Suspense, lazy } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronDown, Check } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/Tabs';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '@/components/ui/Dropdown';

// Lazy-load each tab so the settings bundle is split per-tab
const GeneralTab       = lazy(() => import('@/components/admin/settings/GeneralTab').then(m => ({ default: m.GeneralTab })));
const ConnectionsTab   = lazy(() => import('@/components/admin/settings/ConnectionsTab').then(m => ({ default: m.ConnectionsTab })));
const ModelsTab        = lazy(() => import('@/components/admin/settings/ModelsTab').then(m => ({ default: m.ModelsTab })));
const DocumentsTab     = lazy(() => import('@/components/admin/settings/DocumentsTab').then(m => ({ default: m.DocumentsTab })));
const InterfaceTab     = lazy(() => import('@/components/admin/settings/InterfaceTab').then(m => ({ default: m.InterfaceTab })));
const AudioTab         = lazy(() => import('@/components/admin/settings/AudioTab').then(m => ({ default: m.AudioTab })));
const ImagesTab        = lazy(() => import('@/components/admin/settings/ImagesTab').then(m => ({ default: m.ImagesTab })));
const CodeExecutionTab = lazy(() => import('@/components/admin/settings/CodeExecutionTab').then(m => ({ default: m.CodeExecutionTab })));
const WebSearchTab     = lazy(() => import('@/components/admin/settings/WebSearchTab').then(m => ({ default: m.WebSearchTab })));
const PipelinesTab     = lazy(() => import('@/components/admin/settings/PipelinesTab').then(m => ({ default: m.PipelinesTab })));
const DatabaseTab      = lazy(() => import('@/components/admin/settings/DatabaseTab').then(m => ({ default: m.DatabaseTab })));
const EvaluationsTab   = lazy(() => import('@/components/admin/settings/EvaluationsSettingsTab').then(m => ({ default: m.EvaluationsSettingsTab })));
const MCPServersTab    = lazy(() => import('@/components/admin/settings/MCPServersTab').then(m => ({ default: m.MCPServersTab })));

const TABS = [
  { id: 'general',        label: 'General',        Component: GeneralTab },
  { id: 'connections',    label: 'Connections',    Component: ConnectionsTab },
  { id: 'models',         label: 'Models',         Component: ModelsTab },
  { id: 'documents',      label: 'Documents',      Component: DocumentsTab },
  { id: 'interface',      label: 'Interface',      Component: InterfaceTab },
  { id: 'audio',          label: 'Audio',          Component: AudioTab },
  { id: 'images',         label: 'Images',         Component: ImagesTab },
  { id: 'code-execution', label: 'Code Execution', Component: CodeExecutionTab },
  { id: 'web-search',     label: 'Web Search',     Component: WebSearchTab },
  { id: 'pipelines',      label: 'Pipelines',      Component: PipelinesTab },
  { id: 'database',       label: 'Database',       Component: DatabaseTab },
  { id: 'evaluations',    label: 'Evaluations',    Component: EvaluationsTab },
  { id: 'mcp-servers',   label: 'MCP Servers',    Component: MCPServersTab },
] as const;

function TabSkeleton() {
  return (
    <div className="flex flex-col gap-4 pt-2">
      {Array.from({ length: 3 }).map((_, i) => (
        <div
          key={i}
          className="h-24 w-full animate-pulse rounded-[1.4rem]"
          style={{ background: 'var(--bodhion-card-bg)', border: '1px solid var(--bodhion-card-border)' }}
        />
      ))}
    </div>
  );
}

interface Props {
  params: Promise<{ tab?: string[] }>;
}

export default function AdminSettingsPage({ params }: Props) {
  const { tab } = use(params);
  const activeTab = tab?.[0] ?? 'general';
  const router    = useRouter();

  const activeLabel = TABS.find(t => t.id === activeTab)?.label ?? 'General';

  const handleTabChange = (value: string) => {
    router.push(`/admin/settings/${value}`);
  };

  return (
    <div className="bodhion-settings-page flex min-h-full flex-col gap-3 p-4">

      {/* ── Sticky page header ─────────────────────────────────────────────── */}
      <div className="bodhion-page-header sticky top-0 z-20 overflow-hidden rounded-[1.6rem] border border-white/10 flex-shrink-0">
        <div className="bodhion-page-header-glow" />
        <div className="relative px-5 py-4 space-y-2">
          <div className="bodhion-eyebrow-badge">BODHION ADMIN</div>
          <div>
            <h1 className="bodhion-page-title">Admin Settings</h1>
            <p className="bodhion-page-desc mt-1">
              Configure global platform defaults, authentication posture, features, and UI behaviour from one command surface.
            </p>
          </div>
        </div>
      </div>

      {/* ── Tab navigation ─────────────────────────────────────────────────── */}
      <Tabs
        value={activeTab}
        onValueChange={handleTabChange}
        className="bodhion-tabs-root flex flex-col gap-3"
        style={{ overflow: 'visible' }}
      >
        {/* MOBILE: full-width Bodhion dropdown — all 12 tabs accessible */}
        <div className="sm:hidden flex-shrink-0">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button type="button" className="st-mobile-trigger" aria-label="Settings section">
                <span className="st-mobile-trigger__label">{activeLabel}</span>
                <ChevronDown className="st-mobile-trigger__chevron" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="st-mobile-menu">
              {TABS.map(({ id, label }) => {
                const isActive = activeTab === id;
                return (
                  <DropdownMenuItem
                    key={id}
                    onSelect={() => handleTabChange(id)}
                    className={isActive ? 'bodhion-dropdown-item--active' : ''}
                  >
                    <span className="flex-1">{label}</span>
                    {isActive && (
                      <Check
                        className="ml-2 shrink-0"
                        style={{ width: '0.85rem', height: '0.85rem', color: 'var(--bodhion-accent)' }}
                      />
                    )}
                  </DropdownMenuItem>
                );
              })}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* DESKTOP: two-layer scroll strip — outer shell + inner scroll */}
        <div className="bodhion-tabs-shell-wrap hidden sm:block flex-shrink-0">
          <TabsList className="bodhion-tabs-scroll">
            {TABS.map((t) => (
              <TabsTrigger key={t.id} value={t.id}>
                {t.label}
              </TabsTrigger>
            ))}
          </TabsList>
          {/* Fade affordance — real DOM node, not ::after, so it is never a flex item */}
          <div className="bodhion-tabs-fade" aria-hidden="true" />
        </div>

        {/* Tab content — shared by both mobile dropdown and desktop strip */}
        <div className="bodhion-scroll">
          {TABS.map(({ id, Component }) => (
            <TabsContent key={id} value={id}>
              <Suspense fallback={<TabSkeleton />}>
                <Component />
              </Suspense>
            </TabsContent>
          ))}
        </div>
      </Tabs>

      <style>{`
        .bodhion-settings-page {
          color: var(--bodhion-text-primary);
        }

        /* ── Page header ── */
        .bodhion-page-header {
          background: var(--bodhion-shell-bg);
          backdrop-filter: blur(22px);
          box-shadow: 0 24px 70px rgba(0,0,0,0.3);
        }
        .bodhion-page-header-glow {
          position: absolute;
          inset: 0;
          background:
            linear-gradient(120deg, rgba(0,104,201,0.13), transparent 34%),
            linear-gradient(120deg, transparent 45%, rgba(37,215,255,0.11), transparent 72%);
          pointer-events: none;
        }
        .bodhion-eyebrow-badge {
          display: inline-flex;
          align-items: center;
          border: 1px solid var(--bodhion-eyebrow-border, rgba(199,242,58,0.24));
          background: var(--bodhion-eyebrow-bg, rgba(118,209,26,0.08));
          padding: 0.28rem 0.65rem;
          border-radius: 999px;
          color: var(--bodhion-eyebrow-text, #c7f23a);
          font-size: 0.66rem;
          font-weight: 700;
          letter-spacing: 0.14em;
          text-transform: uppercase;
          width: fit-content;
        }
        .bodhion-page-title {
          font-size: clamp(1.2rem, 1rem + 0.5vw, 1.85rem);
          font-weight: 800;
          line-height: 1.05;
          letter-spacing: -0.02em;
          color: var(--bodhion-text-primary);
        }
        .bodhion-page-desc {
          font-size: 0.86rem;
          line-height: 1.55;
          color: var(--bodhion-text-secondary);
          max-width: 60rem;
        }

        /* ── Tabs root must not clip ── */
        .bodhion-tabs-root {
          overflow: visible !important;
        }

        /* ── Mobile dropdown trigger ── */
        .st-mobile-trigger {
          display: inline-flex;
          align-items: center;
          gap: 0.5rem;
          width: 100%;
          padding: 0.62rem 0.95rem;
          border-radius: 1rem;
          border: 1px solid var(--bodhion-shell-border);
          background: var(--bodhion-shell-bg);
          backdrop-filter: blur(22px);
          -webkit-backdrop-filter: blur(22px);
          color: var(--bodhion-text-primary);
          font-size: 0.88rem;
          font-weight: 600;
          cursor: pointer;
          box-shadow: 0 8px 32px rgba(0,0,0,0.18);
          transition: border-color 0.15s ease;
          outline: none;
        }
        .st-mobile-trigger:hover {
          border-color: var(--bodhion-shell-border-strong);
        }
        .st-mobile-trigger:focus-visible {
          border-color: var(--bodhion-shell-border-strong);
          box-shadow: 0 0 0 3px rgba(37,215,255,0.14);
        }
        .st-mobile-trigger__label {
          flex: 1;
          text-align: left;
        }
        .st-mobile-trigger__chevron {
          width: 1rem;
          height: 1rem;
          color: var(--bodhion-text-secondary);
          flex-shrink: 0;
          transition: transform 0.18s ease;
        }
        [data-state="open"] .st-mobile-trigger__chevron {
          transform: rotate(180deg);
        }
        /* Menu matches full trigger width */
        .st-mobile-menu {
          width: var(--radix-dropdown-menu-trigger-width);
          min-width: 200px;
          max-height: 70vh;
          overflow-y: auto;
          -webkit-overflow-scrolling: touch;
        }

        /* ── Desktop: outer shell wrapper ── */
        .bodhion-tabs-shell-wrap {
          position: relative;
          width: 100%;
          background: var(--bodhion-shell-bg);
          backdrop-filter: blur(22px);
          -webkit-backdrop-filter: blur(22px);
          border: 1px solid var(--bodhion-shell-border);
          border-radius: 1.15rem;
          box-shadow: 0 8px 32px rgba(0,0,0,0.18);
          overflow: hidden;
        }

        /* ── Desktop: inner scroll strip ── */
        .bodhion-tabs-scroll {
          display: flex !important;
          align-items: center;
          flex-wrap: nowrap !important;
          gap: 0.15rem;
          justify-content: flex-start !important;
          width: 100%;
          padding: 0.3rem !important;
          background: transparent !important;
          border: none !important;
          height: auto;
          min-height: 3.2rem;
          overflow-x: auto;
          overflow-y: visible;
          -webkit-overflow-scrolling: touch;
          touch-action: pan-x;
          scrollbar-width: none;
          -ms-overflow-style: none;
        }
        .bodhion-tabs-scroll::-webkit-scrollbar { display: none; }

        /* ── Right-edge fade affordance (desktop) ── */
        .bodhion-tabs-fade {
          position: absolute;
          top: 0;
          right: 0;
          bottom: 0;
          width: 3rem;
          background: linear-gradient(to right, transparent, rgba(8,20,38,0.88) 80%);
          pointer-events: none;
          border-radius: 0 1.15rem 1.15rem 0;
        }
        html.light .bodhion-tabs-fade,
        html.bodhion-light .bodhion-tabs-fade {
          background: linear-gradient(to right, transparent, rgba(237,246,252,0.95) 80%);
        }

        /* ── Tab content ── */
        .bodhion-scroll {
          scrollbar-width: thin;
          scrollbar-color: rgba(37,215,255,0.45) rgba(255,255,255,0.04);
        }
        .bodhion-scroll::-webkit-scrollbar { width: 6px; }
        .bodhion-scroll::-webkit-scrollbar-track {
          background: rgba(255,255,255,0.03);
          border-radius: 999px;
        }
        .bodhion-scroll::-webkit-scrollbar-thumb {
          background: linear-gradient(180deg, rgba(0,104,201,0.85), rgba(37,215,255,0.75));
          border-radius: 999px;
        }
      `}</style>
    </div>
  );
}
