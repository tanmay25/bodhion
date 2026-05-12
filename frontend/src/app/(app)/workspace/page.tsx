'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthContext } from '@/providers/AuthProvider';
import { AdminLoadingSplash } from '@/components/admin/AdminLoadingSplash';

export default function WorkspaceIndexPage() {
  const router = useRouter();
  const { user } = useAuthContext();

  useEffect(() => {
    if (!user) return;
    router.replace('/workspace/models');
  }, [router, user]);

  return (
    <AdminLoadingSplash
      title="Loading Workspace…"
      subtitle="Redirecting to workspace"
    />
  );
}
