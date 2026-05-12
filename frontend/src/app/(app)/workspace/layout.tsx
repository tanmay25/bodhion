'use client';

import { useEffect, useMemo } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { PanelLeft } from 'lucide-react';
import { Shell } from '@/components/layout/Shell';
import { AdminLoadingSplash } from '@/components/admin/AdminLoadingSplash';
import { AccessDenied } from '@/components/auth/AccessDenied';
import { useAuthContext } from '@/providers/AuthProvider';
import { useUIStore } from '@/store/uiStore';
import { cn } from '@/lib/utils/cn';

type WorkspaceSection = {
  id: string;
  path: string;
  title: string;
  description: string;
  requireAdmin?: boolean;
  permission?: 'models' | 'knowledge' | 'prompts' | 'skills' | 'tools';
};

const WORKSPACE_SECTIONS: WorkspaceSection[] = [
  {
    id: 'services',
    path: '/workspace/services',
    title: 'Services',
    description: 'Control dashboard service visibility and grant access by user, group, or public.',
    requireAdmin: true,
  },
  {
    id: 'models',
    path: '/workspace/models',
    title: 'Models',
    description: 'Manage workspace-ready models, access, defaults, and publishing details.',
    permission: 'models',
  },
  {
    id: 'knowledge',
    path: '/workspace/knowledge',
    title: 'Knowledge',
    description: 'Organize knowledge sources, collections, and retrieval-ready content.',
    permission: 'knowledge',
  },
  {
    id: 'prompts',
    path: '/workspace/prompts',
    title: 'Prompts',
    description: 'Create reusable prompt templates and keep instruction quality consistent.',
    permission: 'prompts',
  },
  {
    id: 'skills',
    path: '/workspace/skills',
    title: 'Skills',
    description: 'Curate specialized skills that extend workspace behavior and capability.',
    permission: 'skills',
  },
  {
    id: 'tools',
    path: '/workspace/tools',
    title: 'Tools',
    description: 'Configure toolkits and utility actions available across the workspace.',
    permission: 'tools',
  },
  {
    id: 'functions',
    path: '/workspace/functions',
    title: 'Functions',
    description: 'Build pipe, filter, and action functions to extend and customize model behavior.',
    requireAdmin: true,
  },
];

export default function WorkspaceLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, isLoaded } = useAuthContext();
  const { mobile, showSidebar, setShowSidebar } = useUIStore();

  // Admin-only: all sections are available to admins
  const availableSections = useMemo(() => WORKSPACE_SECTIONS, []);

  const activeSection =
    WORKSPACE_SECTIONS.find((section) => pathname.startsWith(section.path)) ??
    WORKSPACE_SECTIONS[0];

  useEffect(() => {
    if (!isLoaded || !user || user.role !== 'admin') return;

    const isKnownSection = WORKSPACE_SECTIONS.some((section) =>
      pathname.startsWith(section.path)
    );
    if (!isKnownSection && pathname !== '/workspace') {
      router.replace('/workspace/models');
    }
  }, [isLoaded, user, pathname, router]);

  return (
    <Shell>
      <div className={cn('relative flex h-screen max-h-[100dvh] w-full flex-col')}>
        <nav className="workspace-header select-none px-3 pt-2 backdrop-blur-xl md:px-[18px]">
          <div className="workspace-header-card">
            <div className="workspace-header-top flex items-start gap-3">
              {mobile && (
                <div className={cn(showSidebar ? 'md:hidden' : '', 'flex items-center self-start')}>
                  <button
                    id="sidebar-toggle-button"
                    className="workspace-sidebar-toggle flex cursor-pointer transition"
                    aria-label={showSidebar ? 'Close Sidebar' : 'Open Sidebar'}
                    onClick={() => setShowSidebar(!showSidebar)}
                  >
                    <div className="self-center p-1.5">
                      <PanelLeft className="h-4 w-4" style={{ color: 'var(--bodhion-text-primary)' }} />
                    </div>
                  </button>
                </div>
              )}

              <div className="workspace-header-copy min-w-0">
                <div className="workspace-eyebrow">BODHION WORKSPACE</div>
                <h1 className="workspace-title">{activeSection.title}</h1>
                <p className="workspace-description">{activeSection.description}</p>
              </div>
            </div>

            <div className="workspace-nav-shell">
              {mobile ? (
                <select
                  className="workspace-nav-select"
                  value={activeSection.path}
                  onChange={(e) => router.push(e.currentTarget.value)}
                >
                  {availableSections.map((section) => (
                    <option key={section.id} value={section.path}>
                      {section.title}
                    </option>
                  ))}
                </select>
              ) : (
                <div className="workspace-nav-rail flex w-fit max-w-full gap-2 text-center text-sm font-medium">
                  {availableSections.map((section) => {
                    const isActive =
                      pathname.startsWith(section.path) ||
                      (pathname === '/workspace' && section.id === activeSection.id);
                    return (
                      <Link
                        key={section.id}
                        draggable={false}
                        aria-current={isActive ? 'page' : undefined}
                        className={cn(
                          'workspace-nav-tab min-w-fit select-none',
                          isActive ? 'workspace-nav-tab--active' : 'workspace-nav-tab--idle'
                        )}
                        href={section.path}
                      >
                        {section.title}
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </nav>

        <div className="workspace-content max-h-full flex-1 overflow-y-auto px-3 pb-1 md:px-[18px]">
          {!isLoaded ? (
            <AdminLoadingSplash
              title="Loading Workspace…"
              subtitle="Fetching your workspace"
            />
          ) : user?.role !== 'admin' ? (
            <AccessDenied message="Workspace is restricted to administrators." />
          ) : (
            children
          )}
        </div>
      </div>
    </Shell>
  );
}
