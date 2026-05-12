'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthContext } from '@/providers/AuthProvider';
import { useAuthStore } from '@/store/authStore';
import { useWorkspaceStore } from '@/store/workspaceStore';
import { SocketProvider } from '@/providers/SocketProvider';
import { AccountPending } from '@/components/auth/AccountPending';

import { AUTH_PATH } from '@/lib/constants';
import { SettingsModal } from '@/components/settings/SettingsModal';
import { getModels } from '@/lib/api/models';
import { getToken } from '@/lib/auth/session';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, isLoaded } = useAuthContext();
  const config = useAuthStore((s) => s.config);
  const { settings, setModels } = useWorkspaceStore();
  const router = useRouter();

  // ── Load models into the global workspace store as soon as the user is authed
  useEffect(() => {
    if (!user) return;
    const token = getToken();
    if (!token) return;
    const directConnections =
      config?.features?.enable_direct_connections && settings?.directConnections
        ? settings.directConnections
        : null;
    getModels(token, directConnections).then(setModels).catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  useEffect(() => {
    if (isLoaded && !user) {
      const redirect = encodeURIComponent(window.location.pathname + window.location.search);
      router.replace(`${AUTH_PATH}?redirect=${redirect}`);
    }
  }, [isLoaded, user]);

  // While auth is bootstrapping, return null — SplashScreen (in root layout) covers this.
  // Returning a Spinner here caused a visible flash during login→dashboard navigation.
  if (!isLoaded) return null;

  if (!user) return null;

  if (user.role === 'pending') {
    return <AccountPending />;
  }

  return (
    <SocketProvider>
      {children}
      <SettingsModal />
    </SocketProvider>
  );
}
