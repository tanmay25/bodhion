'use client';

import { useRouter } from 'next/navigation';
import { ShieldX } from 'lucide-react';
import { Button } from '@/components/ui/Button';

interface AccessDeniedProps {
  message?: string;
}

export function AccessDenied({ message = 'You do not have permission to view this page.' }: AccessDeniedProps) {
  const router = useRouter();

  return (
    <div className="flex h-full min-h-[60vh] flex-col items-center justify-center gap-4 text-center">
      <ShieldX className="h-12 w-12 text-muted-foreground" />
      <div className="space-y-1">
        <h2 className="text-xl font-semibold">Access Denied</h2>
        <p className="text-sm text-muted-foreground">{message}</p>
      </div>
      <Button variant="outline" onClick={() => router.push('/')}>
        Go to home
      </Button>
    </div>
  );
}

export default AccessDenied;
