'use client';

import { useEffect } from 'react';
import { useUIStore } from '@/store/uiStore';
import { DashboardSidebar } from './DashboardSidebar';
import { ChatSidebar } from './ChatSidebar';
import { MOBILE_BREAKPOINT } from '@/lib/constants';

interface ShellProps {
  children: React.ReactNode;
  /**
   * When true, renders the chat history Sidebar (and NOT the DashboardSidebar).
   * Mirrors the Svelte layout: isChatSidebarRoute → Sidebar, else → DashboardSidebar.
   */
  withChatSidebar?: boolean;
}

export function Shell({ children, withChatSidebar = false }: ShellProps) {
  const { setMobile, setShowSidebar } = useUIStore();

  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`);

    const handleChange = (matches: boolean) => {
      setMobile(matches);
      // Auto-close the sidebar when the window shrinks into mobile range.
      // Without this, an open sidebar converts to position:fixed overlay and
      // blocks the entire content area when the user resizes the browser.
      if (matches) setShowSidebar(false);
    };

    handleChange(mq.matches); // apply immediately on mount
    const handler = (e: MediaQueryListEvent) => handleChange(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, [setMobile, setShowSidebar]);

  return (
    <div className="flex h-screen w-full overflow-hidden bg-background text-foreground">
      {withChatSidebar ? <ChatSidebar /> : <DashboardSidebar />}
      <main className="flex min-w-0 flex-1 flex-col overflow-hidden">
        {children}
      </main>
    </div>
  );
}

export default Shell;
