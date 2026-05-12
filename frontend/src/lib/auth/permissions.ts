// ─── Permission / Role helpers ────────────────────────────────────────────────
// Replicates every privilege guard found in the Svelte app.

import type { SessionUser, UserRole } from '@/types/auth';

// ── Role constants ────────────────────────────────────────────────────────────
export const ROLES = {
  ADMIN: 'admin' as UserRole,
  USER: 'user' as UserRole,
  PENDING: 'pending' as UserRole,
} as const;

// ── Role checks ───────────────────────────────────────────────────────────────

/** Returns true if the user has an active (non-pending) role. */
export function isActiveUser(user: SessionUser | null | undefined): boolean {
  return user?.role === ROLES.ADMIN || user?.role === ROLES.USER;
}

export function isAdmin(user: SessionUser | null | undefined): boolean {
  return user?.role === ROLES.ADMIN;
}

export function isPending(user: SessionUser | null | undefined): boolean {
  return user?.role === ROLES.PENDING;
}

// ── Permission checks (mirrors $user?.permissions?.... guards in Svelte) ──────

/** Generic nested-key permission read. Path is dot-separated, e.g. "chat.temporary". */
export function hasPermission(
  user: SessionUser | null | undefined,
  path: string,
  defaultValue = true
): boolean {
  if (!user) return false;
  const parts = path.split('.');
  let cursor: unknown = user.permissions;
  for (const part of parts) {
    if (cursor == null || typeof cursor !== 'object') return defaultValue;
    cursor = (cursor as Record<string, unknown>)[part];
  }
  return cursor === undefined ? defaultValue : Boolean(cursor);
}

/** Chat permissions */
export const canCreateTemporaryChat = (user: SessionUser | null | undefined) =>
  isAdmin(user) || hasPermission(user, 'chat.temporary', true);

export const isTemporaryChatEnforced = (user: SessionUser | null | undefined) =>
  !isAdmin(user) && hasPermission(user, 'chat.temporary_enforced', false);

export const canUploadFiles = (user: SessionUser | null | undefined) =>
  hasPermission(user, 'chat.file_upload', true);

export const canUseWebSearch = (user: SessionUser | null | undefined) =>
  hasPermission(user, 'chat.web_search', true);

export const canGenerateImages = (user: SessionUser | null | undefined) =>
  hasPermission(user, 'chat.image_generation', true);

export const canUseCodeInterpreter = (user: SessionUser | null | undefined) =>
  hasPermission(user, 'chat.code_interpreter', true);

export const canUseSTT = (user: SessionUser | null | undefined) =>
  hasPermission(user, 'chat.stt', true);

/** Workspace permissions */
export const canAccessWorkspaceModels = (user: SessionUser | null | undefined) =>
  hasPermission(user, 'workspace.models', true);

export const canAccessWorkspaceKnowledge = (user: SessionUser | null | undefined) =>
  hasPermission(user, 'workspace.knowledge', true);

export const canAccessWorkspacePrompts = (user: SessionUser | null | undefined) =>
  hasPermission(user, 'workspace.prompts', true);

export const canAccessWorkspaceTools = (user: SessionUser | null | undefined) =>
  hasPermission(user, 'workspace.tools', true);

/** Feature permissions */
export const canAccessNotes = (user: SessionUser | null | undefined) =>
  hasPermission(user, 'features.notes', true);

export const canAccessChannels = (user: SessionUser | null | undefined) =>
  hasPermission(user, 'features.channels', true);

/**
 * Central access check used by PrivilegeGuard.
 * Returns true when the user satisfies the required role or permission.
 */
export function canAccess(
  user: SessionUser | null | undefined,
  options: {
    requiredRole?: UserRole;
    requiredPermission?: string;
    defaultPermission?: boolean;
  }
): boolean {
  if (!user) return false;
  if (options.requiredRole) {
    if (options.requiredRole === ROLES.ADMIN) return isAdmin(user);
    if (options.requiredRole === ROLES.USER) return isActiveUser(user);
  }
  if (options.requiredPermission) {
    return hasPermission(user, options.requiredPermission, options.defaultPermission ?? true);
  }
  return isActiveUser(user);
}
