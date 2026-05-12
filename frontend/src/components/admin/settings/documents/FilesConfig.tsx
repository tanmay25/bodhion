'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { Trash2, RefreshCw, RotateCcw } from 'lucide-react';
import { SettingsSection, SettingsField, SettingsToggleRow } from '@/components/shared/SettingsSection';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { Button } from '@/components/ui/Button';
import { getToken } from '@/lib/auth/session';
import {
  resetVectorDB,
  reindexKnowledgeFiles,
  deleteAllFiles,
} from '@/lib/api/admin/settings';

const FIELD = 'admin-input h-9 w-full rounded-md px-3 text-sm';

interface Props {
  config:  Record<string, unknown>;
  set:     (key: string, value: unknown) => void;
  onSave:  () => void;
  saving:  boolean;
}

type DangerAction = 'reset-upload-dir' | 'reset-vector-db' | 'reindex' | null;

export function FilesConfig({ config, set, onSave, saving }: Props) {
  const [pendingAction, setPendingAction]   = useState<DangerAction>(null);
  const [actionLoading, setActionLoading]   = useState(false);

  const allowedExtensions = Array.isArray(config.ALLOWED_FILE_EXTENSIONS)
    ? (config.ALLOWED_FILE_EXTENSIONS as string[]).join(', ')
    : String(config.ALLOWED_FILE_EXTENSIONS ?? '');

  const confirmLabels: Record<NonNullable<DangerAction>, { title: string; description: string; label: string }> = {
    'reset-upload-dir': {
      title: 'Reset Upload Directory',
      description: 'This will permanently delete all uploaded files. This action cannot be undone.',
      label: 'Delete All Files',
    },
    'reset-vector-db': {
      title: 'Reset Vector Storage',
      description: 'This will wipe the entire vector database. All indexed knowledge will be lost and must be reindexed.',
      label: 'Reset Vector DB',
    },
    reindex: {
      title: 'Reindex Knowledge Base',
      description: 'Re-embed all knowledge base files with the current embedding model. This may take a while.',
      label: 'Reindex',
    },
  };

  const handleDangerConfirm = async () => {
    const token = getToken();
    if (!token || !pendingAction) return;
    setActionLoading(true);
    try {
      if (pendingAction === 'reset-upload-dir') {
        await deleteAllFiles(token);
        toast.success('Upload directory reset');
      } else if (pendingAction === 'reset-vector-db') {
        await resetVectorDB(token);
        toast.success('Vector database reset');
      } else if (pendingAction === 'reindex') {
        await reindexKnowledgeFiles(token);
        toast.success('Reindex started');
      }
    } catch {
      toast.error('Action failed');
    } finally {
      setActionLoading(false);
      setPendingAction(null);
    }
  };

  return (
    <>
      {/* ── Files ──────────────────────────────────────────────────────────── */}
      <SettingsSection
        title="Files"
        description="Upload limits and image compression settings."
        onSave={onSave}
        saving={saving}
      >
        <SettingsField label="Allowed File Extensions" description="Comma-separated list of allowed extensions. Leave empty to allow all file types.">
          <input
            type="text"
            value={allowedExtensions}
            onChange={(e) => set('ALLOWED_FILE_EXTENSIONS', e.target.value)}
            placeholder="pdf, docx, txt"
            className={FIELD}
          />
        </SettingsField>

        <div className="grid grid-cols-2 gap-3">
          <SettingsField label="Max Upload Size (MB)" description="Leave empty for unlimited.">
            <input
              type="number"
              min={0}
              value={config.FILE_MAX_SIZE != null ? Number(config.FILE_MAX_SIZE) : ''}
              onChange={(e) => set('FILE_MAX_SIZE', e.target.value === '' ? null : parseInt(e.target.value))}
              placeholder="Unlimited"
              className={FIELD}
            />
          </SettingsField>
          <SettingsField label="Max Upload Count" description="Leave empty for unlimited.">
            <input
              type="number"
              min={0}
              value={config.FILE_MAX_COUNT != null ? Number(config.FILE_MAX_COUNT) : ''}
              onChange={(e) => set('FILE_MAX_COUNT', e.target.value === '' ? null : parseInt(e.target.value))}
              placeholder="Unlimited"
              className={FIELD}
            />
          </SettingsField>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <SettingsField label="Image Compression Width (px)" description="Leave empty for no compression.">
            <input
              type="number"
              min={0}
              value={config.FILE_IMAGE_COMPRESSION_WIDTH != null ? Number(config.FILE_IMAGE_COMPRESSION_WIDTH) : ''}
              onChange={(e) => set('FILE_IMAGE_COMPRESSION_WIDTH', e.target.value === '' ? null : parseInt(e.target.value))}
              placeholder="No compression"
              className={FIELD}
            />
          </SettingsField>
          <SettingsField label="Image Compression Height (px)" description="Leave empty for no compression.">
            <input
              type="number"
              min={0}
              value={config.FILE_IMAGE_COMPRESSION_HEIGHT != null ? Number(config.FILE_IMAGE_COMPRESSION_HEIGHT) : ''}
              onChange={(e) => set('FILE_IMAGE_COMPRESSION_HEIGHT', e.target.value === '' ? null : parseInt(e.target.value))}
              placeholder="No compression"
              className={FIELD}
            />
          </SettingsField>
        </div>
      </SettingsSection>

      {/* ── Integration ────────────────────────────────────────────────────── */}
      <SettingsSection title="Integration" description="Cloud storage integrations for document sources." onSave={onSave} saving={saving}>
        <SettingsToggleRow
          label="Google Drive"
          description="Allow users to import documents from Google Drive."
          checked={!!config.ENABLE_GOOGLE_DRIVE_INTEGRATION}
          onChange={(v) => set('ENABLE_GOOGLE_DRIVE_INTEGRATION', v)}
        />
        <SettingsToggleRow
          label="OneDrive"
          description="Allow users to import documents from Microsoft OneDrive."
          checked={!!config.ENABLE_ONEDRIVE_INTEGRATION}
          onChange={(v) => set('ENABLE_ONEDRIVE_INTEGRATION', v)}
        />
      </SettingsSection>

      {/* ── Danger Zone ────────────────────────────────────────────────────── */}
      <SettingsSection title="Danger Zone">
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium" style={{ color: 'var(--bodhion-text-primary)' }}>Reset Upload Directory</p>
              <p className="text-xs" style={{ color: 'var(--bodhion-text-secondary)' }}>Permanently delete all uploaded files.</p>
            </div>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => setPendingAction('reset-upload-dir')}
            >
              <Trash2 className="mr-1.5 h-3.5 w-3.5" />
              Reset
            </Button>
          </div>

          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium" style={{ color: 'var(--bodhion-text-primary)' }}>Reset Vector Storage / Knowledge</p>
              <p className="text-xs" style={{ color: 'var(--bodhion-text-secondary)' }}>Wipe the entire vector database. All knowledge must be reindexed.</p>
            </div>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => setPendingAction('reset-vector-db')}
            >
              <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
              Reset
            </Button>
          </div>

          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium" style={{ color: 'var(--bodhion-text-primary)' }}>Reindex Knowledge Base Vectors</p>
              <p className="text-xs" style={{ color: 'var(--bodhion-text-secondary)' }}>Re-embed all knowledge files with the current embedding model.</p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPendingAction('reindex')}
            >
              <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
              Reindex
            </Button>
          </div>
        </div>
      </SettingsSection>

      {/* Confirm dialog */}
      {pendingAction && (
        <ConfirmDialog
          open={!!pendingAction}
          title={confirmLabels[pendingAction].title}
          description={confirmLabels[pendingAction].description}
          confirmLabel={confirmLabels[pendingAction].label}
          variant="destructive"
          loading={actionLoading}
          onConfirm={handleDangerConfirm}
          onCancel={() => setPendingAction(null)}
        />
      )}
    </>
  );
}

export default FilesConfig;
