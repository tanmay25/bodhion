'use client';

import { useAuthContext } from '@/providers/AuthProvider';
import { AccessDenied } from './AccessDenied';
import { AccountPending } from './AccountPending';
import { Spinner } from '@/components/ui/Spinner';
import type { UserRole } from '@/types/auth';

interface PrivilegeGuardProps {
  children: React.ReactNode;
  /** Minimum role required; defaults to 'user' */
  requiredRole?: UserRole;
}

export function PrivilegeGuard({ children, requiredRole = 'user' }: PrivilegeGuardProps) {
  const { user, isLoaded } = useAuthContext();

  if (!isLoaded) {
    return (
      <div className="flex h-full items-center justify-center">
        <Spinner size="lg" />
      </div>
    );
  }

  if (!user) {
    return <AccessDenied message="You must be signed in to view this page." />;
  }

  if (user.role === 'pending') {
    return <AccountPending />;
  }

  if (requiredRole === 'admin' && user.role !== 'admin') {
    return <AccessDenied message="This page is restricted to administrators." />;
  }

  return <>{children}</>;
}

export default PrivilegeGuard;
