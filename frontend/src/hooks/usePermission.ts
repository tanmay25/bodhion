'use client';

// ─── usePermission ────────────────────────────────────────────────────────────
// Boolean permission check hook.  Mirrors every $user?.permissions?. guard
// found in the Svelte app, e.g. {#if $user?.permissions?.chat?.temporary}.
//
// Usage:
//   const canTemp = usePermission('chat.temporary');       // boolean
//   const adminOnly = usePermission(null, 'admin');        // true if admin

import { useAuthStore } from '@/store/authStore';
import {
  hasPermission,
  canAccess,
  isAdmin,
  isActiveUser,
} from '@/lib/auth/permissions';
import type { UserRole } from '@/types/auth';

/**
 * @param permissionPath  Dot-separated path into user.permissions, or null.
 * @param requiredRole    Optional role requirement ('admin' | 'user').
 * @param defaultValue    Fallback when the permission key is absent (default: true).
 */
export function usePermission(
  permissionPath: string | null,
  requiredRole?: UserRole,
  defaultValue = true
): boolean {
  const user = useAuthStore((s) => s.user) ?? null;

  if (!user) return false;

  if (requiredRole) {
    return canAccess(user, { requiredRole });
  }

  if (permissionPath) {
    return hasPermission(user, permissionPath, defaultValue);
  }

  return isActiveUser(user);
}

/** Shorthand: returns true only for admin role. */
export function useIsAdmin(): boolean {
  const user = useAuthStore((s) => s.user) ?? null;
  return isAdmin(user);
}
