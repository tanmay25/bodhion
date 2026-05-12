'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { getToken } from '@/lib/auth/session';
import { createKnowledge } from '@/lib/api/workspace';

export default function CreateKnowledgePage() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);

  const onSubmit = async () => {
    const token = getToken();
    if (!token) return;
    if (!name.trim()) {
      toast.error('Knowledge name is required');
      return;
    }
    setSaving(true);
    try {
      await createKnowledge(token, { name: name.trim(), description: description.trim() || undefined });
      toast.success('Knowledge created successfully');
      router.push('/workspace/knowledge');
    } catch {
      toast.error('Failed to create knowledge');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="workspace-model-edit-page">
      <div className="workspace-model-edit-header">
        <div className="workspace-model-edit-eyebrow">BODHION WORKSPACE</div>
        <h1 className="workspace-model-edit-title">Create Knowledge</h1>
        <p className="workspace-model-edit-copy">Create a new knowledge collection for your workspace.</p>
      </div>

      <div className="workspace-model-edit-surface">
        <div className="workspace-model-edit-grid">
          <div className="workspace-model-edit-field workspace-model-edit-field--full">
            <label>Name</label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Knowledge name" />
          </div>

          <div className="workspace-model-edit-field workspace-model-edit-field--full">
            <label>Description</label>
            <textarea
              rows={5}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe this collection"
            />
          </div>
        </div>

        <div className="workspace-model-edit-actions">
          <Button type="button" variant="outline" onClick={() => router.push('/workspace/knowledge')}>
            Cancel
          </Button>
          <Button type="button" onClick={() => void onSubmit()} disabled={saving}>
            {saving ? 'Saving...' : 'Save & Create'}
          </Button>
        </div>
      </div>
    </div>
  );
}
