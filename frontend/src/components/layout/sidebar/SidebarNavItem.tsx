'use client';

import Link from 'next/link';
import type { LucideIcon } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  TooltipProvider,
} from '@/components/ui/Tooltip';
import { cn } from '@/lib/utils/cn';

/**
 * SidebarNavItem — theme-aware navigation link for any sidebar.
 *
 * Styling is driven exclusively by CSS custom properties:
 *   --bodhion-nav-idle-bg / --bodhion-nav-idle-color
 *   --bodhion-nav-active-bg / --bodhion-nav-active-border / --bodhion-nav-active-color
 *   --bodhion-sidebar-hover-bg
 *
 * All three Bodhion themes (dark / light / midnight) provide their own token values,
 * so this component requires no Tailwind dark: prefixes or hardcoded hex colors.
 *
 * Usage:
 *   <SidebarNavItem href="/" icon={Home} label="Home" isActive />
 *   <SidebarNavItem href="/ws" icon={Grid} label="Workspace" collapsed />
 */

interface SidebarNavItemProps {
  href: string;
  icon: LucideIcon;
  label: string;
  isActive?: boolean;
  isDisabled?: boolean;
  /** Icon-only mode — shows label as tooltip instead */
  collapsed?: boolean;
  onClick?: () => void;
}

export function SidebarNavItem({
  href,
  icon: Icon,
  label,
  isActive = false,
  isDisabled = false,
  collapsed = false,
  onClick,
}: SidebarNavItemProps) {
  const state = isActive ? 'active' : isDisabled ? 'disabled' : 'idle';

  const link = (
    <Link
      href={isDisabled ? '#' : href}
      aria-label={label}
      aria-disabled={isDisabled}
      onClick={(e) => {
        if (isDisabled) { e.preventDefault(); return; }
        onClick?.();
      }}
      className={cn(
        'sidebar-nav-item',
        `sidebar-nav-item--${state}`,
        collapsed && 'sidebar-nav-item--collapsed',
      )}
    >
      <Icon className="h-4 w-4 shrink-0" />
      {!collapsed && <span>{label}</span>}
    </Link>
  );

  if (collapsed) {
    return (
      <TooltipProvider delayDuration={300}>
        <Tooltip>
          <TooltipTrigger asChild>{link}</TooltipTrigger>
          <TooltipContent side="right">{label}</TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return link;
}

export default SidebarNavItem;
