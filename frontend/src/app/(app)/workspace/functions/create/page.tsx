'use client';

import { useEffect, useState } from 'react';
import { FunctionEditor } from '@/components/admin/functions/FunctionEditor';
import type { AdminFunction } from '@/lib/api/admin/functions';

export default function WorkspaceFunctionsCreatePage() {
  const [initial, setInitial] = useState<AdminFunction | undefined>(undefined);

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem('function');
      if (raw) {
        setInitial(JSON.parse(raw));
        sessionStorage.removeItem('function');
      }
    } catch {
      // ignore
    }
  }, []);

  return (
    <div className="flex h-[calc(100vh-56px)] flex-col p-4">
      <FunctionEditor mode="create" initial={initial} returnPath="/workspace/functions" />
    </div>
  );
}
