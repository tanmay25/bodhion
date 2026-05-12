'use client';

import { useAuthContext } from '@/providers/AuthProvider';
import { AccessDenied }  from '@/components/auth/AccessDenied';
import { Spinner }       from '@/components/ui/Spinner';
import { Shell }         from '@/components/layout/Shell';
import { AdminShell }    from '@/components/admin/AdminShell';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { user, isLoaded } = useAuthContext();

  if (!isLoaded) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Spinner size="lg" />
      </div>
    );
  }

  if (!user || user.role !== 'admin') {
    return <AccessDenied message="This area is restricted to administrators." />;
  }

  return (
    <Shell>
      <AdminShell>
        {children}
      </AdminShell>
    </Shell>
  );
}
