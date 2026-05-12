'use client';

// ─── useAuth ──────────────────────────────────────────────────────────────────
// Convenience hook — exposes user, isLoaded, isAdmin, isActiveUser, signOut.
// Components should call this instead of accessing the store directly.

import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/authStore';
import { getToken, clearSession } from '@/lib/auth/session';
import { userSignOut } from '@/lib/api/auth';
import { isAdmin, isActiveUser, isPending } from '@/lib/auth/permissions';
import { AUTH_PATH } from '@/lib/constants';

export function useAuth() {
  const { user, config, webuiName } = useAuthStore();
  const router = useRouter();

  const isLoaded = user !== undefined;
  const isAuthenticated = isActiveUser(user ?? null);
  const admin = isAdmin(user ?? null);
  const pending = isPending(user ?? null);
  const token = getToken();

  const signOut = async () => {
    const res = await userSignOut().catch(() => null);
    useAuthStore.getState().setUser(null);
    clearSession();
    window.location.href = res?.redirect_url ?? AUTH_PATH;
  };

  const requireAuth = () => {
    if (isLoaded && !isAuthenticated) {
      const encoded = encodeURIComponent(window.location.pathname + window.location.search);
      router.replace(`${AUTH_PATH}?redirect=${encoded}`);
    }
  };

  const requireAdmin = () => {
    if (isLoaded && !admin) {
      router.replace('/');
    }
  };

  return {
    user: user ?? null,
    token,
    config,
    webuiName,
    isLoaded,
    isAuthenticated,
    isAdmin: admin,
    isPending: pending,
    signOut,
    requireAuth,
    requireAdmin,
  };
}
