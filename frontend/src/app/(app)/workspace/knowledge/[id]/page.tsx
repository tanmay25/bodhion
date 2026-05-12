'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  ArrowLeft,
  ChevronDown,
  FileText,
  FolderOpen,
  Globe,
  Lock,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/Modal';
import { getToken } from '@/lib/auth/session';
import {
  type AccessGrant,
  addFileToKnowledge,
  getKnowledgeById,
  getWorkspaceGroupInfoById,
  getWorkspaceGroups,
  getWorkspaceUserInfoById,
  processWebPage,
  removeFileFromKnowledge,
  resetKnowledgeById,
  searchKnowledgeFilesById,
  updateKnowledgeAccess,
  updateKnowledge,
  type WorkspaceGroupInfo,
  type WorkspaceUserInfo,
} from '@/lib/api/workspace';
import { uploadFile, uploadFileRaw, getFileProcessStatus } from '@/lib/api/files';
import { deleteUserFile } from '@/lib/api/files';
import { getFileById } from '@/lib/api/files';
import { searchUsers as searchUsersApi } from '@/lib/api/users';
import { useAuthStore } from '@/store/authStore';
import type { KnowledgeCollection, KnowledgeFile } from '@/types/api';

// ── helpers ──────────────────────────────────────────────────────────────────

const formatRelative = (ts?: number) => {
  if (!ts) return '';
  const diffMs = ts * 1000 - Date.now();
  const absMin = Math.abs(Math.round(diffMs / 60000));
  const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' });
  if (absMin < 60) return rtf.format(Math.round(diffMs / 60000), 'minute');
  const absHr = Math.abs(Math.round(diffMs / 3600000));
  if (absHr < 24) return rtf.format(Math.round(diffMs / 3600000), 'hour');
  return rtf.format(Math.round(diffMs / 86400000), 'day');
};

