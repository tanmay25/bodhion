'use client';

import { useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { getFunctionById, type AdminFunction } from '@/lib/api/admin/functions';
import { FunctionEditor } from '@/components/admin/functions/FunctionEditor';
import { getToken } from '@/lib/auth/session';

export default function AdminFunctionsEditPage() {
  const searchParams = useSearchParams();
  const router       = useRouter();
  const id           = searchParams.get('id');

  const [func,    setFunc]    = useState<AdminFunction | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) { router.replace('/admin/functions'); return; }
    const token = getToken();
    if (!token) { router.replace('/admin/functions'); return; }

    getFunctionById(token, id)
      .then(setFunc)
      .catch(() => router.replace('/admin/functions'))
      .finally(() => setLoading(false));
  }, [id, router]);

  if (loading) {
    return (
      <div className="flex h-[calc(100vh-56px)] items-center justify-center">
        <span className="animate-pulse text-sm" style={{ color: 'var(--bodhion-text-secondary)' }}>
          Loading function…
        </span>
      </div>
    );
  }

  if (!func) return null;

  return (
    <div className="flex h-[calc(100vh-56px)] flex-col p-4">
      <FunctionEditor mode="edit" initial={func} />
    </div>
  );
}
