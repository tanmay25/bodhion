// ─── Session helpers ──────────────────────────────────────────────────────────
// Mirrors the Svelte app's localStorage.token pattern exactly.
// All access to the JWT token is centralised here so it can be changed
// (e.g. moved to httpOnly cookie) without touching every consumer.

const TOKEN_KEY = 'token';
const LOCALE_KEY = 'locale';
const THEME_KEY = 'theme';
const REDIRECT_PATH_KEY = 'redirectPath';

/** Read the stored Bearer token. Returns null if not set or not in browser. */
export function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(TOKEN_KEY);
}

/** Persist the Bearer token. */
export function setToken(token: string): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(TOKEN_KEY, token);
}

/** Remove the token and clean up session-related keys. */
export function clearSession(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(TOKEN_KEY);
}

// ── Redirect path ─────────────────────────────────────────────────────────────
export function getRedirectPath(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(REDIRECT_PATH_KEY);
}

export function setRedirectPath(path: string): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(REDIRECT_PATH_KEY, path);
}

export function clearRedirectPath(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(REDIRECT_PATH_KEY);
}

// ── Theme ─────────────────────────────────────────────────────────────────────
export function getStoredTheme(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(THEME_KEY);
}

export function setStoredTheme(theme: string): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(THEME_KEY, theme);
}

// ── Locale ────────────────────────────────────────────────────────────────────
export function getStoredLocale(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(LOCALE_KEY);
}

export function setStoredLocale(locale: string): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(LOCALE_KEY, locale);
}

// ── OAuth cookie helper (mirrors oauthCallbackHandler in auth/+page.svelte) ──
/** Read the `token` cookie that OAuth providers set on redirect. */
export function getOAuthTokenCookie(): string | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.match(
    new RegExp('(?:^|; )token=([^;]*)')
  );
  return match ? decodeURIComponent(match[1]) : null;
}

/** Clear the `token` cookie after it has been moved to localStorage. */
export function clearOAuthTokenCookie(): void {
  if (typeof document === 'undefined') return;
  document.cookie = 'token=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
}
