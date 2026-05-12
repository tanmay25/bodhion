'use client';

import { cn } from '@/lib/utils/cn';

/**
 * SidebarShell — base chrome for all sidebars in the app.
 *
 * Provides the outer <aside> element with:
 *   - Bodhion-token-driven background and border (responds to all 3 themes)
 *   - Mobile overlay + fixed positioning
 *   - Collapsed icon-rail mode (w-14)
 *   - Optional mobile overlay backdrop
 *
 * Usage:
 *   <SidebarShell>                    → expanded desktop
 *   <SidebarShell collapsed>          → icon-rail
 *   <SidebarShell mobile onOverlayClick={...}> → mobile overlay
 */

interface SidebarShellProps {
  children: React.ReactNode;
  /** Icon-rail (collapsed) mode — 56px wide, items centred */
  collapsed?: boolean;
  /** Mobile overlay mode — fixed, full height, z-50 */
  mobile?: boolean;
  /** Called when the mobile backdrop is clicked */
  onOverlayClick?: () => void;
  /** Forwarded ref for resize logic */
  sidebarRef?: React.RefObject<HTMLElement | null>;
  /** Inline width override (desktop resizable sidebar) */
  width?: number;
  className?: string;
}

export function SidebarShell({
  children,
  collapsed = false,
  mobile = false,
  onOverlayClick,
  sidebarRef,
  width,
  className,
}: SidebarShellProps) {
  return (
    <>
      {/* Mobile backdrop */}
      {mobile && !collapsed && (
        <div
          className="fixed inset-0 z-40 bg-black/50"
          onClick={onOverlayClick}
          aria-hidden
        />
      )}

      <aside
        ref={sidebarRef}
        className={cn(
          'sidebar-shell',
          collapsed && 'sidebar-shell--collapsed',
          mobile && !collapsed && 'sidebar-shell--mobile',
          className
        )}
        style={!mobile && !collapsed && width ? { width } : undefined}
      >
        {children}
      </aside>
    </>
  );
}

export default SidebarShell;
