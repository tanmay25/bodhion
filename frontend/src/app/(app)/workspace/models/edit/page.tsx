'use client';

import { Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ModelEditorPanel } from '@/components/workspace/models/ModelEditorPanel';

function EditModelInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const modelId = searchParams.get('id') ?? '';

  if (!modelId) {
    router.replace('/workspace/models');
    return null;
  }

  return (
    <div className="workspace-model-edit-page">
      <div className="workspace-model-edit-header">
        <div className="workspace-model-edit-eyebrow">BODHION WORKSPACE</div>
        <h1 className="workspace-model-edit-title">Edit Model</h1>
        <p className="workspace-model-edit-copy">
          Update metadata, prompts, resources, and capabilities without leaving the workspace flow.
        </p>
      </div>
      <ModelEditorPanel
        modelId={modelId}
        showHeader={false}
        onSaved={() => router.push('/workspace/models')}
        onClose={() => router.push('/workspace/models')}
      />
    </div>
  );
}

export default function EditModelPage() {
  return (
    <Suspense fallback={<div className="workspace-model-edit-page"><div className="workspace-model-edit-surface">Loading...</div></div>}>
      <EditModelInner />
    </Suspense>
  );
}
