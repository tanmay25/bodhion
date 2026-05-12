'use client';

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { Home, LayoutGrid, LifeBuoy, PanelLeft } from 'lucide-react';
import { useAuthContext } from '@/providers/AuthProvider';
import { useUIStore } from '@/store/uiStore';
import { userSignOut } from '@/lib/api/auth';
import { clearSession } from '@/lib/auth/session';
import { AUTH_PATH } from '@/lib/constants';
import { SidebarShell } from '@/components/layout/sidebar/SidebarShell';
import { SidebarNavItem } from '@/components/layout/sidebar/SidebarNavItem';
import { SidebarUserFooter } from '@/components/layout/sidebar/SidebarUserFooter';

export function DashboardSidebar() {
  const router = useRouter();
  const pathname = usePathname();
  const { user } = useAuthContext();
  const { showSidebar, setShowSidebar, mobile } = useUIStore();
  // Persist sidebar state to localStorage (matches Svelte behavior — default open)
  useEffect(() => {
    const stored = localStorage.getItem('dashboard-sidebar');
    if (stored !== null) setShowSidebar(stored === 'true');
  }, []);

  useEffect(() => {
    localStorage.setItem('dashboard-sidebar', showSidebar ? 'true' : 'false');
  }, [showSidebar]);

  const canAccessWorkspace = user?.role === 'admin';

  const menuItems = [
    {
      label: 'Home',
      href: '/',
      icon: Home,
      isActive: pathname === '/' || pathname === '/home',
      isDisabled: false,
    },
    ...(canAccessWorkspace
      ? [{
          label: 'Workspace',
          href: '/workspace',
          icon: LayoutGrid,
          isActive: pathname === '/workspace' || pathname.startsWith('/workspace/'),
          isDisabled: false,
        }]
      : []),
    {
      label: 'Support',
      href: '/support',
      icon: LifeBuoy,
      isActive: pathname === '/support' || pathname.startsWith('/support/'),
      isDisabled: false,
    },
  ];

  async function handleSignOut() {
    await userSignOut().catch(() => {});
    clearSession();
    router.push(AUTH_PATH);
  }

  // Mobile: floating open button when collapsed
  if (!showSidebar && mobile) {
    return (
      <button
        className="sidebar-shell-toggle fixed left-3 top-3 z-40"
        onClick={() => setShowSidebar(true)}
        aria-label="Open Sidebar"
      >
        <PanelLeft className="h-4 w-4" />
      </button>
    );
  }

  // Desktop collapsed: icon-only rail
  if (!showSidebar) {
    return (
      <SidebarShell collapsed className="flex">
        <div className="flex h-full w-full flex-col items-center p-2.5">
          <div className="flex w-full flex-col items-center gap-1">
            <button
              className="sidebar-shell-toggle"
              onClick={() => setShowSidebar(true)}
              aria-label="Open Sidebar"
            >
              <PanelLeft className="h-4 w-4" />
            </button>
            <div className="mt-4 flex flex-col gap-1">
              {menuItems.map((item) => (
                <SidebarNavItem
                  key={item.label}
                  href={item.href}
                  icon={item.icon}
                  label={item.label}
                  isActive={item.isActive}
                  isDisabled={item.isDisabled}
                  collapsed
                />
              ))}
            </div>
          </div>

          {user && (
            <div className="mt-auto pb-1">
              <SidebarUserFooter
                user={user}
                onSignOut={handleSignOut}
                onNavigate={router.push}
                collapsed
              />
            </div>
          )}
        </div>
      </SidebarShell>
    );
  }

  // Expanded sidebar
  return (
    <SidebarShell
      mobile={mobile}
      onOverlayClick={() => setShowSidebar(false)}
      className={mobile ? '' : 'w-56 min-h-full'}
    >
      <div className="flex h-full flex-col p-3 sm:p-4">
        {/* Header */}
        <div className="mb-3">
          <div className="mb-1 flex h-7 w-full items-center overflow-hidden">
            <img
              src="/static/bodhion_icon.svg"
              alt="Bodhion"
              className="h-full w-auto max-w-full object-contain object-left"
              draggable={false}
            />
          </div>

          {/* Bodhion logo + text + toggle */}
          <div className="flex items-center justify-between gap-2.5">
            <div className="flex min-w-0 items-center gap-2.5">
              <picture>
                <source srcSet="/static/logo-bodhion-dark.jpeg" media="(prefers-color-scheme: dark)" />
                <img
                  src="/static/logo-bodhion-light.png"
                  alt="Bodhion"
                  className="h-8 w-auto"
                  draggable={false}
                />
              </picture>
              <span className="truncate text-lg font-semibold sidebar-user-name">
                Bodhion
              </span>
            </div>
            <button
              className="sidebar-shell-toggle"
              onClick={() => setShowSidebar(false)}
              aria-label="Close Sidebar"
            >
              <PanelLeft className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex flex-col gap-1.5">
          {menuItems.map((item) => (
            <SidebarNavItem
              key={item.label}
              href={item.href}
              icon={item.icon}
              label={item.label}
              isActive={item.isActive}
              isDisabled={item.isDisabled}
              onClick={() => { if (mobile) setShowSidebar(false); }}
            />
          ))}
        </nav>

        {/* Footer */}
        {user && (
          <div className="mt-auto pt-4">
            <SidebarUserFooter
              user={user}
              onSignOut={handleSignOut}
              onNavigate={router.push}
            />
          </div>
        )}
      </div>
    </SidebarShell>
  );
}

export default DashboardSidebar;
