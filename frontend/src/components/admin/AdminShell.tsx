'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { ChevronDown, Check } from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import { useAuthStore } from '@/store/authStore';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '@/components/ui/Dropdown';

interface NavTab {
  id: string;
  label: string;
  href: string;
  featureFlag?: string;
}

const NAV_TABS: NavTab[] = [
  { id: 'users',       label: 'Users',       href: '/admin/users/overview' },
  { id: 'analytics',   label: 'Analytics',   href: '/admin/analytics',               featureFlag: 'enable_admin_analytics' },
  { id: 'evaluations', label: 'Evaluations', href: '/admin/evaluations/leaderboard', featureFlag: 'show_admin_evaluations' },
  { id: 'functions',   label: 'Functions',   href: '/admin/functions' },
  { id: 'settings',    label: 'Settings',    href: '/admin/settings/general' },
  { id: 'services',    label: 'Services',    href: '/admin/services' },
];

interface AdminShellProps {
  children: React.ReactNode;
}

export function AdminShell({ children }: AdminShellProps) {
  const pathname = usePathname();
  const router   = useRouter();
  const config   = useAuthStore((s) => s.config);

  const features = config?.features as Record<string, unknown> | undefined;

  const visibleTabs = NAV_TABS.filter((tab) => {
    if (!tab.featureFlag) return true;
    return features?.[tab.featureFlag] !== false;
  });

  const activeId  = pathname.split('/')[2] ?? 'users';
  const activeTab = visibleTabs.find((t) => t.id === activeId);

  return (
    <div className="flex h-full flex-col">

      {/* ── Top nav bar ────────────────────────────────────────────────── */}
      <div className="admin-nav-bar shrink-0">
        <div className="flex w-full items-center gap-3 px-4 sm:px-6">

          {/* Identity slot — text only */}
          <div className="admin-nav-identity">
            <span className="admin-nav-eyebrow">Admin</span>
          </div>

          {/* Desktop tabs */}
          <nav className="hidden items-center gap-0.5 sm:flex" aria-label="Admin navigation">
            {visibleTabs.map((tab) => {
              const isActive = activeId === tab.id;
              return (
                <Link
                  key={tab.id}
                  href={tab.href}
                  className={cn('admin-nav-tab', isActive && 'admin-nav-tab--active')}
                  aria-current={isActive ? 'page' : undefined}
                >
                  {tab.label}
                </Link>
              );
            })}
          </nav>

          {/* Mobile — Bodhion-themed Radix dropdown */}
          <div className="flex flex-1 items-center sm:hidden">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="admin-mobile-nav-trigger"
                  aria-label="Admin navigation"
                >
                  <span className="admin-mobile-nav-trigger__label">
                    {activeTab?.label ?? 'Navigate'}
                  </span>
                  <ChevronDown className="admin-mobile-nav-trigger__chevron" />
                </button>
              </DropdownMenuTrigger>

              <DropdownMenuContent align="start" className="admin-mobile-nav-menu">
                {visibleTabs.map((tab) => {
                  const isActive = activeId === tab.id;
                  return (
                    <DropdownMenuItem
                      key={tab.id}
                      onSelect={() => router.push(tab.href)}
                      className={cn(isActive && 'bodhion-dropdown-item--active')}
                    >
                      <span className="flex-1">{tab.label}</span>
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

        </div>
      </div>

      {/* ── Page content ─────────────────────────────────────────────── */}
      <div className="min-h-0 flex-1 overflow-y-auto">
        {children}
      </div>

      <style>{`
        /* Mobile nav trigger */
        .admin-mobile-nav-trigger {
          display: inline-flex;
          align-items: center;
          gap: 0.5rem;
          width: 100%;
          padding: 0.5rem 0.85rem;
          border-radius: 0.85rem;
          border: 1px solid var(--bodhion-shell-border, rgba(143,169,189,0.14));
          background: var(--bodhion-search-bg, rgba(18,29,47,0.9));
          color: var(--bodhion-text-primary, #eaf6ff);
          font-size: 0.86rem;
          font-weight: 600;
          cursor: pointer;
          transition: border-color 0.15s ease, background 0.15s ease;
          outline: none;
        }
        .admin-mobile-nav-trigger:hover {
          border-color: var(--bodhion-shell-border-strong, rgba(37,215,255,0.24));
          background: rgba(37,215,255,0.05);
        }
        .admin-mobile-nav-trigger:focus-visible {
          border-color: var(--bodhion-shell-border-strong, rgba(37,215,255,0.24));
          box-shadow: 0 0 0 3px rgba(37,215,255,0.12);
        }
        .admin-mobile-nav-trigger__label {
          flex: 1;
          text-align: left;
        }
        .admin-mobile-nav-trigger__chevron {
          width: 1rem;
          height: 1rem;
          color: var(--bodhion-text-secondary, #8fa9bd);
          flex-shrink: 0;
          transition: transform 0.18s ease;
        }
        [data-state="open"] .admin-mobile-nav-trigger__chevron {
          transform: rotate(180deg);
        }
        .admin-mobile-nav-menu {
          width: var(--radix-dropdown-menu-trigger-width);
          min-width: 180px;
        }
      `}</style>
    </div>
  );
}

export default AdminShell;
