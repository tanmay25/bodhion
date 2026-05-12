'use client';

// ─── ThemeProvider ────────────────────────────────────────────────────────────
// Wraps next-themes ThemeProvider and syncs the Zustand uiStore.theme.
// Mirrors the theme Svelte writable + localStorage.theme pattern.

import React, { useEffect } from 'react';
import { ThemeProvider as NextThemesProvider, useTheme } from 'next-themes';
import { useUIStore } from '@/store/uiStore';
import { getStoredTheme } from '@/lib/auth/session';

function ThemeSync() {
  const { theme } = useTheme();
  const setTheme = useUIStore((s) => s.setTheme);
  useEffect(() => {
    if (theme) setTheme(theme);
  }, [theme, setTheme]);
  return null;
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const storedTheme = getStoredTheme() ?? 'system';
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme={storedTheme}
      themes={['system', 'dark', 'bodhion-light', 'bodhion-midnight']}
      enableSystem
      disableTransitionOnChange
    >
      <ThemeSync />
      {children}
    </NextThemesProvider>
  );
}
