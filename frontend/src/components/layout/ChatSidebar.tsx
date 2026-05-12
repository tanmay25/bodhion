'use client';

import {
  useEffect, useState, useRef, useCallback, useLayoutEffect,
} from 'react';
import Link from 'next/link';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import {
  Home, PanelLeft, Archive,
  PencilLine, Search, FolderPlus, FolderOpen, Folder, ChevronRight,
  MoreHorizontal, Pin, PinOff, Pencil, Trash2, Copy,
  Share2, MoveRight, X, Check, BookOpen, Bot,
} from 'lucide-react';
import { toast } from 'sonner';
import { Spinner } from '@/components/ui/Spinner';
import { useAuthContext } from '@/providers/AuthProvider';
import { useAuthStore } from '@/store/authStore';
import { useChatStore } from '@/store/chatStore';
import { useUIStore } from '@/store/uiStore';
import { useWorkspaceStore } from '@/store/workspaceStore';
import { SidebarShell } from '@/components/layout/sidebar/SidebarShell';
import { SidebarNavItem } from '@/components/layout/sidebar/SidebarNavItem';
import { SidebarUserFooter } from '@/components/layout/sidebar/SidebarUserFooter';
import {
  getChatList, getPinnedChats,
  deleteChatById, updateChatById, pinChatById,
  archiveChatById, shareChatById,
  cloneChatById, moveChatToFolder,
  getFolders, createFolder, updateFolder, deleteFolder,
} from '@/lib/api/chats';
import { userSignOut } from '@/lib/api/auth';
import { getToken, clearSession } from '@/lib/auth/session';
import { cn } from '@/lib/utils/cn';
import { AUTH_PATH } from '@/lib/constants';
import type { Chat, ChatFolder } from '@/types/chat';
import type { Model } from '@/types/models';

// ── Helpers ────────────────────────────────────────────────────────────────────

const TIME_RANGE_ORDER = [
  'Today', 'Yesterday', 'Previous 7 days', 'Previous 30 days', 'This year', 'Older',
];

function getTimeRange(updatedAt: number): string {
  const now = Date.now() / 1000;
  const diff = now - updatedAt;
  if (diff < 86_400) return 'Today';
  if (diff < 172_800) return 'Yesterday';
  if (diff < 604_800) return 'Previous 7 days';
  if (diff < 2_592_000) return 'Previous 30 days';
  if (new Date(updatedAt * 1000).getFullYear() === new Date().getFullYear()) return 'This year';
  return 'Older';
}

function groupByTimeRange(chats: Chat[]): { range: string; chats: Chat[] }[] {
  const map: Record<string, Chat[]> = {};
  for (const chat of chats) {
    const r = getTimeRange(chat.updated_at);
    if (!map[r]) map[r] = [];
    map[r].push(chat);
  }
  return TIME_RANGE_ORDER.filter((r) => map[r]).map((r) => ({ range: r, chats: map[r] }));
}

function formatTimeAgo(ts: number): string {
  const diff = Math.floor(Date.now() / 1000 - ts);
  if (diff < 60) return 'now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d`;
  return `${Math.floor(diff / 604800)}w`;
}

// ── Chat context menu ──────────────────────────────────────────────────────────

interface CtxMenuProps {
  chat: Chat;
  folders: ChatFolder[];
  anchor: DOMRect;
  onClose: () => void;
  onMutate: () => void;
  onRenameStart: (id: string, current: string) => void;
}

