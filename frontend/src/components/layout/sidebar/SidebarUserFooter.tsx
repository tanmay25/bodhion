'use client';

import { useState } from 'react';
import {
  Settings, LogOut, Archive, FlaskConical, ShieldCheck, Smile,
} from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/Avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/Dropdown';
import { UserStatusModal } from '@/components/layout/UserStatusModal';
import { useUIStore } from '@/store/uiStore';
import { getInitials } from '@/lib/utils/format';
import { cn } from '@/lib/utils/cn';

/**
 * SidebarUserFooter — shared user profile + dropdown used by all sidebars.
 *
 * Styling is driven by CSS custom properties (sidebar-user-footer-trigger,
 * sidebar-user-name, sidebar-user-role) defined in src/styles/sidebar.css.
 * All three Bodhion themes respond automatically — no Tailwind dark: overrides.
 *
 * Replaces the duplicated UserMenuDropdown that existed separately in
 * DashboardSidebar.tsx and Sidebar.tsx.
 *
 * Usage:
 *   <SidebarUserFooter user={user} onSignOut={fn} onNavigate={router.push} />
 *   <SidebarUserFooter user={user} onSignOut={fn} onNavigate={router.push} collapsed />
 */

export interface SidebarUserFooterUser {
  id: string;
  name: string;
  email: string;
  role: string;
  profile_image_url?: string | null;
  is_active?: boolean;
  status_emoji?: string;
  status_message?: string;
}

interface SidebarUserFooterProps {
  user: SidebarUserFooterUser;
  onSignOut: () => void;
  onNavigate: (path: string) => void;
  /** Collapsed icon-only mode */
  collapsed?: boolean;
}

export function SidebarUserFooter({
  user,
  onSignOut,
  onNavigate,
  collapsed = false,
}: SidebarUserFooterProps) {
  const setShowSettings = useUIStore((s) => s.setShowSettings);
  const [showStatus, setShowStatus] = useState(false);

  const profileImageSrc = user.profile_image_url || undefined;
  const isActive = user.is_active ?? true;
  const statusEmoji = user.status_emoji ?? '';
  const statusMessage = user.status_message ?? '';

  const trigger = collapsed ? (
    <div className="sidebar-user-footer-trigger sidebar-user-footer-trigger--collapsed">
      <Avatar className="h-7 w-7">
        <AvatarImage src={profileImageSrc} alt={user.name} />
        <AvatarFallback className="text-[10px]">{getInitials(user.name)}</AvatarFallback>
      </Avatar>
    </div>
  ) : (
    <div className="sidebar-user-footer-trigger">
      <Avatar className="h-9 w-9 shrink-0">
        <AvatarImage src={profileImageSrc} alt={user.name} />
        <AvatarFallback className="text-xs">{getInitials(user.name)}</AvatarFallback>
      </Avatar>
      <div className="min-w-0">
        <div className="sidebar-user-name">{user.name}</div>
        <div className="sidebar-user-role">{user.role}</div>
      </div>
    </div>
  );

  return (
    <div className="sidebar-user-footer">
      <UserStatusModal open={showStatus} onClose={() => setShowStatus(false)} />

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className="w-full focus:outline-none" aria-label="User menu">
            {trigger}
          </button>
        </DropdownMenuTrigger>

        <DropdownMenuContent side="top" align="start" className="user-menu-content mb-1">
          {/* Header */}
          <div className="user-menu-header">
            <Avatar className="h-8 w-8 shrink-0">
              <AvatarImage src={profileImageSrc} alt={user.name} />
              <AvatarFallback className="text-xs">{getInitials(user.name)}</AvatarFallback>
            </Avatar>
            <div className="user-menu-info">
              <p className="user-menu-name">{user.name}</p>
              <div className="user-menu-status-row">
                <span
                  className={cn(
                    'user-menu-status-dot',
                    isActive ? 'user-menu-status-dot--active' : 'user-menu-status-dot--away',
                  )}
                />
                <span className="user-menu-status-label">{isActive ? 'Active' : 'Away'}</span>
              </div>
            </div>
          </div>

          {/* Status */}
          <div className="user-menu-status-wrap">
            <button
              type="button"
              className="user-menu-status-btn"
              onClick={() => setShowStatus(true)}
            >
              {statusEmoji ? (
                <span className="text-base leading-none">{statusEmoji}</span>
              ) : (
                <Smile className="h-4 w-4" />
              )}
              <span className="truncate">{statusMessage || 'Update your status'}</span>
            </button>
          </div>

          <div className="user-menu-separator" />

          <DropdownMenuItem className="user-menu-item" onClick={() => setShowSettings(true)}>
            <Settings className="mr-2 h-4 w-4" />
            Settings
          </DropdownMenuItem>

          <DropdownMenuItem
            className="user-menu-item"
            onClick={() => onNavigate('/archived-chats')}
          >
            <Archive className="mr-2 h-4 w-4" />
            Archived Chats
          </DropdownMenuItem>

          {user.role === 'admin' && (
            <DropdownMenuItem
              className="user-menu-item"
              onClick={() => onNavigate('/playground')}
            >
              <FlaskConical className="mr-2 h-4 w-4" />
              Playground
            </DropdownMenuItem>
          )}

          {user.role === 'admin' && (
            <DropdownMenuItem
              className="user-menu-item"
              onClick={() => onNavigate('/admin')}
            >
              <ShieldCheck className="mr-2 h-4 w-4" />
              Admin Panel
            </DropdownMenuItem>
          )}

          <div className="user-menu-separator" />

          <DropdownMenuItem
            className="user-menu-item user-menu-item--destructive"
            onClick={onSignOut}
          >
            <LogOut className="mr-2 h-4 w-4" />
            Sign Out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

export default SidebarUserFooter;
