'use client';

import { use } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronDown, Check } from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '@/components/ui/Dropdown';
import { UserList }    from '@/components/admin/users/UserList';
import { GroupsPanel } from '@/components/admin/users/GroupsPanel';

const SUB_TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'groups',   label: 'Groups' },
] as const;

type TabId = (typeof SUB_TABS)[number]['id'];

interface Props {
  params: Promise<{ tab: string }>;
}

export default function AdminUsersTabPage({ params }: Props) {
  const { tab } = use(params);
  const router = useRouter();
  const activeTab: TabId = tab === 'groups' ? 'groups' : 'overview';
  const activeLabel = SUB_TABS.find(t => t.id === activeTab)?.label ?? 'Overview';

  return (
    <div className="au-page flex min-h-full flex-col gap-3 p-4">

      {/* ── Sticky page header ─────────────────────────────────────────── */}
      <div className="bodhion-page-header sticky top-0 z-20 overflow-hidden rounded-[1.6rem] border border-white/10 flex-shrink-0">
        <div className="bodhion-page-header-glow" />
        <div className="relative px-5 py-4 space-y-2">
          <div className="bodhion-eyebrow-badge">BODHION ADMIN</div>
          <div>
            <h1 className="bodhion-page-title">Users</h1>
            <p className="bodhion-page-desc mt-1">
              Manage user accounts, roles, and permission groups.
            </p>
          </div>
        </div>
      </div>

      {/* ── Mobile dropdown ────────────────────────────────────────────── */}
      <div className="sm:hidden flex-shrink-0">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button type="button" className="st-mobile-trigger" aria-label="Users section">
              <span className="st-mobile-trigger__label">{activeLabel}</span>
              <ChevronDown className="st-mobile-trigger__chevron" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="st-mobile-menu">
            {SUB_TABS.map(({ id, label }) => {
              const isActive = activeTab === id;
              return (
                <DropdownMenuItem
                  key={id}
                  onSelect={() => router.push(`/admin/users/${id}`)}
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

      {/* ── Desktop tab strip ──────────────────────────────────────────── */}
      <div className="bodhion-tabs-shell-wrap hidden sm:block flex-shrink-0">
        <div className="bodhion-tabs-scroll">
          {SUB_TABS.map(({ id, label }) => {
            const isActive = activeTab === id;
            return (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={isActive}
                className={cn('bodhion-tab-btn', isActive && 'bodhion-tab-btn--active')}
                onClick={() => router.push(`/admin/users/${id}`)}
              >
                {label}
              </button>
            );
          })}
        </div>
        <div className="bodhion-tabs-fade" aria-hidden="true" />
      </div>

      {/* ── Content ────────────────────────────────────────────────────── */}
      <div className="bodhion-scroll min-h-0 flex-1">
        {activeTab === 'overview' ? <UserList /> : <GroupsPanel />}
      </div>

      <style>{`
        .au-page { color: var(--bodhion-text-primary); }

        /* ── Page header ── */
        .bodhion-page-header {
          background: var(--bodhion-shell-bg);
          backdrop-filter: blur(22px);
          box-shadow: 0 24px 70px rgba(0,0,0,0.3);
        }
        .bodhion-page-header-glow {
          position: absolute; inset: 0;
          background:
            linear-gradient(120deg, rgba(0,104,201,0.13), transparent 34%),
            linear-gradient(120deg, transparent 45%, rgba(37,215,255,0.11), transparent 72%);
          pointer-events: none;
        }
        .bodhion-eyebrow-badge {
          display: inline-flex; align-items: center;
          border: 1px solid var(--bodhion-eyebrow-border, rgba(199,242,58,0.24));
          background: var(--bodhion-eyebrow-bg, rgba(118,209,26,0.08));
          padding: 0.28rem 0.65rem; border-radius: 999px;
          color: var(--bodhion-eyebrow-text, #c7f23a);
          font-size: 0.66rem; font-weight: 700;
          letter-spacing: 0.14em; text-transform: uppercase; width: fit-content;
        }
        .bodhion-page-title {
          font-size: clamp(1.2rem, 1rem + 0.5vw, 1.85rem);
          font-weight: 800; line-height: 1.05;
          letter-spacing: -0.02em; color: var(--bodhion-text-primary);
        }
        .bodhion-page-desc {
          font-size: 0.86rem; line-height: 1.55;
          color: var(--bodhion-text-secondary); max-width: 60rem;
        }

        /* ── Mobile dropdown ── */
        .st-mobile-trigger {
          display: inline-flex; align-items: center; gap: 0.5rem;
          width: 100%; padding: 0.62rem 0.95rem; border-radius: 1rem;
          border: 1px solid var(--bodhion-shell-border);
          background: var(--bodhion-shell-bg); backdrop-filter: blur(22px);
          color: var(--bodhion-text-primary); font-size: 0.88rem; font-weight: 600;
          cursor: pointer; box-shadow: 0 8px 32px rgba(0,0,0,0.18);
          transition: border-color 0.15s ease; outline: none;
        }
        .st-mobile-trigger:hover { border-color: var(--bodhion-shell-border-strong); }
        .st-mobile-trigger:focus-visible {
          border-color: var(--bodhion-shell-border-strong);
          box-shadow: 0 0 0 3px rgba(37,215,255,0.14);
        }
        .st-mobile-trigger__label { flex: 1; text-align: left; }
        .st-mobile-trigger__chevron {
          width: 1rem; height: 1rem;
          color: var(--bodhion-text-secondary); flex-shrink: 0;
          transition: transform 0.18s ease;
        }
        [data-state="open"] .st-mobile-trigger__chevron { transform: rotate(180deg); }
        .st-mobile-menu {
          width: var(--radix-dropdown-menu-trigger-width);
          min-width: 200px; max-height: 70vh; overflow-y: auto;
        }

        /* ── Desktop tab shell ── */
        .bodhion-tabs-shell-wrap {
          position: relative; width: 100%;
          background: var(--bodhion-shell-bg); backdrop-filter: blur(22px);
          border: 1px solid var(--bodhion-shell-border); border-radius: 1.15rem;
          box-shadow: 0 8px 32px rgba(0,0,0,0.18); overflow: hidden;
        }
        .bodhion-tabs-scroll {
          display: flex; align-items: center; flex-wrap: nowrap;
          gap: 0.15rem; justify-content: flex-start;
          width: 100%; padding: 0.3rem;
          min-height: 3.2rem; overflow-x: auto; overflow-y: visible;
          scrollbar-width: none; -ms-overflow-style: none;
        }
        .bodhion-tabs-scroll::-webkit-scrollbar { display: none; }
        .bodhion-tab-btn {
          display: inline-flex; align-items: center; justify-content: center;
          flex-shrink: 0; white-space: nowrap;
          padding: 0.48rem 1rem; border-radius: 0.8rem;
          border: none; background: transparent;
          font-size: 0.84rem; font-weight: 500;
          color: var(--bodhion-text-secondary); cursor: pointer;
          transition: background 0.15s, color 0.15s;
        }
        .bodhion-tab-btn:hover { color: var(--bodhion-text-primary); background: rgba(255,255,255,0.05); }
        .bodhion-tab-btn--active {
          background: rgba(37,215,255,0.1);
          color: var(--bodhion-accent, #25d7ff);
          font-weight: 600;
        }
        .bodhion-tabs-fade {
          position: absolute; top: 0; right: 0; bottom: 0; width: 3rem;
          background: linear-gradient(to right, transparent, rgba(8,20,38,0.88) 80%);
          pointer-events: none; border-radius: 0 1.15rem 1.15rem 0;
        }
        html.light .bodhion-tabs-fade, html.bodhion-light .bodhion-tabs-fade {
          background: linear-gradient(to right, transparent, rgba(237,246,252,0.95) 80%);
        }

        /* ── Content scrollbar ── */
        .bodhion-scroll { scrollbar-width: thin; scrollbar-color: rgba(37,215,255,0.45) rgba(255,255,255,0.04); }
        .bodhion-scroll::-webkit-scrollbar { width: 6px; }
        .bodhion-scroll::-webkit-scrollbar-track { background: rgba(255,255,255,0.03); border-radius: 999px; }
        .bodhion-scroll::-webkit-scrollbar-thumb {
          background: linear-gradient(180deg, rgba(0,104,201,0.85), rgba(37,215,255,0.75));
          border-radius: 999px;
        }
      `}</style>
    </div>
  );
}