function ChatContextMenu({ chat, folders, anchor, onClose, onMutate, onRenameStart }: CtxMenuProps) {
  const router = useRouter();
  const menuRef = useRef<HTMLDivElement>(null);
  const [moveOpen, setMoveOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const style: React.CSSProperties = {
    position: 'fixed',
    top: anchor.bottom + 4,
    left: anchor.left,
    zIndex: 600,
  };

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  useLayoutEffect(() => {
    if (!menuRef.current) return;
    const rect = menuRef.current.getBoundingClientRect();
    if (rect.right > window.innerWidth - 8)
      menuRef.current.style.left = `${window.innerWidth - rect.width - 8}px`;
    if (rect.bottom > window.innerHeight - 8)
      menuRef.current.style.top = `${anchor.top - rect.height - 4}px`;
  }, [anchor]);

  async function run(fn: () => Promise<void>) {
    setBusy(true);
    try { await fn(); onMutate(); } catch { toast.error('Action failed'); }
    finally { setBusy(false); onClose(); }
  }

  const token = getToken();

  return (
    <div className="sb-ctx-menu" ref={menuRef} style={style}>
      <button type="button" className="sb-ctx-item" onClick={() => void run(async () => {
        if (!token) return;
        await pinChatById(token, chat.id);
      })}>
        {chat.pinned ? <PinOff className="h-3.5 w-3.5" /> : <Pin className="h-3.5 w-3.5" />}
        {chat.pinned ? 'Unpin' : 'Pin'}
      </button>

      <button type="button" className="sb-ctx-item" onClick={() => {
        onRenameStart(chat.id, chat.title); onClose();
      }}>
        <Pencil className="h-3.5 w-3.5" /> Rename
      </button>

      <button type="button" className="sb-ctx-item" onClick={() => void run(async () => {
        if (!token) return;
        const clone = await cloneChatById(token, chat.id);
        router.push(`/chat-engine/c/${clone.id}`);
      })}>
        <Copy className="h-3.5 w-3.5" /> Clone
      </button>

      <button type="button" className="sb-ctx-item" onClick={() => void run(async () => {
        if (!token) return;
        const res = await shareChatById(token, chat.id);
        const url = `${window.location.origin}/s/${res.id}`;
        await navigator.clipboard.writeText(url).catch(() => {});
        toast.success('Share link copied');
      })}>
        <Share2 className="h-3.5 w-3.5" /> Share
      </button>

      {folders.length > 0 && (
        <div className="sb-ctx-submenu-wrap">
          <button
            type="button"
            className={cn('sb-ctx-item sb-ctx-item--has-sub', moveOpen && 'sb-ctx-item--sub-open')}
            onClick={() => setMoveOpen((v) => !v)}
          >
            <MoveRight className="h-3.5 w-3.5" /> Move to folder
            <ChevronRight className="h-3 w-3 ml-auto" />
          </button>
          {moveOpen && (
            <div className="sb-ctx-submenu">
              {chat.folder_id && (
                <button type="button" className="sb-ctx-item" onClick={() => void run(async () => {
                  if (!token) return;
                  await moveChatToFolder(token, chat.id, null);
                })}>
                  <X className="h-3 w-3" /> Remove from folder
                </button>
              )}
              {folders.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  className={cn('sb-ctx-item', chat.folder_id === f.id && 'sb-ctx-item--active')}
                  onClick={() => void run(async () => {
                    if (!token) return;
                    await moveChatToFolder(token, chat.id, f.id);
                  })}
                >
                  <Folder className="h-3 w-3" />
                  <span className="truncate">{f.name}</span>
                  {chat.folder_id === f.id && <Check className="h-3 w-3 ml-auto" />}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="sb-ctx-divider" />

      <button type="button" className="sb-ctx-item" onClick={() => void run(async () => {
        if (!token) return;
        await archiveChatById(token, chat.id);
      })}>
        <Archive className="h-3.5 w-3.5" /> Archive
      </button>

      {confirmDelete ? (
        <div className="sb-ctx-confirm">
          <span className="sb-ctx-confirm-text">Delete this chat?</span>
          <button type="button" className="sb-ctx-item sb-ctx-item--danger" disabled={busy}
            onClick={() => void run(async () => {
              if (!token) return;
              await deleteChatById(token, chat.id);
            })}>
            <Trash2 className="h-3.5 w-3.5" /> Confirm delete
          </button>
          <button type="button" className="sb-ctx-item" onClick={() => setConfirmDelete(false)}>
            <X className="h-3.5 w-3.5" /> Cancel
          </button>
        </div>
      ) : (
        <button type="button" className="sb-ctx-item sb-ctx-item--danger" disabled={busy}
          onClick={() => setConfirmDelete(true)}>
          <Trash2 className="h-3.5 w-3.5" /> Delete
        </button>
      )}
    </div>
  );
}

// ── Chat row ───────────────────────────────────────────────────────────────────

interface ChatRowProps {
  chat: Chat;
  active: boolean;
  folders: ChatFolder[];
  renamingId: string | null;
  renameValue: string;
  onRenameChange: (v: string) => void;
  onRenameSave: (id: string) => void;
  onRenameStart: (id: string, current: string) => void;
  onMutate: () => void;
}

function ChatRow({
  chat, active, folders, renamingId, renameValue,
  onRenameChange, onRenameSave, onRenameStart, onMutate,
}: ChatRowProps) {
  const [menuAnchor, setMenuAnchor] = useState<DOMRect | null>(null);
  const isRenaming = renamingId === chat.id;

  return (
    <div className={cn('sb-chat-row', active && 'sb-chat-row--active')}>
      {isRenaming ? (
        <input
          type="text"
          className="sb-rename-input"
          value={renameValue}
          onChange={(e) => onRenameChange(e.target.value)}
          onBlur={() => onRenameSave(chat.id)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') onRenameSave(chat.id);
            if (e.key === 'Escape') onRenameChange('');
          }}
          autoFocus
        />
      ) : (
        <Link href={`/chat-engine/c/${chat.id}`} className="sb-chat-link">
          <span className="sb-chat-title">{chat.title || 'Untitled chat'}</span>
          <span className="sb-chat-age">{formatTimeAgo(chat.updated_at)}</span>
        </Link>
      )}

      {!isRenaming && (
        <button
          type="button"
          className="sb-chat-menu-btn"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setMenuAnchor((e.currentTarget as HTMLElement).getBoundingClientRect());
          }}
          title="More options"
        >
          <MoreHorizontal className="h-3.5 w-3.5" />
        </button>
      )}

      {menuAnchor && (
        <ChatContextMenu
          chat={chat}
          folders={folders}
          anchor={menuAnchor}
          onClose={() => setMenuAnchor(null)}
          onMutate={() => { setMenuAnchor(null); onMutate(); }}
          onRenameStart={onRenameStart}
        />
      )}
    </div>
  );
}

// ── Folder section ─────────────────────────────────────────────────────────────

interface FolderSectionProps {
  folder: ChatFolder;
  chats: Chat[];
  allFolders: ChatFolder[];
  activeId: string;
  renamingId: string | null;
  renameValue: string;
  onRenameChange: (v: string) => void;
  onRenameSave: (id: string) => void;
  onRenameStart: (id: string, current: string) => void;
  onMutate: () => void;
}

function FolderSection({
  folder, chats, allFolders, activeId,
  renamingId, renameValue, onRenameChange, onRenameSave, onRenameStart, onMutate,
}: FolderSectionProps) {
  const [expanded, setExpanded] = useState(false);
  const [folderRenaming, setFolderRenaming] = useState(false);
  const [folderRenameVal, setFolderRenameVal] = useState(folder.name);
  const [menuAnchor, setMenuAnchor] = useState<DOMRect | null>(null);
  const ctxRef = useRef<HTMLDivElement>(null);

  const hasActive = chats.some((c) => c.id === activeId);
  useEffect(() => { if (hasActive) setExpanded(true); }, [hasActive]);

  useEffect(() => {
    if (!menuAnchor) return;
    const handler = (e: MouseEvent) => {
      if (ctxRef.current && !ctxRef.current.contains(e.target as Node)) setMenuAnchor(null);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [menuAnchor]);

  const token = getToken();

  async function handleFolderRename() {
    if (!token || !folderRenameVal.trim()) { setFolderRenaming(false); return; }
    try {
      await updateFolder(token, folder.id, { name: folderRenameVal.trim() });
      onMutate();
    } catch { toast.error('Failed to rename folder'); }
    setFolderRenaming(false);
  }

  async function handleFolderDelete() {
    if (!token) return;
    try { await deleteFolder(token, folder.id); onMutate(); }
    catch { toast.error('Failed to delete folder'); }
    setMenuAnchor(null);
  }

  return (
    <div className="sb-folder">
      <div className={cn('sb-folder-header', expanded && 'sb-folder-header--open')}>
        <button type="button" className="sb-folder-toggle" onClick={() => setExpanded((v) => !v)}>
          <ChevronRight className={cn('sb-folder-chevron', expanded && 'sb-folder-chevron--open')} />
          {expanded
            ? <FolderOpen className="h-3.5 w-3.5 sb-folder-icon" />
            : <Folder className="h-3.5 w-3.5 sb-folder-icon" />}
          {folderRenaming ? (
            <input
              type="text"
              className="sb-rename-input sb-rename-input--inline"
              value={folderRenameVal}
              onChange={(e) => setFolderRenameVal(e.target.value)}
              onBlur={() => void handleFolderRename()}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void handleFolderRename();
                if (e.key === 'Escape') { setFolderRenaming(false); setFolderRenameVal(folder.name); }
              }}
              autoFocus
              onClick={(e) => e.stopPropagation()}
            />
          ) : (
            <span className="sb-folder-name">{folder.name}</span>
          )}
          {chats.length > 0 && <span className="sb-folder-count">{chats.length}</span>}
        </button>

        {!folderRenaming && (
          <button
            type="button"
            className="sb-folder-menu-btn"
            onClick={(e) => {
              e.stopPropagation();
              setMenuAnchor((e.currentTarget as HTMLElement).getBoundingClientRect());
            }}
          >
            <MoreHorizontal className="h-3 w-3" />
          </button>
        )}

        {menuAnchor && (
          <div ref={ctxRef} className="sb-ctx-menu" style={{ position: 'fixed', top: menuAnchor.bottom + 4, left: menuAnchor.left, zIndex: 600 }}>
            <button type="button" className="sb-ctx-item" onClick={() => { setFolderRenaming(true); setMenuAnchor(null); }}>
              <Pencil className="h-3.5 w-3.5" /> Rename
            </button>
            <button type="button" className="sb-ctx-item sb-ctx-item--danger" onClick={() => void handleFolderDelete()}>
              <Trash2 className="h-3.5 w-3.5" /> Delete
            </button>
          </div>
        )}
      </div>

      {expanded && (
        <div className="sb-folder-chats">
          {chats.length === 0 ? (
            <p className="sb-folder-empty">No chats in this folder</p>
          ) : (
            chats.map((chat) => (
              <ChatRow
                key={chat.id}
                chat={chat}
                active={chat.id === activeId}
                folders={allFolders}
                renamingId={renamingId}
                renameValue={renameValue}
                onRenameChange={onRenameChange}
                onRenameSave={onRenameSave}
                onRenameStart={onRenameStart}
                onMutate={onMutate}
              />
            ))
          )}
        </div>
      )}
    </div>
  );
}

// ── New folder inline input ────────────────────────────────────────────────────

function NewFolderInput({ onSave, onCancel }: { onSave: (name: string) => void; onCancel: () => void }) {
  const [val, setVal] = useState('');
  return (
    <div className="sb-new-folder-row">
      <Folder className="h-3.5 w-3.5 sb-folder-icon flex-shrink-0" />
      <input
        type="text"
        className="sb-rename-input"
        placeholder="Folder name…"
        value={val}
        onChange={(e) => setVal(e.target.value)}
        onBlur={() => { if (val.trim()) onSave(val.trim()); else onCancel(); }}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && val.trim()) onSave(val.trim());
          if (e.key === 'Escape') onCancel();
        }}
        autoFocus
      />
    </div>
  );
}

