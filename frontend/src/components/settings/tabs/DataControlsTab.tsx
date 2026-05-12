'use client';

import { useRef, useState } from 'react';
import {
  Download, Upload, Archive, Trash2, AlertTriangle,
  X, FileText, ChevronDown, ChevronUp, Loader2,
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuthStore } from '@/store/authStore';
import { getToken } from '@/lib/auth/session';
import {
  getAllChats, deleteAllChats, archiveAllChats, importChats,
  getArchivedChats, unarchiveChatById,
  getSharedChats, deleteSharedChatById,
} from '@/lib/api/chats';
import { getUserFiles, deleteUserFile } from '@/lib/api/files';
import type { Chat } from '@/types/chat';
import type { UserFile } from '@/lib/api/files';

// ── Compact row: label | fixed-width button ───────────────────────────────────

function DataRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="dc-row">
      <span className="dc-row-label">{label}</span>
      <div className="dc-row-action">{children}</div>
    </div>
  );
}

// ── Reusable action button (fixed width so all buttons align) ─────────────────

type BtnVariant = 'default' | 'warn' | 'danger' | 'ghost';

function Btn({
  variant = 'default',
  disabled,
  loading,
  onClick,
  children,
}: {
  variant?: BtnVariant;
  disabled?: boolean;
  loading?: boolean;
  onClick?: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      className={`dc-btn dc-btn--${variant}`}
      disabled={disabled || loading}
      onClick={onClick}
    >
      {loading && <Loader2 className="h-3 w-3 animate-spin" />}
      {children}
    </button>
  );
}

// ── Inline confirm strip ──────────────────────────────────────────────────────

function ConfirmStrip({
  message,
  loading,
  onConfirm,
  onCancel,
}: {
  message: string;
  loading: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="dc-confirm-strip">
      <AlertTriangle className="h-3.5 w-3.5 dc-confirm-icon" />
      <span className="dc-confirm-text">{message}</span>
      <Btn variant="ghost" disabled={loading} onClick={onCancel}>Cancel</Btn>
      <Btn variant="danger" loading={loading} onClick={onConfirm}>Confirm</Btn>
    </div>
  );
}

// ── Expandable inline panel ───────────────────────────────────────────────────

type PanelItem = { id: string; label: string };

