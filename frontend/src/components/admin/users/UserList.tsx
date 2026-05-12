'use client';

import * as React from 'react';
import { useEffect, useState, useCallback, useRef } from 'react';
import { toast } from 'sonner';
import {
  MoreHorizontal, Plus, Search, Trash2, Pencil, MessageSquare,
} from 'lucide-react';

import { Button }           from '@/components/ui/Button';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/Avatar';
import { AdminTable }       from '@/components/shared/AdminTable';
import { AdminPagination }  from '@/components/shared/AdminPagination';
import { ConfirmDialog }    from '@/components/shared/ConfirmDialog';
import { AddUserModal }     from '@/components/admin/users/modals/AddUserModal';
import { EditUserModal }    from '@/components/admin/users/modals/EditUserModal';
import { UserChatsModal }   from '@/components/admin/users/modals/UserChatsModal';

import { getToken }          from '@/lib/auth/session';
import { searchUsers }       from '@/lib/api/users';
import { adminDeleteUser, adminUpdateUserRole } from '@/lib/api/admin/users';
import type { AdminUser }    from '@/types/api';
import type { AdminColumn }  from '@/components/shared/AdminTable';
import { cn }                from '@/lib/utils/cn';

const PAGE_SIZE = 20;

const SORT_OPTIONS = [
  { value: 'name',           label: 'Name' },
  { value: 'email',          label: 'Email' },
  { value: 'role',           label: 'Role' },
  { value: 'created_at',     label: 'Created' },
  { value: 'last_active_at', label: 'Last active' },
];

const ROLE_VARIANTS: Record<string, string> = {
  admin:   'bg-violet-500/10 text-violet-400 border-violet-500/20',
  user:    'bg-sky-500/10 text-sky-400 border-sky-500/20',
  pending: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
};

function RoleBadge({ role }: { role: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium capitalize',
        ROLE_VARIANTS[role] ?? 'bg-muted text-muted-foreground border-border'
      )}
    >
      {role}
    </span>
  );
}

function formatDate(ts?: number) {
  if (!ts) return '—';
  return new Date(ts * 1000).toLocaleDateString(undefined, {
    year: 'numeric', month: 'short', day: 'numeric',
  });
}

function userInitials(name: string) {
  return name
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();
}

// ─── Role change inline dropdown ─────────────────────────────────────────────
interface RoleSelectProps {
  userId: string;
  currentRole: string;
  onChanged: (userId: string, role: string) => void;
}

function RoleSelect({ userId, currentRole, onChanged }: RoleSelectProps) {
  const [pending, setPending] = useState(false);

  const handleChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newRole = e.target.value;
    if (newRole === currentRole) return;
    setPending(true);
    try {
      const token = getToken();
      if (!token) throw new Error('No token');
      await adminUpdateUserRole(token, userId, newRole);
      onChanged(userId, newRole);
      toast.success('Role updated');
    } catch {
      toast.error('Failed to update role');
    } finally {
      setPending(false);
    }
  };

  return (
    <select
      value={currentRole}
      onChange={handleChange}
      disabled={pending}
      onClick={(e) => e.stopPropagation()}
      className="admin-select rounded-md px-2 py-1 text-xs disabled:opacity-60"
    >
      <option value="admin">Admin</option>
      <option value="user">User</option>
      <option value="pending">Pending</option>
    </select>
  );
}

// ─── Row action menu ──────────────────────────────────────────────────────────
interface RowMenuProps {
  user: AdminUser;
  onEdit:   (u: AdminUser) => void;
  onChats:  (u: AdminUser) => void;
  onDelete: (u: AdminUser) => void;
}

