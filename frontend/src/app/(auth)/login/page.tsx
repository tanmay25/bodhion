'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { LoginForm } from '@/components/auth/LoginForm';
import { OnboardingSplash } from '@/components/auth/OnboardingSplash';
import { Spinner } from '@/components/ui/Spinner';
import { getBackendConfig } from '@/lib/api/auth';
import { getToken } from '@/lib/auth/session';
import type { BackendConfig } from '@/types/config';

export default function LoginPage() {
  const router = useRouter();
  const [config, setConfig] = useState<BackendConfig | null>(null);
  const [checking, setChecking] = useState(true);
  const [splashDone, setSplashDone] = useState(false);

  useEffect(() => {
    // If already signed in, redirect to home
    if (getToken()) {
      router.replace('/');
      return;
    }
    getBackendConfig()
      .then(setConfig)
      .catch(() => null)
      .finally(() => setChecking(false));
  }, []);

  if (checking) {
    return (
      <div className="flex h-full items-center justify-center">
        <Spinner size="lg" />
      </div>
    );
  }

  const isOnboarding = config?.onboarding === true;

  // Show onboarding splash fullscreen before the auth card when first-time setup
  if (isOnboarding && !splashDone) {
    return <OnboardingSplash onGetStarted={() => setSplashDone(true)} />;
  }

  return <LoginForm config={config} isOnboarding={isOnboarding} onSuccess={() => {}} />;
}