const formatBytes = (bytes?: number) => {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1048576).toFixed(1)} MB`;
};

type SortKey = 'name' | 'created_at' | 'updated_at';

interface KnowledgeFileExt extends KnowledgeFile {
  created_at?: number;
  updated_at?: number;
  user?: { id: string; name?: string; email?: string };
}

const normalizeAccessGrants = (value: unknown): AccessGrant[] => {
  if (value === null) {
    return [{ principal_type: 'user', principal_id: '*', permission: 'read' }];
  }
  if (!Array.isArray(value)) return [];
  const grants: AccessGrant[] = [];
  for (const item of value) {
    if (!item || typeof item !== 'object') continue;
    const grant = item as Partial<AccessGrant>;
    if (
      (grant.principal_type === 'user' || grant.principal_type === 'group') &&
      typeof grant.principal_id === 'string' &&
      (grant.permission === 'read' || grant.permission === 'write')
    ) {
      grants.push({
        id: grant.id,
        principal_type: grant.principal_type,
        principal_id: grant.principal_id,
        permission: grant.permission,
      });
    }
  }

  const map = new Map<string, AccessGrant>();
  for (const grant of grants) {
    map.set(`${grant.principal_type}:${grant.principal_id}:${grant.permission}`, grant);
  }
  return Array.from(map.values());
};

const hasPublicReadGrant = (grants: AccessGrant[]) =>
  grants.some(
    (grant) =>
      grant.principal_type === 'user' &&
      grant.principal_id === '*' &&
      grant.permission === 'read'
  );

const getPrincipalIdsByPermission = (
  grants: AccessGrant[],
  principalType: 'user' | 'group',
  permission: 'read' | 'write'
) =>
  Array.from(
    new Set(
      grants
        .filter(
          (grant) => grant.principal_type === principalType && grant.permission === permission
        )
        .map((grant) => grant.principal_id)
    )
  );

const hasPrincipalGrant = (
  grants: AccessGrant[],
  principalType: 'user' | 'group',
  principalId: string,
  permission: 'read' | 'write'
) =>
  grants.some(
    (grant) =>
      grant.principal_type === principalType &&
      grant.principal_id === principalId &&
      grant.permission === permission
  );

const upsertPrincipalGrant = (
  grants: AccessGrant[],
  principalType: 'user' | 'group',
  principalId: string,
  permission: 'read' | 'write'
) => {
  if (hasPrincipalGrant(grants, principalType, principalId, permission)) return grants;
  return [...grants, { principal_type: principalType, principal_id: principalId, permission }];
};

const removePrincipalGrant = (
  grants: AccessGrant[],
  principalType: 'user' | 'group',
  principalId: string,
  permission: 'read' | 'write'
) =>
  grants.filter(
    (grant) =>
      !(
        grant.principal_type === principalType &&
        grant.principal_id === principalId &&
        grant.permission === permission
      )
  );

const removePrincipal = (
  grants: AccessGrant[],
  principalType: 'user' | 'group',
  principalId: string
) => {
  let next = removePrincipalGrant(grants, principalType, principalId, 'read');
  next = removePrincipalGrant(next, principalType, principalId, 'write');
  return next;
};

const togglePrincipalWrite = (
  grants: AccessGrant[],
  principalType: 'user' | 'group',
  principalId: string
) => {
  const hasWrite = hasPrincipalGrant(grants, principalType, principalId, 'write');
  if (hasWrite) return removePrincipalGrant(grants, principalType, principalId, 'write');
  let next = upsertPrincipalGrant(grants, principalType, principalId, 'read');
  next = upsertPrincipalGrant(next, principalType, principalId, 'write');
  return next;
};

const setPublic = (grants: AccessGrant[], isPublic: boolean) => {
  const filtered = grants.filter(
    (grant) =>
      !(
        grant.principal_type === 'user' &&
        grant.principal_id === '*' &&
        grant.permission === 'read'
      )
  );
  if (!isPublic) return filtered;
  return [
    ...filtered,
    { principal_type: 'user' as const, principal_id: '*', permission: 'read' as const },
  ];
};

// ── Add-content menu ─────────────────────────────────────────────────────────

interface AddMenuProps {
  onUpload: (files: FileList) => void;
  onUploadDirectory: (files: FileList) => void;
  onSyncDirectory: (files: FileList) => void;
  onAddUrl: () => void;
  onAddText: () => void;
  hasExistingFiles: boolean;
}

function AddContentMenu({
  onUpload,
  onUploadDirectory,
  onSyncDirectory,
  onAddUrl,
  onAddText,
  hasExistingFiles,
}: AddMenuProps) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const dirRef = useRef<HTMLInputElement>(null);
  const dirActionRef = useRef<'upload' | 'sync'>('upload');

  useEffect(() => {
    if (!dirRef.current) return;
    dirRef.current.setAttribute('webkitdirectory', '');
    dirRef.current.setAttribute('directory', '');
  }, []);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  return (
    <div className="kd-add-wrap" ref={menuRef}>
      <button className="kd-add-btn" onClick={() => setOpen((p) => !p)}>
        <Plus className="h-3.5 w-3.5" />
        <span>Add Content</span>
        <ChevronDown className="h-3 w-3" />
      </button>
      {open && (
        <div className="kd-add-menu">
          <button
            className="kd-add-item"
            onClick={() => {
              setOpen(false);
              fileRef.current?.click();
            }}
          >
            <Upload className="h-3.5 w-3.5" />
            <span>Upload Files</span>
          </button>
          <button
            className="kd-add-item"
            onClick={() => {
              setOpen(false);
              dirActionRef.current = 'upload';
              dirRef.current?.click();
            }}
          >
            <FolderOpen className="h-3.5 w-3.5" />
            <span>Upload Directory</span>
          </button>
          <button
            className="kd-add-item"
            onClick={() => {
              setOpen(false);
              dirActionRef.current = 'sync';
              dirRef.current?.click();
            }}
          >
            <RefreshCw className="h-3.5 w-3.5" />
            <span>{hasExistingFiles ? 'Sync Directory' : 'Upload & Sync Directory'}</span>
          </button>
          <button
            className="kd-add-item"
            onClick={() => {
              setOpen(false);
              onAddUrl();
            }}
          >
            <Globe className="h-3.5 w-3.5" />
            <span>Add Webpage</span>
          </button>
          <button
            className="kd-add-item"
            onClick={() => {
              setOpen(false);
              onAddText();
            }}
          >
            <FileText className="h-3.5 w-3.5" />
            <span>Add Text Content</span>
          </button>
        </div>
      )}
      <input
        ref={fileRef}
        type="file"
        multiple
        className="hidden"
        onChange={(e) => {
          if (e.target.files?.length) onUpload(e.target.files);
          e.target.value = '';
        }}
      />
      <input
        ref={dirRef}
        type="file"
        multiple
        className="hidden"
        onChange={(e) => {
          if (e.target.files?.length) {
            if (dirActionRef.current === 'sync') onSyncDirectory(e.target.files);
            else onUploadDirectory(e.target.files);
          }
          e.target.value = '';
        }}
      />
    </div>
  );
}

// ── URL modal ────────────────────────────────────────────────────────────────

interface UrlModalProps {
  onClose: () => void;
  onConfirm: (url: string) => void;
}

function UrlModal({ onClose, onConfirm }: UrlModalProps) {
  const [url, setUrl] = useState('');
  return (
    <div className="kd-modal-overlay" onClick={onClose}>
      <div className="kd-modal" onClick={(e) => e.stopPropagation()}>
        <div className="kd-modal-title">Add Webpage</div>
        <Input
          autoFocus
          placeholder="https://..."
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && url.trim()) onConfirm(url.trim());
            if (e.key === 'Escape') onClose();
          }}
          className="kd-modal-input"
        />
        <div className="kd-modal-actions">
          <Button variant="outline" size="sm" onClick={onClose}>Cancel</Button>
          <Button size="sm" onClick={() => url.trim() && onConfirm(url.trim())}>Add</Button>
        </div>
      </div>
    </div>
  );
}

// ── Text content modal ────────────────────────────────────────────────────────

interface TextModalProps {
  onClose: () => void;
  onConfirm: (name: string, content: string) => void;
}

function TextModal({ onClose, onConfirm }: TextModalProps) {
  const [name, setName] = useState('');
  const [content, setContent] = useState('');
  return (
    <div className="kd-modal-overlay" onClick={onClose}>
      <div className="kd-modal kd-modal--wide" onClick={(e) => e.stopPropagation()}>
        <div className="kd-modal-title">Add Text Content</div>
        <Input
          autoFocus
          placeholder="Document name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="kd-modal-input"
        />
        <textarea
          placeholder="Paste or write your text content here..."
          value={content}
          onChange={(e) => setContent(e.target.value)}
          className="kd-modal-textarea"
          rows={10}
        />
        <div className="kd-modal-actions">
          <Button variant="outline" size="sm" onClick={onClose}>Cancel</Button>
          <Button
            size="sm"
            disabled={!name.trim() || !content.trim()}
            onClick={() => name.trim() && content.trim() && onConfirm(name.trim(), content.trim())}
          >
            Add
          </Button>
        </div>
      </div>
    </div>
  );
}

// ── Pending-upload sessionStorage helpers ────────────────────────────────────
// Persists upload intent across navigations so orphaned uploads can be recovered.

const PENDING_UPLOADS_KEY = 'bodhion_pending_uploads';

interface PendingUploadRecord {
  knowledgeId: string;
  fileId: string;
  fileName: string;
}

const readPendingUploads = (): PendingUploadRecord[] => {
  if (typeof window === 'undefined') return [];
  try { return JSON.parse(sessionStorage.getItem(PENDING_UPLOADS_KEY) ?? '[]') as PendingUploadRecord[]; }
  catch { return []; }
};

const writePendingUpload = (record: PendingUploadRecord) => {
  if (typeof window === 'undefined') return;
  const list = readPendingUploads();
  if (!list.some((r) => r.fileId === record.fileId)) {
    list.push(record);
    sessionStorage.setItem(PENDING_UPLOADS_KEY, JSON.stringify(list));
  }
};

const clearPendingUpload = (fileId: string) => {
  if (typeof window === 'undefined') return;
  const list = readPendingUploads().filter((r) => r.fileId !== fileId);
  sessionStorage.setItem(PENDING_UPLOADS_KEY, JSON.stringify(list));
};

// ── Main page ─────────────────────────────────────────────────────────────────

export default function KnowledgeDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const currentUser = useAuthStore((s) => s.user);

  const [collection, setCollection] = useState<KnowledgeCollection | null>(null);
  const [loading, setLoading] = useState(true);

  // Metadata editing
  const [editName, setEditName] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [saving, setSaving] = useState(false);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Files
  const [fileQuery, setFileQuery] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('name');
  const [uploadingIds, setUploadingIds] = useState<Set<string>>(new Set());
  const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set());
  // Files uploaded but not yet linked to the collection (shown as ghost rows)
  const [uploadGhosts, setUploadGhosts] = useState<{ id: string; name: string }[]>([]);
  // IDs of files already linked to the collection but still being indexed
  const [processingFileIds, setProcessingFileIds] = useState<Set<string>>(new Set());

  // Refs kept in sync with state so the polling interval always reads fresh values
  const uploadGhostsRef = useRef<{ id: string; name: string }[]>([]);
  const processingFileIdsRef = useRef<Set<string>>(new Set());
  const pollingInProgressRef = useRef(false);
  uploadGhostsRef.current = uploadGhosts;
  processingFileIdsRef.current = processingFileIds;

  // Modals
  const [showUrlModal, setShowUrlModal] = useState(false);
  const [showTextModal, setShowTextModal] = useState(false);
  const [showAccessModal, setShowAccessModal] = useState(false);
  const [showAddAccessModal, setShowAddAccessModal] = useState(false);

  const [draftAccessGrants, setDraftAccessGrants] = useState<AccessGrant[]>([]);
  const [groupById, setGroupById] = useState<Record<string, WorkspaceGroupInfo>>({});
  const [userById, setUserById] = useState<Record<string, WorkspaceUserInfo>>({});
  const [availableGroups, setAvailableGroups] = useState<WorkspaceGroupInfo[]>([]);
  const [availableUsers, setAvailableUsers] = useState<WorkspaceUserInfo[]>([]);
  const [addAccessQuery, setAddAccessQuery] = useState('');
  const [selectedAddGroupIds, setSelectedAddGroupIds] = useState<string[]>([]);
  const [selectedAddUserIds, setSelectedAddUserIds] = useState<string[]>([]);
  const [loadingAddAccessUsers, setLoadingAddAccessUsers] = useState(false);
  const [loadingAccessMeta, setLoadingAccessMeta] = useState(false);
  const [savingAccess, setSavingAccess] = useState(false);

  const id = params?.id ?? '';
  const canWrite = Boolean((collection as { write_access?: boolean } | null)?.write_access);
  const canShareKnowledge =
    currentUser?.role === 'admin' ||
    Boolean((currentUser?.permissions as { sharing?: { knowledge?: boolean } } | undefined)?.sharing?.knowledge);
  const canSharePublicKnowledge =
    currentUser?.role === 'admin' ||
    Boolean((currentUser?.permissions as { sharing?: { public_knowledge?: boolean } } | undefined)?.sharing?.public_knowledge);
  const canShareUsers =
    currentUser?.role === 'admin' ||
    Boolean((currentUser?.permissions as { access_grants?: { allow_users?: boolean } } | undefined)?.access_grants?.allow_users ?? true);

  const readGroupIds = useMemo(
    () => getPrincipalIdsByPermission(draftAccessGrants, 'group', 'read'),
    [draftAccessGrants]
  );
  const writeGroupIds = useMemo(
    () => getPrincipalIdsByPermission(draftAccessGrants, 'group', 'write'),
    [draftAccessGrants]
  );
  const readUserIds = useMemo(
    () =>
      getPrincipalIdsByPermission(draftAccessGrants, 'user', 'read').filter((pid) => pid !== '*'),
    [draftAccessGrants]
  );
  const writeUserIds = useMemo(
    () =>
      getPrincipalIdsByPermission(draftAccessGrants, 'user', 'write').filter((pid) => pid !== '*'),
    [draftAccessGrants]
  );

  const accessGroups = useMemo(() => {
    const ids = Array.from(new Set([...readGroupIds, ...writeGroupIds]));
    return ids
      .map((pid) => groupById[pid] ?? { id: pid, name: pid })
      .sort((a, b) => (a.name ?? a.id).localeCompare(b.name ?? b.id));
  }, [groupById, readGroupIds, writeGroupIds]);

  const accessUsers = useMemo(() => {
    const ids = Array.from(new Set([...readUserIds, ...writeUserIds]));
    return ids
      .map((pid) => userById[pid] ?? { id: pid, name: pid })
      .sort((a, b) => (a.name ?? a.id).localeCompare(b.name ?? b.id));
  }, [readUserIds, userById, writeUserIds]);

  const isPublic = useMemo(() => hasPublicReadGrant(draftAccessGrants), [draftAccessGrants]);
  const addAccessQueryLower = useMemo(() => addAccessQuery.trim().toLowerCase(), [addAccessQuery]);
  const filteredAddGroups = useMemo(() => {
    const list = availableGroups.slice().sort((a, b) => a.name.localeCompare(b.name));
    if (!addAccessQueryLower) return list;
    return list.filter((group) => group.name.toLowerCase().includes(addAccessQueryLower));
  }, [availableGroups, addAccessQueryLower]);
  const filteredAddUsers = useMemo(() => {
    const list = availableUsers.slice().sort((a, b) => (a.name ?? a.id).localeCompare(b.name ?? b.id));
    if (!addAccessQueryLower) return list;
    return list.filter((user) =>
      `${user.name ?? ''} ${user.email ?? ''} ${user.id}`.toLowerCase().includes(addAccessQueryLower)
    );
  }, [availableUsers, addAccessQueryLower]);

  const load = useCallback(async () => {
    const token = getToken();
    if (!token || !id) return;
    try {
      const [res, filesRes] = await Promise.all([
        getKnowledgeById(token, id),
        searchKnowledgeFilesById(token, id, { page: 1 }).catch(() => ({ items: [], total: 0 })),
      ]);

      const apiFiles: KnowledgeFile[] = Array.isArray(filesRes?.items)
        ? filesRes.items.map((item) => ({
            id: item.id,
            name: (item.meta?.name as string | undefined) ?? item.filename ?? item.id,
            filename: item.filename ?? '',
            meta: item.meta as Record<string, unknown> | undefined,
            data: item.data as { status?: string } | undefined,
          }))
        : [];
      const fallbackFiles = Array.isArray(res?.files) ? res.files : [];
      const dataFileIds = Array.isArray(res?.data?.file_ids)
        ? res.data.file_ids.filter((v): v is string => typeof v === 'string' && v.length > 0)
        : [];

      let resolvedFromIds: KnowledgeFile[] = [];
      if (apiFiles.length === 0 && fallbackFiles.length === 0 && dataFileIds.length > 0) {
        const fileRows = await Promise.all(
          dataFileIds.map(async (fileId) => {
            try {
              const file = await getFileById(token, fileId);
              return file;
            } catch {
              return null;
            }
          })
        );
        resolvedFromIds = fileRows
          .filter((f): f is NonNullable<typeof f> => Boolean(f?.id))
          .map((f) => ({
            id: f.id,
            name: (f.meta?.name as string | undefined) ?? f.filename ?? f.id,
            filename: f.filename ?? '',
            meta: f.meta as Record<string, unknown> | undefined,
          }));
      }

      const merged = {
        ...res,
        // Keep Svelte parity: prefer /files results, but if empty fallback to collection.files.
        files: apiFiles.length > 0 ? apiFiles : fallbackFiles.length > 0 ? fallbackFiles : resolvedFromIds,
      };

      setCollection(merged);

      // Detect files already linked to the collection that are still being indexed
      setProcessingFileIds(
        new Set(apiFiles.filter((f) => f.data?.status === 'pending').map((f) => f.id))
      );
      // Remove ghost rows for files now confirmed in the collection; clear their sessionStorage entries
      const collectionFileIds = new Set(apiFiles.map((f) => f.id));
      setUploadGhosts((prev) => {
        prev.filter((g) => collectionFileIds.has(g.id)).forEach((g) => clearPendingUpload(g.id));
        return prev.filter((g) => !collectionFileIds.has(g.id));
      });

      setEditName(merged.name ?? '');
      setEditDesc(merged.description ?? '');
      setDraftAccessGrants(
        normalizeAccessGrants((merged as { access_grants?: unknown[] | null }).access_grants ?? [])
      );
    } catch {
      toast.error('Failed to load knowledge collection');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { void load(); }, [load]);

  // Restore ghost rows for any uploads that were in progress when the user last navigated away
  useEffect(() => {
    if (!id) return;
    const pendingForThis = readPendingUploads().filter((r) => r.knowledgeId === id);
    if (pendingForThis.length === 0) return;
    setUploadGhosts((prev) => {
      const existingIds = new Set(prev.map((g) => g.id));
      const newGhosts = pendingForThis
        .filter((r) => !existingIds.has(r.fileId))
        .map((r) => ({ id: r.fileId, name: r.fileName }));
      return [...prev, ...newGhosts];
    });
  }, [id]);

  // Poll the backend for each ghost/processing file. When complete, link to collection + refresh.
  const doPoll = useCallback(async () => {
    if (pollingInProgressRef.current) return;
    const token = getToken();
    if (!token) return;
    const ghosts = uploadGhostsRef.current;
    const procIds = processingFileIdsRef.current;
    if (ghosts.length === 0 && procIds.size === 0) return;

    pollingInProgressRef.current = true;
    try {
      const allIds = [...new Set([...procIds, ...ghosts.map((g) => g.id)])];
      await Promise.all(
        allIds.map(async (fileId) => {
          try {
            const result = await getFileProcessStatus(token, fileId);
            if (result.status !== 'completed' && result.status !== 'failed') return;

            const ghost = ghosts.find((g) => g.id === fileId);

            if (result.status === 'completed' && ghost) {
              try {
                await addFileToKnowledge(token, id, fileId);
                toast.success(`"${ghost.name}" added`);
              } catch {
                // Already linked (background chain completed while user was away)
              }
              clearPendingUpload(fileId);
            } else if (result.status === 'failed') {
              if (ghost) toast.error(`Processing failed for "${ghost.name}"`);
              clearPendingUpload(fileId);
            }

            setUploadGhosts((prev) => prev.filter((g) => g.id !== fileId));
            setProcessingFileIds((prev) => { const n = new Set(prev); n.delete(fileId); return n; });
            if (result.status === 'completed') void load();
          } catch {
            // Network error — will retry on next tick
          }
        })
      );
    } finally {
      pollingInProgressRef.current = false;
    }
  }, [id, load]);

  // 5-second interval — stable, runs for the lifetime of this knowledge page
  useEffect(() => {
    const interval = setInterval(() => { void doPoll(); }, 5000);
    return () => clearInterval(interval);
  }, [doPoll]);

  // Immediate check whenever a new ghost row or processing file is added
  useEffect(() => {
    if (uploadGhosts.length > 0 || processingFileIds.size > 0) {
      void doPoll();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doPoll, uploadGhosts.length, processingFileIds.size]);

  const hydrateAccessMetadata = useCallback(async (grants: AccessGrant[]) => {
    const token = getToken();
    if (!token) return;
    setLoadingAccessMeta(true);
    try {
      const groups = await getWorkspaceGroups(token).catch(() => []);
      if (Array.isArray(groups)) {
        const nextGroupMap: Record<string, WorkspaceGroupInfo> = {};
        for (const group of groups) {
          if (group?.id) nextGroupMap[group.id] = group;
        }
        setGroupById((prev) => ({ ...prev, ...nextGroupMap }));
        setAvailableGroups(groups);
      }

      const groupIds = Array.from(
        new Set(
          grants
            .filter((grant) => grant.principal_type === 'group')
            .map((grant) => grant.principal_id)
        )
      );
      const unknownGroupIds = groupIds.filter((pid) => !groupById[pid]);
      if (unknownGroupIds.length > 0) {
        const resolvedGroups = await Promise.all(
          unknownGroupIds.map(async (pid) => {
            try {
              return await getWorkspaceGroupInfoById(token, pid);
            } catch {
              return null;
            }
          })
        );
        setGroupById((prev) => {
          const next = { ...prev };
          for (const item of resolvedGroups) {
            if (item?.id) next[item.id] = item;
          }
          return next;
        });
      }

      const userIds = Array.from(
        new Set(
          grants
            .filter((grant) => grant.principal_type === 'user' && grant.principal_id !== '*')
            .map((grant) => grant.principal_id)
        )
      );
      const unknownUserIds = userIds.filter((pid) => !userById[pid]);
      if (unknownUserIds.length > 0) {
        const resolvedUsers = await Promise.all(
          unknownUserIds.map(async (pid) => {
            try {
              return await getWorkspaceUserInfoById(token, pid);
            } catch {
              return null;
            }
          })
        );
        setUserById((prev) => {
          const next = { ...prev };
          for (const item of resolvedUsers) {
            if (item?.id) next[item.id] = item;
          }
          return next;
        });
      }
    } finally {
      setLoadingAccessMeta(false);
    }
  }, [groupById, userById]);

  const fetchUsersForAddAccess = useCallback(async (queryValue: string) => {
    const token = getToken();
    if (!token) return;
    setLoadingAddAccessUsers(true);
    try {
      const response = await searchUsersApi(token, {
        query: queryValue.trim() || undefined,
        orderBy: 'name',
        direction: 'asc',
        page: 1,
      }).catch(() => null);

      const list = Array.isArray((response as { users?: unknown[] } | null)?.users)
        ? ((response as { users: Array<{ id: string; name?: string; email?: string }> }).users ?? [])
        : [];

      const mappedUsers = list
        .filter((user) => typeof user?.id === 'string' && user.id.length > 0)
        .filter((user) => user.id !== currentUser?.id)
        .map((user) => ({
          id: user.id,
          name: user.name,
          email: user.email,
        }));

      setAvailableUsers(mappedUsers);
      setUserById((prev) => {
        const next = { ...prev };
        for (const user of mappedUsers) {
          next[user.id] = user;
        }
        return next;
      });
    } finally {
      setLoadingAddAccessUsers(false);
    }
  }, [currentUser?.id]);

  useEffect(() => {
    if (!showAddAccessModal) return;
    const timer = setTimeout(() => {
      void fetchUsersForAddAccess(addAccessQuery);
    }, 220);
    return () => clearTimeout(timer);
  }, [showAddAccessModal, addAccessQuery, fetchUsersForAddAccess]);

  const openAccess = () => {
    const normalized = normalizeAccessGrants(
      ((collection as { access_grants?: unknown[] | null } | null)?.access_grants ?? [])
    );
    setDraftAccessGrants(normalized);
    setAddAccessQuery('');
    setSelectedAddGroupIds([]);
    setSelectedAddUserIds([]);
    setShowAccessModal(true);
    void hydrateAccessMetadata(normalized);
  };

  const commitAddAccess = () => {
    if (selectedAddGroupIds.length === 0 && selectedAddUserIds.length === 0) {
      toast.error('Select at least one user or group');
      return;
    }
    setDraftAccessGrants((prev) => {
      let next = [...prev];
      for (const groupId of selectedAddGroupIds) {
        next = upsertPrincipalGrant(next, 'group', groupId, 'read');
      }
      for (const userId of selectedAddUserIds) {
        next = upsertPrincipalGrant(next, 'user', userId, 'read');
      }
      return next;
    });
    setShowAddAccessModal(false);
    setAddAccessQuery('');
    setSelectedAddGroupIds([]);
    setSelectedAddUserIds([]);
  };

  const saveAccess = async () => {
    const token = getToken();
    if (!token || !collection) return;
    setSavingAccess(true);
    try {
      const updated = await updateKnowledgeAccess(token, collection.id, draftAccessGrants);
      const normalized = normalizeAccessGrants(
        (updated as { access_grants?: unknown[] | null } | null)?.access_grants ?? draftAccessGrants
      );
      setDraftAccessGrants(normalized);
      setCollection((prev) => (prev ? { ...prev, ...(updated ?? {}), access_grants: normalized } : prev));
      toast.success('Saved');
      setShowAccessModal(false);
    } catch {
      toast.error('Failed to update knowledge access');
    } finally {
      setSavingAccess(false);
    }
  };

  // Debounced metadata save
  const triggerSave = (name: string, desc: string) => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(async () => {
      const token = getToken();
      if (!token || !id) return;
      setSaving(true);
      try {
        const updated = await updateKnowledge(token, id, { name, description: desc });
        setCollection(updated);
      } catch {
        toast.error('Failed to save changes');
      } finally {
        setSaving(false);
      }
    }, 800);
  };

  const handleNameChange = (v: string) => { setEditName(v); triggerSave(v, editDesc); };
  const handleDescChange = (v: string) => { setEditDesc(v); triggerSave(editName, v); };

  // Files filtered + sorted
  const allFiles = useMemo(() => (collection?.files ?? []) as KnowledgeFileExt[], [collection]);

  const displayedFiles = useMemo(() => {
    const q = fileQuery.toLowerCase();
    const filtered = q
      ? allFiles.filter((f) => (f.name || f.filename || '').toLowerCase().includes(q))
      : allFiles;
    return [...filtered].sort((a, b) => {
      if (sortKey === 'name') return (a.name || a.filename || '').localeCompare(b.name || b.filename || '');
      if (sortKey === 'created_at') return (b.created_at ?? 0) - (a.created_at ?? 0);
      return (b.updated_at ?? 0) - (a.updated_at ?? 0);
    });
  }, [allFiles, fileQuery, sortKey]);

  // Upload files
  const handleUpload = async (fileList: FileList) => {
    if (!canWrite) {
      toast.error('You do not have permission to upload files to this collection.');
      return;
    }
    const token = getToken();
    if (!token) return;
    const files = Array.from(fileList);
    for (const file of files) {
      const tempId = `upload-${Date.now()}-${file.name}`;
      setUploadingIds((p) => new Set(p).add(tempId));
      try {
        // POST only — returns immediately. Background processing continues server-side.
        const uploaded = await uploadFileRaw(token, file, null);
        if (!uploaded?.id) throw new Error('Upload failed');
        // Persist intent so orphaned uploads can be recovered if user navigates away
        writePendingUpload({ knowledgeId: id, fileId: uploaded.id, fileName: file.name });
        // Show as a ghost row with a spinner — polling will link it when processing completes
        setUploadGhosts((prev) => [...prev, { id: uploaded.id, name: file.name }]);
      } catch {
        toast.error(`Failed to upload "${file.name}"`);
      } finally {
        setUploadingIds((p) => { const n = new Set(p); n.delete(tempId); return n; });
      }
    }
  };

  const handleUploadDirectory = async (fileList: FileList) => {
    const files = Array.from(fileList);
    if (files.length === 0) {
      toast.error('No files found in selected directory.');
      return;
    }
    const normalized = files.map((rawFile) => {
      const relativePath = (rawFile as File & { webkitRelativePath?: string }).webkitRelativePath;
      if (!relativePath) return rawFile;
      return new File([rawFile], relativePath, {
        type: rawFile.type,
        lastModified: rawFile.lastModified,
      });
    });
    for (const file of normalized) {
      // eslint-disable-next-line no-await-in-loop
      await handleUpload({
        0: file,
        length: 1,
        item: () => file,
      } as unknown as FileList);
    }
  };

  const handleSyncDirectory = async (fileList: FileList) => {
    if (!canWrite) {
      toast.error('You do not have permission to sync files for this collection.');
      return;
    }
    if (allFiles.length > 0) {
      const confirmed = window.confirm(
        'This will reset the collection and replace current files with the selected directory. Continue?'
      );
      if (!confirmed) return;
      const token = getToken();
      if (!token) return;
      try {
        await resetKnowledgeById(token, id);
      } catch {
        toast.error('Failed to reset collection before syncing.');
        return;
      }
    }
    await handleUploadDirectory(fileList);
  };

  // Add URL
  const handleAddUrl = async (url: string) => {
    setShowUrlModal(false);
    if (!canWrite) {
      toast.error('You do not have permission to add webpage content.');
      return;
    }
    const token = getToken();
    if (!token) return;
    const tempId = `url-${Date.now()}`;
    setUploadingIds((p) => new Set(p).add(tempId));
    try {
      const processed = await processWebPage(token, url, { collection_name: '' }).catch(() => null);
      const content =
        typeof processed?.content === 'string' && processed.content.trim().length > 0
          ? processed.content
          : url;
      const normalizedName =
        url.replace(/[^a-z0-9]/gi, '_').toLowerCase().slice(0, 50) || `webpage-${Date.now()}`;
      const blob = new Blob([content], { type: 'text/plain' });
      const file = new File([blob], `${normalizedName}.txt`, { type: 'text/plain' });
      const uploaded = await uploadFile(token, file, null);
      if (!uploaded?.id) throw new Error('Upload failed');
      await addFileToKnowledge(token, id, uploaded.id);
      toast.success('Webpage added');
      await load();
    } catch {
      toast.error('Failed to add webpage');
    } finally {
      setUploadingIds((p) => { const n = new Set(p); n.delete(tempId); return n; });
    }
  };

  // Add text content
  const handleAddText = async (name: string, content: string) => {
    setShowTextModal(false);
    if (!canWrite) {
      toast.error('You do not have permission to add text content.');
      return;
    }
    const token = getToken();
    if (!token) return;
    const tempId = `text-${Date.now()}`;
    setUploadingIds((p) => new Set(p).add(tempId));
    try {
      const blob = new Blob([content], { type: 'text/plain' });
      const file = new File([blob], `${name}.txt`, { type: 'text/plain' });
      const uploaded = await uploadFile(token, file, null);
      if (!uploaded?.id) throw new Error('Upload failed');
      await addFileToKnowledge(token, id, uploaded.id);
      toast.success(`"${name}" added`);
      await load();
    } catch {
      toast.error(`Failed to add "${name}"`);
    } finally {
      setUploadingIds((p) => { const n = new Set(p); n.delete(tempId); return n; });
    }
  };

  // Delete file
  const handleDeleteFile = async (file: KnowledgeFileExt) => {
    if (!canWrite) {
      toast.error('You do not have permission to remove files from this collection.');
      return;
    }
    const token = getToken();
    if (!token) return;
    setDeletingIds((p) => new Set(p).add(file.id));
    try {
      await removeFileFromKnowledge(token, id, file.id);
      await deleteUserFile(token, file.id);
      toast.success(`"${file.name || file.filename}" removed`);
      await load();
    } catch {
      toast.error('Failed to remove file');
    } finally {
      setDeletingIds((p) => { const n = new Set(p); n.delete(file.id); return n; });
    }
  };

  // Reset (reprocess all files)
  const handleReset = async () => {
    if (!canWrite) {
      toast.error('You do not have permission to re-process this collection.');
      return;
    }
    if (!window.confirm('Re-process all files in this collection? This may take a moment.')) return;
    const token = getToken();
    if (!token) return;
    try {
      await resetKnowledgeById(token, id);
      toast.success('Knowledge collection reset and re-processing started');
    } catch {
      toast.error('Failed to reset knowledge');
    }
  };

  if (loading) {
    return (
      <div className="kd-page">
        <div className="kd-loading">Loading knowledge collection...</div>
      </div>
    );
  }

  if (!collection) {
    return (
      <div className="kd-page">
        <div className="kd-loading">Knowledge collection not found.</div>
        <Button variant="outline" size="sm" onClick={() => router.push('/workspace/knowledge')}>
          Back to Knowledge
        </Button>
      </div>
    );
  }

  const isUploading = uploadingIds.size > 0;

  return (
    <div className="kd-page">
      {/* Header */}
      <div className="kd-header">
        <button className="kd-back-btn" onClick={() => router.push('/workspace/knowledge')}>
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div className="kd-breadcrumb">
          <span className="kd-breadcrumb-parent" onClick={() => router.push('/workspace/knowledge')}>
            Knowledge
          </span>
          <span className="kd-breadcrumb-sep">/</span>
          <span className="kd-breadcrumb-current">{collection.name}</span>
        </div>
        <div className="ml-auto flex items-center gap-2">
          {saving && <span className="kd-saving-indicator">Saving...</span>}
          {canWrite && canShareKnowledge && (
            <button className="kd-access-btn" onClick={openAccess} title="Manage access">
              <Lock className="h-3.5 w-3.5" />
              <span>Access</span>
            </button>
          )}
        </div>
      </div>

      <div className="kd-body">
        {/* Metadata card */}
        <div className="kd-meta-card">
          <div className="kd-meta-label">Collection Details</div>
          <div className="kd-field">
            <label className="kd-field-label">Name</label>
            <Input
              className="kd-field-input"
              value={editName}
              onChange={(e) => handleNameChange(e.target.value)}
              placeholder="Collection name"
              disabled={!canWrite}
            />
          </div>
          <div className="kd-field">
            <label className="kd-field-label">Description</label>
            <textarea
              className="kd-field-textarea"
              value={editDesc}
              onChange={(e) => handleDescChange(e.target.value)}
              placeholder="Describe this knowledge collection..."
              rows={3}
              disabled={!canWrite}
            />
          </div>
          <div className="kd-meta-footer">
            <span className="kd-meta-ts">
              Updated {formatRelative(collection.updated_at)}
            </span>
            <div className="flex items-center gap-2">
              {!canWrite && <span className="kd-meta-ts">Read Only</span>}
              {canWrite && (
                <button className="kd-reset-btn" onClick={handleReset} title="Re-process all files">
                  <RefreshCw className="h-3.5 w-3.5" />
                  <span>Re-process</span>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Files card */}
        <div className="kd-files-card">
          <div className="kd-files-toolbar">
            <div className="kd-files-title">
              <span>Files</span>
              <span className="kd-files-count">{allFiles.length}</span>
            </div>
            <div className="kd-files-controls">
              <div className="kd-search-wrap">
                <Search className="kd-search-icon h-3.5 w-3.5" />
                <input
                  className="kd-search-input"
                  placeholder="Search files..."
                  value={fileQuery}
                  onChange={(e) => setFileQuery(e.target.value)}
                />
                {fileQuery && (
                  <button className="kd-search-clear" onClick={() => setFileQuery('')}>
                    <X className="h-3 w-3" />
                  </button>
                )}
              </div>
              <select
                className="kd-sort-select"
                value={sortKey}
                onChange={(e) => setSortKey(e.target.value as SortKey)}
              >
                <option value="name">Sort: Name</option>
                <option value="created_at">Sort: Newest</option>
                <option value="updated_at">Sort: Updated</option>
              </select>
              {canWrite && (
                <AddContentMenu
                  onUpload={handleUpload}
                  onUploadDirectory={handleUploadDirectory}
                  onSyncDirectory={handleSyncDirectory}
                  onAddUrl={() => setShowUrlModal(true)}
                  onAddText={() => setShowTextModal(true)}
                  hasExistingFiles={allFiles.length > 0}
                />
              )}
            </div>
          </div>

          {(isUploading || uploadGhosts.length > 0) && (
            <div className="kd-uploading-bar">
              {isUploading
                ? `Uploading ${uploadingIds.size} file${uploadingIds.size > 1 ? 's' : ''}...`
                : `Processing ${uploadGhosts.length} file${uploadGhosts.length > 1 ? 's' : ''}...`}
            </div>
          )}

          {displayedFiles.length === 0 && uploadGhosts.length === 0 ? (
            <div className="kd-files-empty">
              {fileQuery ? 'No files match your search.' : 'No files yet. Add content to get started.'}
            </div>
          ) : (
            <div className="kd-files-list">
              {uploadGhosts.map((ghost) => (
                <div key={`ghost-${ghost.id}`} className="kd-file-row kd-file-row--ghost">
                  <FileText className="kd-file-icon h-4 w-4" />
                  <div className="kd-file-info">
                    <div className="kd-file-name">{ghost.name}</div>
                    <div className="kd-file-status-processing">
                      <span className="kd-processing-spinner" />
                      <span>Processing...</span>
                    </div>
                  </div>
                </div>
              ))}
              {displayedFiles.map((file) => {
                const fileName = file.name || file.filename || file.id;
                const size = formatBytes(typeof file.meta?.size === 'number' ? file.meta.size : undefined);
                const ts = file.updated_at || file.created_at;
                const isDel = deletingIds.has(file.id);
                const isIndexing = processingFileIds.has(file.id);
                return (
                  <div key={file.id} className="kd-file-row">
                    <FileText className="kd-file-icon h-4 w-4" />
                    <div className="kd-file-info">
                      <div className="kd-file-name" title={fileName}>{fileName}</div>
                      {isIndexing ? (
                        <div className="kd-file-status-processing">
                          <span className="kd-processing-spinner" />
                          <span>Indexing...</span>
                        </div>
                      ) : (
                        <div className="kd-file-meta">
                          {size && <span>{size}</span>}
                          {size && ts && <span className="kd-file-dot">·</span>}
                          {ts && <span>{formatRelative(ts)}</span>}
                          {file.user?.name && (
                            <>
                              <span className="kd-file-dot">·</span>
                              <span>By {file.user.name}</span>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                    {canWrite && (
                      <button
                        className="kd-file-del-btn"
                        disabled={isDel}
                        onClick={() => handleDeleteFile(file)}
                        title="Remove file"
                      >
                        {isDel ? (
                          <span className="kd-file-del-spinner" />
                        ) : (
                          <Trash2 className="h-3.5 w-3.5" />
                        )}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {showUrlModal && <UrlModal onClose={() => setShowUrlModal(false)} onConfirm={handleAddUrl} />}
      {showTextModal && <TextModal onClose={() => setShowTextModal(false)} onConfirm={handleAddText} />}

      <Dialog open={showAccessModal} onOpenChange={setShowAccessModal}>
        <DialogContent className="workspace-access-modal max-w-xl">
          <DialogHeader>
            <DialogTitle>Access Control</DialogTitle>
            <DialogDescription>
              Manage who can access {collection?.name ?? 'this knowledge collection'}.
            </DialogDescription>
          </DialogHeader>

          <div className="workspace-access-privacy">
            <div className="workspace-access-privacy__icon" aria-hidden>
              {isPublic ? <Globe className="h-4 w-4" /> : <Lock className="h-4 w-4" />}
            </div>
            <div className="workspace-access-privacy__content">
              <select
                value={isPublic ? 'public' : 'private'}
                className="workspace-access-privacy__select"
                disabled={!canSharePublicKnowledge}
                onChange={(e) => {
                  if (!canSharePublicKnowledge) return;
                  setDraftAccessGrants((prev) => setPublic(prev, e.target.value === 'public'));
                }}
              >
                <option value="private">Private</option>
                <option value="public">Public</option>
              </select>
              <p className="workspace-access-privacy__hint">
                {isPublic ? 'Accessible to all users' : 'Only selected users and groups can access'}
              </p>
            </div>
          </div>

          <div className="workspace-access-list">
            <div className="workspace-access-list__header">
              <span>Access List</span>
              <button
                type="button"
                className="workspace-access-list__add"
                onClick={() => {
                  setAddAccessQuery('');
                  setSelectedAddGroupIds([]);
                  setSelectedAddUserIds([]);
                  setShowAddAccessModal(true);
                }}
              >
                <Plus className="h-3.5 w-3.5" />
                Add Access
              </button>
            </div>

            <div className="workspace-access-list__items">
              {accessGroups.map((group) => {
                const canWriteGroup = writeGroupIds.includes(group.id);
                return (
                  <div key={`group-${group.id}`} className="workspace-access-item">
                    <div className="workspace-access-item__identity">
                      <div className="workspace-access-item__avatar">
                        {(group.name ?? group.id).slice(0, 2).toUpperCase()}
                      </div>
                      <div className="workspace-access-item__text">
                        <div className="workspace-access-item__name">{group.name ?? group.id}</div>
                        {typeof group.member_count === 'number' && (
                          <div className="workspace-access-item__meta">{group.member_count} members</div>
                        )}
                      </div>
                    </div>
                    <div className="workspace-access-item__actions">
                      <button
                        type="button"
                        className={`workspace-access-badge ${canWriteGroup ? 'workspace-access-badge--write' : 'workspace-access-badge--read'}`}
                        onClick={() =>
                          setDraftAccessGrants((prev) => togglePrincipalWrite(prev, 'group', group.id))
                        }
                      >
                        {canWriteGroup ? 'WRITE' : 'READ'}
                      </button>
                      <button
                        type="button"
                        className="workspace-access-remove"
                        onClick={() =>
                          setDraftAccessGrants((prev) => removePrincipal(prev, 'group', group.id))
                        }
                        aria-label={`Remove ${group.name ?? group.id}`}
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}

              {accessUsers.map((user) => {
                const canWriteUser = writeUserIds.includes(user.id);
                return (
                  <div key={`user-${user.id}`} className="workspace-access-item">
                    <div className="workspace-access-item__identity">
                      <div className="workspace-access-item__avatar">
                        {(user.name ?? user.id).slice(0, 2).toUpperCase()}
                      </div>
                      <div className="workspace-access-item__text">
                        <div className="workspace-access-item__name">{user.name ?? user.id}</div>
                        {user.email && <div className="workspace-access-item__meta">{user.email}</div>}
                      </div>
                    </div>
                    <div className="workspace-access-item__actions">
                      <button
                        type="button"
                        className={`workspace-access-badge ${canWriteUser ? 'workspace-access-badge--write' : 'workspace-access-badge--read'}`}
                        onClick={() =>
                          setDraftAccessGrants((prev) => togglePrincipalWrite(prev, 'user', user.id))
                        }
                      >
                        {canWriteUser ? 'WRITE' : 'READ'}
                      </button>
                      <button
                        type="button"
                        className="workspace-access-remove"
                        onClick={() =>
                          setDraftAccessGrants((prev) => removePrincipal(prev, 'user', user.id))
                        }
                        aria-label={`Remove ${user.name ?? user.id}`}
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}

              {!isPublic && accessGroups.length === 0 && accessUsers.length === 0 && (
                <div className="workspace-access-empty">No access grants. Private to you.</div>
              )}

              {loadingAccessMeta && (
                <div className="workspace-access-empty">Loading access list details...</div>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button className="workspace-access-save" onClick={() => void saveAccess()} disabled={savingAccess}>
              {savingAccess ? 'Saving...' : 'Save Access'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showAddAccessModal} onOpenChange={setShowAddAccessModal}>
        <DialogContent className="workspace-add-access-modal max-w-xl">
          <DialogHeader>
            <DialogTitle>Add Access</DialogTitle>
            <DialogDescription>Select users and groups to grant read access.</DialogDescription>
          </DialogHeader>

          <div className="workspace-add-access-search">
            <Search className="h-4 w-4 workspace-add-access-search__icon" />
            <Input
              value={addAccessQuery}
              onChange={(e) => setAddAccessQuery(e.target.value)}
              placeholder="Search"
              className="workspace-add-access-search__input"
            />
          </div>

          <div className="workspace-add-access-list">
            <div className="workspace-add-access-section">
              <div className="workspace-add-access-section__title">Groups</div>
              {filteredAddGroups.length === 0 ? (
                <div className="workspace-add-access-empty">No groups found.</div>
              ) : (
                filteredAddGroups.map((group) => (
                  <label key={`add-group-${group.id}`} className="workspace-add-access-item">
                    <div className="workspace-add-access-item__left">
                      <div className="workspace-add-access-avatar">{group.name.slice(0, 2).toUpperCase()}</div>
                      <div className="workspace-add-access-item__text">
                        <div className="workspace-add-access-item__name">{group.name}</div>
                        {typeof group.member_count === 'number' && (
                          <div className="workspace-add-access-item__meta">{group.member_count} members</div>
                        )}
                      </div>
                    </div>
                    <input
                      type="checkbox"
                      className="workspace-add-access-checkbox"
                      checked={selectedAddGroupIds.includes(group.id)}
                      onChange={(e) => {
                        setSelectedAddGroupIds((prev) =>
                          e.target.checked ? [...new Set([...prev, group.id])] : prev.filter((id) => id !== group.id)
                        );
                      }}
                    />
                  </label>
                ))
              )}
            </div>

            {canShareUsers && (
              <div className="workspace-add-access-section">
                <div className="workspace-add-access-section__title">Users</div>
                {loadingAddAccessUsers ? (
                  <div className="workspace-add-access-empty">Loading users...</div>
                ) : filteredAddUsers.length === 0 ? (
                  <div className="workspace-add-access-empty">No users found.</div>
                ) : (
                  filteredAddUsers.map((user) => (
                    <label key={`add-user-${user.id}`} className="workspace-add-access-item">
                      <div className="workspace-add-access-item__left">
                        <div className="workspace-add-access-avatar">
                          {(user.name ?? user.id).slice(0, 2).toUpperCase()}
                        </div>
                        <div className="workspace-add-access-item__text">
                          <div className="workspace-add-access-item__name">{user.name ?? user.id}</div>
                          {user.email && <div className="workspace-add-access-item__meta">{user.email}</div>}
                        </div>
                      </div>
                      <input
                        type="checkbox"
                        className="workspace-add-access-checkbox"
                        checked={selectedAddUserIds.includes(user.id)}
                        onChange={(e) => {
                          setSelectedAddUserIds((prev) =>
                            e.target.checked ? [...new Set([...prev, user.id])] : prev.filter((id) => id !== user.id)
                          );
                        }}
                      />
                    </label>
                  ))
                )}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddAccessModal(false)}>Cancel</Button>
            <Button className="workspace-add-access-submit" onClick={() => commitAddAccess()}>
              Add
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