function InlinePanel({
  items,
  loading,
  emptyText,
  actionLabel,
  actionVariant,
  actionIcon: ActionIcon,
  onAction,
  onClose,
}: {
  items: PanelItem[];
  loading: boolean;
  emptyText: string;
  actionLabel: string;
  actionVariant?: BtnVariant;
  actionIcon?: React.ElementType;
  onAction: (id: string) => void;
  onClose: () => void;
}) {
  return (
    <div className="dc-panel">
      <div className="dc-panel-header">
        <button type="button" className="dc-panel-close" onClick={onClose} aria-label="Close">
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
      {loading ? (
        <div className="dc-panel-loading">
          <Loader2 className="h-4 w-4 animate-spin" />
        </div>
      ) : items.length === 0 ? (
        <p className="dc-panel-empty">{emptyText}</p>
      ) : (
        <ul className="dc-panel-list">
          {items.map((item) => (
            <li key={item.id} className="dc-panel-item">
              <span className="dc-panel-item-label" title={item.label}>{item.label}</span>
              <Btn variant={actionVariant ?? 'ghost'} onClick={() => onAction(item.id)}>
                {ActionIcon && <ActionIcon className="h-3 w-3" />}
                {actionLabel}
              </Btn>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ── Main tab ──────────────────────────────────────────────────────────────────

type Panel = 'archived' | 'shared' | 'files' | null;

export function DataControlsTab() {
  const user        = useAuthStore((s) => s.user);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [busy,           setBusy]           = useState<string | null>(null);
  const [archiveConfirm, setArchiveConfirm] = useState(false);
  const [deleteConfirm,  setDeleteConfirm]  = useState(false);
  const [openPanel,      setOpenPanel]      = useState<Panel>(null);
  const [panelLoading,   setPanelLoading]   = useState(false);

  // Panel item lists
  const [archivedChats, setArchivedChats] = useState<PanelItem[]>([]);
  const [sharedChats,   setSharedChats]   = useState<PanelItem[]>([]);
  const [userFiles,     setUserFiles]     = useState<PanelItem[]>([]);

  const canExport: boolean =
    user?.role === 'admin' ||
    Boolean((user?.permissions?.chat as Record<string, unknown> | undefined)?.export ?? true);

  // ── Panel open ───────────────────────────────────────────────────────────────

  const openPanelFor = async (panel: Panel) => {
    if (openPanel === panel) { setOpenPanel(null); return; }
    setOpenPanel(panel);
    const token = getToken();
    if (!token || !panel) return;
    setPanelLoading(true);
    try {
      if (panel === 'archived') {
        const chats = await getArchivedChats(token);
        setArchivedChats((chats as Chat[]).map((c) => ({ id: c.id, label: c.title })));
      } else if (panel === 'shared') {
        const chats = await getSharedChats(token);
        setSharedChats((chats as Chat[]).map((c) => ({ id: c.id, label: c.title })));
      } else if (panel === 'files') {
        const files = await getUserFiles(token);
        setUserFiles(files.map((f: UserFile) => ({ id: f.id, label: f.filename })));
      }
    } catch {
      toast.error('Failed to load items');
      setOpenPanel(null);
    } finally {
      setPanelLoading(false);
    }
  };

  // ── Import ───────────────────────────────────────────────────────────────────

  const handleImport = async (file: File) => {
    const token = getToken();
    if (!token) return;
    setBusy('import');
    try {
      const text = await file.text();
      const data = JSON.parse(text) as unknown;
      let chats: object[];
      if (Array.isArray(data)) {
        chats = data as object[];
      } else if (data && typeof data === 'object' && Array.isArray((data as Record<string, unknown>).conversations)) {
        chats = (data as Record<string, object[]>).conversations;
      } else {
        throw new Error('format');
      }
      await importChats(token, chats);
      toast.success(`${chats.length} chat${chats.length !== 1 ? 's' : ''} imported`);
    } catch (e) {
      toast.error(
        e instanceof Error && e.message === 'format'
          ? 'Unrecognised file — expected a Bodhion or OpenAI JSON export'
          : 'Failed to import chats'
      );
    } finally {
      setBusy(null);
    }
  };

  // ── Export ───────────────────────────────────────────────────────────────────

  const handleExport = async () => {
    const token = getToken();
    if (!token) return;
    setBusy('export');
    try {
      const chats = await getAllChats(token);
      const blob  = new Blob([JSON.stringify(chats, null, 2)], { type: 'application/json' });
      const url   = URL.createObjectURL(blob);
      const a     = Object.assign(document.createElement('a'), {
        href: url,
        download: `chat-export-${Date.now()}.json`,
      });
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success('Chats exported');
    } catch {
      toast.error('Failed to export chats');
    } finally {
      setBusy(null);
    }
  };

  // ── Archive All ──────────────────────────────────────────────────────────────

  const handleArchiveAll = async () => {
    const token = getToken();
    if (!token) return;
    setBusy('archiveAll');
    try {
      await archiveAllChats(token);
      setArchiveConfirm(false);
      toast.success('All chats archived');
    } catch {
      toast.error('Failed to archive chats');
    } finally {
      setBusy(null);
    }
  };

  // ── Delete All ───────────────────────────────────────────────────────────────

  const handleDeleteAll = async () => {
    const token = getToken();
    if (!token) return;
    setBusy('deleteAll');
    try {
      await deleteAllChats(token);
      setDeleteConfirm(false);
      toast.success('All chats deleted');
    } catch {
      toast.error('Failed to delete chats');
    } finally {
      setBusy(null);
    }
  };

  // ── Panel actions ─────────────────────────────────────────────────────────────

  const handleUnarchive = async (id: string) => {
    const token = getToken();
    if (!token) return;
    try {
      await unarchiveChatById(token, id);
      setArchivedChats((prev) => prev.filter((c) => c.id !== id));
      toast.success('Chat unarchived');
    } catch {
      toast.error('Failed to unarchive chat');
    }
  };

  const handleRemoveShare = async (id: string) => {
    const token = getToken();
    if (!token) return;
    try {
      await deleteSharedChatById(token, id);
      setSharedChats((prev) => prev.filter((c) => c.id !== id));
      toast.success('Share removed');
    } catch {
      toast.error('Failed to remove share');
    }
  };

  const handleDeleteFile = async (id: string) => {
    const token = getToken();
    if (!token) return;
    try {
      await deleteUserFile(token, id);
      setUserFiles((prev) => prev.filter((f) => f.id !== id));
      toast.success('File deleted');
    } catch {
      toast.error('Failed to delete file');
    }
  };

  // ── Helper to get chevron for panel toggles ──────────────────────────────────
  const PanelChevron = ({ panel }: { panel: Panel }) =>
    openPanel === panel
      ? <ChevronUp  className="h-3 w-3" />
      : <ChevronDown className="h-3 w-3" />;

  const isBusy = busy !== null;

  return (
    <div className="settings-tab-content">

      {/* ── Chats ─────────────────────────────────────────────────────────── */}
      <div className="settings-section">
        <div className="settings-section-title">Chats</div>

        <div className="dc-list">

          {/* Import */}
          <DataRow label="Import Chats">
            <Btn disabled={isBusy} loading={busy === 'import'} onClick={() => fileInputRef.current?.click()}>
              <Upload className="h-3 w-3" />
              Import
            </Btn>
            <input
              ref={fileInputRef}
              type="file"
              accept=".json"
              hidden
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void handleImport(f);
                e.target.value = '';
              }}
            />
          </DataRow>

          {/* Export */}
          {canExport && (
            <DataRow label="Export Chats">
              <Btn disabled={isBusy} loading={busy === 'export'} onClick={() => void handleExport()}>
                <Download className="h-3 w-3" />
                Export
              </Btn>
            </DataRow>
          )}

          {/* Archived Chats */}
          <div className="dc-expandable">
            <DataRow label="Archived Chats">
              <Btn
                variant={openPanel === 'archived' ? 'ghost' : 'default'}
                onClick={() => void openPanelFor('archived')}
              >
                <PanelChevron panel="archived" />
                Manage
              </Btn>
            </DataRow>
            {openPanel === 'archived' && (
              <InlinePanel
                items={archivedChats}
                loading={panelLoading}
                emptyText="No archived chats."
                actionLabel="Unarchive"
                onAction={(id) => void handleUnarchive(id)}
                onClose={() => setOpenPanel(null)}
              />
            )}
          </div>

          {/* Shared Chats */}
          <div className="dc-expandable">
            <DataRow label="Shared Chats">
              <Btn
                variant={openPanel === 'shared' ? 'ghost' : 'default'}
                onClick={() => void openPanelFor('shared')}
              >
                <PanelChevron panel="shared" />
                Manage
              </Btn>
            </DataRow>
            {openPanel === 'shared' && (
              <InlinePanel
                items={sharedChats}
                loading={panelLoading}
                emptyText="No shared chats."
                actionLabel="Remove"
                actionVariant="danger"
                actionIcon={Trash2}
                onAction={(id) => void handleRemoveShare(id)}
                onClose={() => setOpenPanel(null)}
              />
            )}
          </div>

          {/* Archive All */}
          <div className="dc-expandable">
            <DataRow label="Archive All Chats">
              <Btn
                variant="warn"
                disabled={isBusy}
                onClick={() => { setArchiveConfirm(true); setDeleteConfirm(false); }}
              >
                <Archive className="h-3 w-3" />
                Archive All
              </Btn>
            </DataRow>
            {archiveConfirm && (
              <ConfirmStrip
                message="All chats will be archived. Continue?"
                loading={busy === 'archiveAll'}
                onConfirm={() => void handleArchiveAll()}
                onCancel={() => setArchiveConfirm(false)}
              />
            )}
          </div>

          {/* Delete All */}
          <div className="dc-expandable">
            <DataRow label="Delete All Chats">
              <Btn
                variant="danger"
                disabled={isBusy}
                onClick={() => { setDeleteConfirm(true); setArchiveConfirm(false); }}
              >
                <Trash2 className="h-3 w-3" />
                Delete All
              </Btn>
            </DataRow>
            {deleteConfirm && (
              <ConfirmStrip
                message="All chats will be permanently deleted. This cannot be undone."
                loading={busy === 'deleteAll'}
                onConfirm={() => void handleDeleteAll()}
                onCancel={() => setDeleteConfirm(false)}
              />
            )}
          </div>

        </div>
      </div>

      {/* ── Files ─────────────────────────────────────────────────────────── */}
      <div className="settings-section">
        <div className="settings-section-title">Files</div>

        <div className="dc-list">
          <div className="dc-expandable">
            <DataRow label="Manage Files">
              <Btn
                variant={openPanel === 'files' ? 'ghost' : 'default'}
                onClick={() => void openPanelFor('files')}
              >
                <PanelChevron panel="files" />
                <FileText className="h-3 w-3" />
                Manage
              </Btn>
            </DataRow>
            {openPanel === 'files' && (
              <InlinePanel
                items={userFiles}
                loading={panelLoading}
                emptyText="No uploaded files."
                actionLabel="Delete"
                actionVariant="danger"
                actionIcon={Trash2}
                onAction={(id) => void handleDeleteFile(id)}
                onClose={() => setOpenPanel(null)}
              />
            )}
          </div>
        </div>
      </div>

    </div>
  );
}