function RowMenu({ user, onEdit, onChats, onDelete }: RowMenuProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  return (
    <div ref={ref} className="relative" onClick={(e) => e.stopPropagation()}>
      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7"
        onClick={() => setOpen((v) => !v)}
        aria-label="Row actions"
      >
        <MoreHorizontal className="h-4 w-4" />
      </Button>
      {open && (
        <div className="admin-popover absolute right-0 z-20 mt-1 w-40 rounded-lg py-1">
          <button
            className="admin-popover-item flex w-full items-center gap-2 px-3 py-1.5 text-sm"
            onClick={() => { setOpen(false); onEdit(user); }}
          >
            <Pencil className="h-3.5 w-3.5 opacity-60" /> Edit details
          </button>
          <button
            className="admin-popover-item flex w-full items-center gap-2 px-3 py-1.5 text-sm"
            onClick={() => { setOpen(false); onChats(user); }}
          >
            <MessageSquare className="h-3.5 w-3.5 opacity-60" /> View chats
          </button>
          <div className="admin-popover-divider my-1 border-t" />
          <button
            className="admin-popover-item admin-popover-item--danger flex w-full items-center gap-2 px-3 py-1.5 text-sm"
            onClick={() => { setOpen(false); onDelete(user); }}
          >
            <Trash2 className="h-3.5 w-3.5" /> Delete user
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Main UserList ────────────────────────────────────────────────────────────
export function UserList() {
  const [users,        setUsers]        = useState<AdminUser[]>([]);
  const [total,        setTotal]        = useState(0);
  const [loading,      setLoading]      = useState(true);
  const [searchInput,  setSearchInput]  = useState('');
  const [searchQuery,  setSearchQuery]  = useState('');
  const [sortBy,       setSortBy]       = useState('name');
  const [sortDir,      setSortDir]      = useState<'asc' | 'desc'>('asc');
  const [page,         setPage]         = useState(1);

  const [addOpen,      setAddOpen]      = useState(false);
  const [editTarget,   setEditTarget]   = useState<AdminUser | null>(null);
  const [chatsTarget,  setChatsTarget]  = useState<AdminUser | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AdminUser | null>(null);
  const [deleteBusy,   setDeleteBusy]   = useState(false);

  // Debounce search input → searchQuery
  useEffect(() => {
    const id = setTimeout(() => {
      setSearchQuery(searchInput);
      setPage(1);
    }, 300);
    return () => clearTimeout(id);
  }, [searchInput]);

  const fetchUsers = useCallback(async () => {
    const token = getToken();
    if (!token) return;
    setLoading(true);
    try {
      const res = await searchUsers(token, {
        query:     searchQuery || undefined,
        orderBy:   sortBy,
        direction: sortDir,
        page,
      });
      setUsers(res.users ?? []);
      setTotal(res.total ?? 0);
    } catch {
      toast.error('Failed to load users');
    } finally {
      setLoading(false);
    }
  }, [searchQuery, sortBy, sortDir, page]);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  const handleSort = (key: string) => {
    if (key === sortBy) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortBy(key);
      setSortDir('asc');
    }
    setPage(1);
  };

  const handleRoleChanged = (userId: string, role: string) => {
    setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, role } : u)));
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleteBusy(true);
    try {
      const token = getToken();
      if (!token) throw new Error('No token');
      await adminDeleteUser(token, deleteTarget.id);
      toast.success(`${deleteTarget.name} deleted`);
      setDeleteTarget(null);
      fetchUsers();
    } catch {
      toast.error('Failed to delete user');
    } finally {
      setDeleteBusy(false);
    }
  };

  const columns: AdminColumn<AdminUser>[] = [
    {
      key: 'name',
      label: 'User',
      sortable: true,
      render: (u) => (
        <div className="flex items-center gap-3">
          <Avatar className="h-8 w-8 shrink-0">
            <AvatarImage src={u.profile_image_url} alt={u.name} />
            <AvatarFallback className="text-xs">{userInitials(u.name)}</AvatarFallback>
          </Avatar>
          <span className="font-medium text-foreground">{u.name}</span>
        </div>
      ),
    },
    {
      key: 'email',
      label: 'Email',
      sortable: true,
      className: 'text-[var(--bodhion-text-secondary)]',
      render: (u) => u.email,
    },
    {
      key: 'role',
      label: 'Role',
      sortable: true,
      render: (u) => (
        <div className="flex items-center gap-2">
          <RoleBadge role={u.role} />
          <RoleSelect
            userId={u.id}
            currentRole={u.role}
            onChanged={handleRoleChanged}
          />
        </div>
      ),
    },
    {
      key: 'created_at',
      label: 'Created',
      sortable: true,
      className: 'text-[var(--bodhion-text-secondary)] text-xs whitespace-nowrap',
      render: (u) => formatDate(u.created_at),
    },
    {
      key: 'last_active_at',
      label: 'Last active',
      sortable: true,
      className: 'text-[var(--bodhion-text-secondary)] text-xs whitespace-nowrap',
      render: (u) => formatDate(u.last_active_at),
    },
    {
      key: '_actions',
      label: '',
      headerClassName: 'w-12',
      render: (u) => (
        <RowMenu
          user={u}
          onEdit={setEditTarget}
          onChats={setChatsTarget}
          onDelete={setDeleteTarget}
        />
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-5 p-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold">Users</h2>
          <p className="text-sm" style={{ color: 'var(--bodhion-text-secondary)' }}>
            {total > 0 ? `${total} total user${total !== 1 ? 's' : ''}` : 'Manage user accounts and roles'}
          </p>
        </div>
        <Button size="sm" onClick={() => setAddOpen(true)} className="gap-1.5 self-start">
          <Plus className="h-4 w-4" />
          Add user
        </Button>
      </div>

      {/* Search + sort bar */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground pointer-events-none" />
          <input
            type="search"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search by name or email…"
            className="admin-input h-9 w-full rounded-md pl-9 pr-3 text-sm"
          />
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span className="hidden sm:inline">Sort:</span>
          <select
            value={sortBy}
            onChange={(e) => { setSortBy(e.target.value); setPage(1); }}
            className="admin-select h-9 rounded-md px-2 text-sm"
          >
            {SORT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
          <button
            onClick={() => setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))}
            className="admin-input flex h-9 w-9 items-center justify-center rounded-md text-xs transition-colors"
            title={sortDir === 'asc' ? 'Ascending' : 'Descending'}
          >
            {sortDir === 'asc' ? '↑' : '↓'}
          </button>
        </div>
      </div>

      {/* Table */}
      <AdminTable<AdminUser>
        columns={columns}
        rows={users}
        getRowKey={(u) => u.id}
        sortBy={sortBy}
        sortDir={sortDir}
        onSort={handleSort}
        loading={loading}
        emptyTitle="No users found"
        emptyDescription="Try adjusting your search query."
      />

      <AdminPagination
        page={page}
        total={total}
        pageSize={PAGE_SIZE}
        onChange={setPage}
      />

      {/* Modals */}
      <AddUserModal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        onCreated={(u) => { setAddOpen(false); fetchUsers(); toast.success(`${u.name} added`); }}
      />

      <EditUserModal
        user={editTarget}
        open={!!editTarget}
        onClose={() => setEditTarget(null)}
        onSaved={(u) => {
          setEditTarget(null);
          setUsers((prev) => prev.map((x) => (x.id === u.id ? { ...x, ...u } : x)));
          toast.success('User updated');
        }}
      />

      <UserChatsModal
        user={chatsTarget}
        open={!!chatsTarget}
        onClose={() => setChatsTarget(null)}
      />

      <ConfirmDialog
        open={!!deleteTarget}
        title={`Delete ${deleteTarget?.name ?? 'user'}?`}
        description="This action cannot be undone. All of their data will be permanently removed."
        confirmLabel="Delete"
        loading={deleteBusy}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}

export default UserList;
