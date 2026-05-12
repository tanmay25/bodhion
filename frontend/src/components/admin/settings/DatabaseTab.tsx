'use client';

import { useState, useRef } from 'react';
import { toast } from 'sonner';
import { Download, Upload, Database, Users, MessageSquare } from 'lucide-react';
import { getToken } from '@/lib/auth/session';
import { SettingsSection } from '@/components/shared/SettingsSection';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import {
  exportConfig,
  importConfig,
  downloadDatabase,
  getAllUserChats,
  getAllUsers,
} from '@/lib/api/admin/settings';

export function DatabaseTab() {
  const [exporting,    setExporting]    = useState(false);
  const [importing,    setImporting]    = useState(false);
  const [showImport,   setShowImport]   = useState(false);
  const [pendingFile,  setPendingFile]  = useState<File | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleExportConfig = async () => {
    const token = getToken();
    if (!token) return;
    setExporting(true);
    try {
      const data = await exportConfig(token);
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      triggerDownload(blob, `config-export-${Date.now()}.json`);
      toast.success('Config exported');
    } catch {
      toast.error('Export failed');
    } finally {
      setExporting(false);
    }
  };

  const handleImportConfig = async () => {
    if (!pendingFile) return;
    const token = getToken();
    if (!token) return;
    setImporting(true);
    try {
      const text = await pendingFile.text();
      const cfg  = JSON.parse(text);
      await importConfig(token, cfg);
      toast.success('Config imported successfully');
    } catch {
      toast.error('Import failed');
    } finally {
      setImporting(false);
      setPendingFile(null);
      setShowImport(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const handleDownloadDB = async () => {
    const token = getToken();
    if (!token) return;
    try {
      const res = await downloadDatabase(token);
      const blob = await res.blob();
      triggerDownload(blob, `database-${Date.now()}.db`);
    } catch {
      toast.error('Failed to download database');
    }
  };

  const handleExportChats = async () => {
    const token = getToken();
    if (!token) return;
    try {
      const data = await getAllUserChats(token);
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      triggerDownload(blob, `all-chats-${Date.now()}.json`);
      toast.success('Chats exported');
    } catch {
      toast.error('Failed to export chats');
    }
  };

  const handleExportUsers = async () => {
    const token = getToken();
    if (!token) return;
    try {
      const res  = (await getAllUsers(token)) as { users: Record<string, unknown>[] };
      const users = res?.users ?? [];
      const headers = ['id', 'name', 'email', 'role'];
      const csv = [
        headers.join(','),
        ...users.map((u) =>
          headers.map((h) => `"${String(u[h] ?? '').replace(/"/g, '""')}"`).join(',')
        ),
      ].join('\n');
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      triggerDownload(blob, `users-${Date.now()}.csv`);
      toast.success('Users exported');
    } catch {
      toast.error('Failed to export users');
    }
  };

  function triggerDownload(blob: Blob, filename: string) {
    const url = URL.createObjectURL(blob);
    const a   = document.createElement('a');
    a.href     = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Config */}
      <SettingsSection title="Configuration" description="Export or import the full system configuration as JSON.">
        <div className="flex flex-wrap gap-3">
          <Button onClick={handleExportConfig} disabled={exporting} variant="outline" size="sm">
            <Download className="mr-1.5 h-3.5 w-3.5" />
            {exporting ? 'Exporting…' : 'Export Config'}
          </Button>

          <label className="flex cursor-pointer items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors hover:bg-[rgba(255,255,255,0.04)]" style={{ borderColor: 'var(--bodhion-card-border)', color: 'var(--bodhion-text-secondary)' }}>
            <Upload className="h-3.5 w-3.5" /> Import Config
            <input
              ref={fileRef}
              type="file"
              accept=".json"
              className="hidden"
              onChange={(e) => {
                if (e.target.files?.[0]) {
                  setPendingFile(e.target.files[0]);
                  setShowImport(true);
                }
              }}
            />
          </label>
        </div>
      </SettingsSection>

      {/* Database */}
      <SettingsSection title="Database" description="Download a raw SQLite snapshot of the database.">
        <Button onClick={handleDownloadDB} variant="outline" size="sm">
          <Database className="mr-1.5 h-3.5 w-3.5" /> Download Database
        </Button>
      </SettingsSection>

      {/* Data exports */}
      <SettingsSection title="Data Exports">
        <div className="flex flex-wrap gap-3">
          <Button onClick={handleExportChats} variant="outline" size="sm">
            <MessageSquare className="mr-1.5 h-3.5 w-3.5" /> Export All Chats
          </Button>
          <Button onClick={handleExportUsers} variant="outline" size="sm">
            <Users className="mr-1.5 h-3.5 w-3.5" /> Export Users (CSV)
          </Button>
        </div>
      </SettingsSection>

      {/* Import confirm */}
      <ConfirmDialog
        open={showImport}
        title="Import Configuration"
        confirmLabel={importing ? 'Importing…' : 'Import'}
        variant="default"
        loading={importing}
        onConfirm={handleImportConfig}
        onCancel={() => { setShowImport(false); setPendingFile(null); if (fileRef.current) fileRef.current.value = ''; }}
      >
        <p className="text-sm" style={{ color: 'var(--bodhion-text-secondary)' }}>
          This will overwrite current settings with the imported configuration. This action cannot be easily undone.
        </p>
      </ConfirmDialog>
    </div>
  );
}

export default DatabaseTab;