// ── Chat Sidebar ───────────────────────────────────────────────────────────────

export function ChatSidebar() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { user } = useAuthContext();
  const config = useAuthStore((s) => s.config);
  const { models, settings } = useWorkspaceStore();
  const { chats, setChats, pinnedChats, setPinnedChats, folders, setFolders } = useChatStore();
  const { showSidebar, setShowSidebar, mobile, setSidebarWidth, sidebarWidth } = useUIStore();

  const [loading, setLoading] = useState(false);
  const [searchInput, setSearchInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [creatingFolder, setCreatingFolder] = useState(false);
  const [showPinnedModels, setShowPinnedModels] = useState(true);

  const sidebarRef = useRef<HTMLElement>(null);
  const resizingRef = useRef(false);
  const searchRef = useRef<HTMLInputElement>(null);

  const activeChatId = pathname.match(/\/c\/([^/]+)/)?.[1] ?? '';

  // Load chat data
  const loadAll = useCallback(async () => {
    const token = getToken();
    if (!token) return;
    setLoading(true);
    const [chatList, pinned, folderList] = await Promise.all([
      getChatList(token).catch(() => [] as Chat[]),
      getPinnedChats(token).catch(() => [] as Chat[]),
      getFolders(token).catch(() => [] as ChatFolder[]),
    ]);
    setChats(chatList);
    setPinnedChats(pinned);
    setFolders(folderList);
    setLoading(false);
  }, [setChats, setPinnedChats, setFolders]);

  useEffect(() => {
    if (user) void loadAll();
  }, [user, loadAll]);

  // Debounce search input → searchQuery
  useEffect(() => {
    const id = setTimeout(() => setSearchQuery(searchInput), 200);
    return () => clearTimeout(id);
  }, [searchInput]);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.key === 'b') { e.preventDefault(); setShowSidebar(!showSidebar); }
      if (mod && e.shiftKey && (e.key === 'O' || e.key === 'o')) { e.preventDefault(); router.push('/chat-engine'); }
      if (mod && e.key === 'k') { e.preventDefault(); searchRef.current?.focus(); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [showSidebar, setShowSidebar, router]);

  // Sidebar resize
  const startResize = (e: React.MouseEvent) => {
    e.preventDefault();
    resizingRef.current = true;
    const startX = e.clientX;
    const startW = sidebarRef.current?.offsetWidth ?? sidebarWidth;
    const onMove = (ev: MouseEvent) => {
      if (!resizingRef.current) return;
      setSidebarWidth(Math.min(480, Math.max(220, startW + ev.clientX - startX)));
    };
    const onUp = () => {
      resizingRef.current = false;
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  };

  // Rename
  const startRename = (id: string, current: string) => { setRenamingId(id); setRenameValue(current); };

  const saveRename = useCallback(async (id: string) => {
    if (!renameValue.trim()) { setRenamingId(null); return; }
    const token = getToken();
    if (!token) return;
    try { await updateChatById(token, id, { title: renameValue.trim() }); void loadAll(); }
    catch { toast.error('Failed to rename'); }
    setRenamingId(null);
    setRenameValue('');
  }, [renameValue, loadAll]);

  // Create folder
  const saveNewFolder = async (name: string) => {
    const token = getToken();
    if (!token) return;
    try { await createFolder(token, name); void loadAll(); }
    catch { toast.error('Failed to create folder'); }
    setCreatingFolder(false);
  };

  // Sign out
  async function handleSignOut() {
    await userSignOut().catch(() => {});
    clearSession();
    router.push(AUTH_PATH);
  }

  // Derived
  const activeModelId = searchParams.get('model') ?? '';
  const allChats = chats ?? [];
  const filteredChats = searchQuery
    ? allChats.filter((c) => c.title.toLowerCase().includes(searchQuery.toLowerCase()))
    : allChats;
  const rootChats = filteredChats.filter((c) => !c.folder_id);
  const grouped = groupByTimeRange(rootChats);
  const configuredDefaultPinnedModels = (
    ((config as { default_pinned_models?: string } | null)?.default_pinned_models) ?? ''
  )
    .split(',')
    .map((id: string) => id.trim())
    .filter(Boolean);
  const explicitPinnedModels = (settings?.pinnedModels ?? []).filter(
    (id): id is string => typeof id === 'string' && id.trim().length > 0
  );
  const pinnedModelIds: string[] = explicitPinnedModels.length > 0
    ? explicitPinnedModels
    : configuredDefaultPinnedModels;
  const pinnedModels: Model[] = pinnedModelIds
    .map((id) => models.find((model) => model.id === id))
    .filter((model): model is Model => Boolean(model));

  // ── Nav items (mirrors DashboardSidebar)
  const navItems = [
    { label: 'Home', href: '/', icon: Home, isActive: pathname === '/' || pathname === '/home' },
  ];

  // ── Collapsed icon rail ────────────────────────────────────────────────────
  if (!showSidebar && mobile) {
    return (
      <button
        className="sidebar-shell-toggle fixed left-3 top-3 z-40"
        onClick={() => setShowSidebar(true)}
        aria-label="Open Sidebar"
      >
        <PanelLeft className="h-4 w-4" />
      </button>
    );
  }

  if (!showSidebar) {
    return (
      <SidebarShell collapsed className="hidden lg:flex">
        <div className="flex h-full w-full flex-col items-center p-2.5">
          <div className="flex w-full flex-col items-center gap-1">
            <button
              className="sidebar-shell-toggle"
              onClick={() => setShowSidebar(true)}
              aria-label="Open Sidebar"
            >
              <PanelLeft className="h-4 w-4" />
            </button>
            <div className="mt-2 flex flex-col gap-1">
              {navItems.map((item) => (
                <SidebarNavItem
                  key={item.label}
                  href={item.href}
                  icon={item.icon}
                  label={item.label}
                  isActive={item.isActive}
                  collapsed
                />
              ))}
              <button
                className="sidebar-shell-toggle"
                onClick={() => { router.push('/chat-engine'); }}
                aria-label="New Chat"
                title="New Chat"
              >
                <PencilLine className="h-4 w-4" />
              </button>
              <SidebarNavItem
                href="/workspace/notes"
                icon={BookOpen}
                label="Notes"
                isActive={pathname.startsWith('/workspace/notes')}
                collapsed
              />
            </div>
          </div>
          {user && (
            <div className="mt-auto pb-1">
              <SidebarUserFooter
                user={user}
                onSignOut={handleSignOut}
                onNavigate={router.push}
                collapsed
              />
            </div>
          )}
        </div>
      </SidebarShell>
    );
  }

  // ── Expanded sidebar ───────────────────────────────────────────────────────
  return (
    <SidebarShell
      sidebarRef={sidebarRef}
      mobile={mobile}
      onOverlayClick={() => setShowSidebar(false)}
      width={sidebarWidth}
    >
      <div className="flex h-full flex-col p-3 sm:p-4">

          {/* ── Header (identical to DashboardSidebar) ─────────────────── */}
          <div className="mb-3">
            <div className="mb-1 flex h-7 w-full items-center overflow-hidden">
              <img
                src="/static/bodhion_icon.svg"
                alt="Bodhion"
                className="h-full w-auto max-w-full object-contain object-left"
                draggable={false}
              />
            </div>
            <div className="flex items-center justify-between gap-2.5">
              <div className="flex min-w-0 items-center gap-2.5">
                <picture>
                  <source srcSet="/static/logo-bodhion-dark.jpeg" media="(prefers-color-scheme: dark)" />
                  <img
                    src="/static/logo-bodhion-light.png"
                    alt="Bodhion"
                    className="h-8 w-auto"
                    draggable={false}
                  />
                </picture>
                <span className="truncate text-lg font-semibold sidebar-user-name">
                  Bodhion
                </span>
              </div>
              <button
                className="sidebar-shell-toggle"
                onClick={() => setShowSidebar(false)}
                aria-label="Close Sidebar"
              >
                <PanelLeft className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* ── Nav items (Home, Workspace) ─────────────────────────────── */}
          <nav className="flex flex-col gap-1.5 mb-2">
            {navItems.map((item) => (
              <SidebarNavItem
                key={item.label}
                href={item.href}
                icon={item.icon}
                label={item.label}
                isActive={item.isActive}
                onClick={() => { if (mobile) setShowSidebar(false); }}
              />
            ))}
          </nav>

          <div className="sb-nav-divider" />

          {/* ── New Chat ────────────────────────────────────────────────── */}
          <button
            type="button"
            className="sb-new-chat-btn"
            onClick={() => { router.push('/chat-engine'); if (mobile) setShowSidebar(false); }}
            title="New Chat (Ctrl+Shift+O)"
          >
            <PencilLine className="h-4 w-4 shrink-0" />
            <span>New Chat</span>
          </button>

          {/* ── Search ──────────────────────────────────────────────────── */}
          <div className="sb-search-wrap mt-1.5">
            <Search className="sb-search-icon" />
            <input
              ref={searchRef}
              type="text"
              placeholder="Search… (Ctrl+K)"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="sb-search-input"
            />
            {searchInput && (
              <button type="button" className="sb-search-clear" onClick={() => { setSearchInput(''); setSearchQuery(''); }}>
                <X className="h-3 w-3" />
              </button>
            )}
          </div>

          {/* ── Notes ───────────────────────────────────────────────────── */}
          <div className="mt-1.5">
            <SidebarNavItem
              href="/workspace/notes"
              icon={BookOpen}
              label="Notes"
              isActive={pathname.startsWith('/workspace/notes')}
              onClick={() => { if (mobile) setShowSidebar(false); }}
            />
          </div>

          {/* ── Scrollable list (Folders + History) ─────────────────────── */}
          <div className="sb-list mt-2">
            {loading ? (
              <div className="sb-loading"><Spinner size="sm" /></div>
            ) : (
              <>
                {/* Pinned */}
                {pinnedChats.length > 0 && !searchQuery && (
                  <div className="sb-section">
                    <p className="sb-section-label">Pinned</p>
                    {pinnedChats.map((chat) => (
                      <ChatRow
                        key={chat.id}
                        chat={chat}
                        active={chat.id === activeChatId}
                        folders={folders}
                        renamingId={renamingId}
                        renameValue={renameValue}
                        onRenameChange={setRenameValue}
                        onRenameSave={(id) => void saveRename(id)}
                        onRenameStart={startRename}
                        onMutate={() => void loadAll()}
                      />
                    ))}
                  </div>
                )}

                {/* Folders */}
                {!searchQuery && (
                  <div className="sb-section">
                    {pinnedModels.length > 0 && (
                      <>
                        <button
                          type="button"
                          className={cn('sb-models-header', showPinnedModels && 'sb-models-header--open')}
                          onClick={() => setShowPinnedModels((v) => !v)}
                        >
                          <ChevronRight className={cn('sb-models-chevron', showPinnedModels && 'sb-models-chevron--open')} />
                          <span className="sb-section-label">Models</span>
                        </button>
                        {showPinnedModels && (
                          <div className="sb-models-list">
                            {pinnedModels.map((model) => (
                              <button
                                key={model.id}
                                type="button"
                                className={cn('sb-model-row', model.id === activeModelId && 'sb-model-row--active')}
                                onClick={() => {
                                  router.push(`/chat-engine?model=${encodeURIComponent(model.id)}`);
                                  if (mobile) setShowSidebar(false);
                                }}
                                title={model.name || model.id}
                              >
                                {model.info?.meta?.profile_image_url ? (
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <img
                                    src={model.info.meta.profile_image_url}
                                    alt={model.name || model.id}
                                    className="sb-model-avatar"
                                  />
                                ) : (
                                  <Bot className="h-4 w-4 sb-model-avatar-icon" />
                                )}
                                <span className="sb-model-name truncate">{model.name || model.id}</span>
                                {model.id === activeModelId && (
                                  <Check className="h-3 w-3 sb-model-row-check ml-auto shrink-0" />
                                )}
                              </button>
                            ))}
                          </div>
                        )}
                      </>
                    )}

                    <div className="sb-section-header">
                      <p className="sb-section-label">Folders</p>
                      <button
                        type="button"
                        className="sb-section-add-btn"
                        onClick={() => setCreatingFolder(true)}
                        title="New folder"
                      >
                        <FolderPlus className="h-3.5 w-3.5" />
                      </button>
                    </div>

                    {creatingFolder && (
                      <NewFolderInput
                        onSave={(name) => void saveNewFolder(name)}
                        onCancel={() => setCreatingFolder(false)}
                      />
                    )}

                    {folders.length === 0 && !creatingFolder && (
                      <button
                        type="button"
                        className="sb-new-folder-btn"
                        onClick={() => setCreatingFolder(true)}
                      >
                        <FolderPlus className="h-3.5 w-3.5" />
                        <span>New folder</span>
                      </button>
                    )}

                    {folders.map((folder) => (
                      <FolderSection
                        key={folder.id}
                        folder={folder}
                        chats={allChats.filter((c) => c.folder_id === folder.id)}
                        allFolders={folders}
                        activeId={activeChatId}
                        renamingId={renamingId}
                        renameValue={renameValue}
                        onRenameChange={setRenameValue}
                        onRenameSave={(id) => void saveRename(id)}
                        onRenameStart={startRename}
                        onMutate={() => void loadAll()}
                      />
                    ))}
                  </div>
                )}

                {/* History */}
                <div className="sb-section">
                  <p className="sb-section-label">History</p>
                  {grouped.length === 0 && (
                    <p className="sb-empty">{searchQuery ? 'No chats found' : 'No chats yet'}</p>
                  )}
                  {grouped.map(({ range, chats: group }) => (
                    <div key={range}>
                      <p className="sb-time-range-label">{range}</p>
                      {group.map((chat) => (
                        <ChatRow
                          key={chat.id}
                          chat={chat}
                          active={chat.id === activeChatId}
                          folders={folders}
                          renamingId={renamingId}
                          renameValue={renameValue}
                          onRenameChange={setRenameValue}
                          onRenameSave={(id) => void saveRename(id)}
                          onRenameStart={startRename}
                          onMutate={() => void loadAll()}
                        />
                      ))}
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* ── Footer ──────────────────────────────────────────────────── */}
          {user && (
            <div className="mt-auto pt-4">
              <SidebarUserFooter
                user={user}
                onSignOut={handleSignOut}
                onNavigate={router.push}
              />
            </div>
          )}
        </div>

        {/* Resize handle */}
        {!mobile && (
          <div className="sb-resize-handle" onMouseDown={startResize} title="Drag to resize" />
        )}
      </SidebarShell>
  );
}

export default ChatSidebar;
