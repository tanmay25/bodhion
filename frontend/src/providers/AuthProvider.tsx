'use client';

// ─── AuthProvider ─────────────────────────────────────────────────────────────
// Mirrors the auth bootstrap in src/routes/+layout.svelte (Svelte app):
//  1. getBackendConfig() on mount
//  2. getSessionUser(token) if token exists → populate user store
//  3. Token expiry check every 15 s + on tab focus
//  4. Redirect to /login on missing/invalid token (mirrors goto('/auth?redirect=...'))

import React, { createContext, useContext, useEffect, useCallback, useRef } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuthStore } from '@/store/authStore';
import { useWorkspaceStore } from '@/store/workspaceStore';
import { getToken, clearSession, getOAuthTokenCookie, clearOAuthTokenCookie } from '@/lib/auth/session';
import { getSessionUser, getBackendConfig, userSignOut } from '@/lib/api/auth';
import { getUserSettings } from '@/lib/api/users';
import { TOKEN_EXPIRY_BUFFER, AUTH_PATH } from '@/lib/constants';
import type { SessionUser } from '@/types/auth';

interface AuthContextValue {
  user: SessionUser | null | undefined;
  isLoaded: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue>({
  user: undefined,
  isLoaded: false,
  signOut: async () => {},
});

export function useAuthContext() {
  return useContext(AuthContext);
}

const PUBLIC_PATHS = [AUTH_PATH, '/login', '/error', '/s'];

function isPublicPath(pathname: string) {
  return PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + '/'));
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();

  const { user, setUser, setConfig, setWebuiName } =
    useAuthStore();
  const { setSettings } = useWorkspaceStore();

  const isLoaded = user !== undefined;
  const tokenTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Token expiry check (mirrors checkTokenExpiry in +layout.svelte) ─────────
  const checkTokenExpiry = useCallback(async () => {
    const currentUser = useAuthStore.getState().user;
    const exp = currentUser?.expires_at;
    if (!exp) return;
    const now = Math.floor(Date.now() / 1000);
    if (now >= exp - TOKEN_EXPIRY_BUFFER) {
      const res = await userSignOut().catch(() => null);
      setUser(null);
      clearSession();
      window.location.href = res?.redirect_url ?? AUTH_PATH;
    }
  }, [setUser]);

  // ── Bootstrap (runs once on mount) ──────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;

    const bootstrap = async () => {
      // Check for OAuth token cookie first (mirrors oauthCallbackHandler)
      const oauthToken = getOAuthTokenCookie();
      if (oauthToken) {
        clearOAuthTokenCookie();
        const sessionUser = await getSessionUser(oauthToken).catch(() => null);
        if (sessionUser && !cancelled) {
          const { setToken } = await import('@/lib/auth/session');
          setToken(oauthToken);
          setUser(sessionUser);
        }
      }

      // Load backend config (non-fatal — app still renders login page if backend is down)
      const backendConfig = await getBackendConfig().catch(() => null);
      if (backendConfig && !cancelled) {
        setConfig(backendConfig);
        const resolvedName =
          backendConfig.name && backendConfig.name !== 'Open WebUI'
            ? backendConfig.name
            : 'Bodhion';
        setWebuiName(resolvedName);
      }

      const token = getToken();
      if (!token) {
        if (!cancelled && !isPublicPath(pathname)) {
          const encoded = encodeURIComponent(pathname + window.location.search);
          router.replace(`${AUTH_PATH}?redirect=${encoded}`);
        }
        if (!cancelled) setUser(null);
        return;
      }

      // Validate token
      const sessionUser = await getSessionUser(token).catch(() => null);
      if (!sessionUser) {
        clearSession();
        if (!cancelled && !isPublicPath(pathname)) {
          const encoded = encodeURIComponent(pathname + window.location.search);
          router.replace(`${AUTH_PATH}?redirect=${encoded}`);
        }
        if (!cancelled) setUser(null);
        return;
      }

      if (!cancelled) {
        setUser(sessionUser);

        // Load user settings
        const userSettings = await getUserSettings(token).catch(() => null);
        if (userSettings?.ui) {
          setSettings(userSettings.ui);
        }

        // Re-fetch config with auth
        const freshConfig = await getBackendConfig().catch(() => null);
        if (freshConfig) setConfig(freshConfig);
      }
    };

    bootstrap();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Token expiry interval (mirrors tokenTimer in +layout.svelte) ─────────────
  useEffect(() => {
    if (!user) {
      if (tokenTimerRef.current) clearInterval(tokenTimerRef.current);
      return;
    }
    tokenTimerRef.current = setInterval(checkTokenExpiry, 15_000);
    return () => {
      if (tokenTimerRef.current) clearInterval(tokenTimerRef.current);
    };
  }, [user, checkTokenExpiry]);

  // ── Tab focus token check (mirrors visibilitychange handler) ─────────────────
  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === 'visible') checkTokenExpiry();
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, [checkTokenExpiry]);

  // ── Sign out helper ───────────────────────────────────────────────────────────
  const signOut = useCallback(async () => {
    const res = await userSignOut().catch(() => null);
    setUser(null);
    clearSession();
    window.location.href = res?.redirect_url ?? AUTH_PATH;
  }, [setUser]);

  return (
    <AuthContext.Provider value={{ user: user ?? null, isLoaded, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}
