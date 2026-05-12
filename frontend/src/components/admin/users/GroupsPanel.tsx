'use client';

import { useEffect, useState, useCallback } from 'react';
import { Plus, Users } from 'lucide-react';
import { toast } from 'sonner';

import { Button }         from '@/components/ui/Button';
import { Spinner }        from '@/components/ui/Spinner';
import { ConfirmDialog }  from '@/components/shared/ConfirmDialog';
import { GroupItem }      from '@/components/admin/users/groups/GroupItem';
import { EditGroupModal } from '@/components/admin/users/modals/EditGroupModal';

import { getToken }                              from '@/lib/auth/session';
import { adminGetGroups, adminDeleteGroup }       from '@/lib/api/admin/users';
import { adminGetAllUsers }                       from '@/lib/api/admin/users';
import type { Group, AdminUser }                  from '@/types/api';

export function GroupsPanel() {
  const [groups,       setGroups]       = useState<Group[]>([]);
  const [allUsers,     setAllUsers]     = useState<AdminUser[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [editTarget,   setEditTarget]   = useState<Group | null>(null);
  const [createOpen,   setCreateOpen]   = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Group | null>(null);
  const [deleteBusy,   setDeleteBusy]   = useState(false);

  const fetchGroups = useCallback(async () => {
    const token = getToken();
    if (!token) return;
    setLoading(true);
    try {
      const [groupsRes, usersRes] = await Promise.all([
        adminGetGroups(token),
        adminGetAllUsers(token),
      ]);
      // Backend may return a plain array or a wrapped { users: [] } shape
      const groupsArr = Array.isArray(groupsRes) ? groupsRes : (groupsRes as { groups?: typeof groupsRes })?.groups ?? [];
      const usersArr  = Array.isArray(usersRes)  ? usersRes  : (usersRes  as { users?: typeof usersRes  })?.users  ?? [];
      setGroups(groupsArr as typeof groupsRes);
      setAllUsers(usersArr as typeof usersRes);
    } catch {
      toast.error('Failed to load groups');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchGroups(); }, [fetchGroups]);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleteBusy(true);
    try {
      const token = getToken();
      if (!token) throw new Error('No token');
      await adminDeleteGroup(token, deleteTarget.id);
      toast.success(`"${deleteTarget.name}" deleted`);
      setDeleteTarget(null);
      setGroups((prev) => prev.filter((g) => g.id !== deleteTarget.id));
    } catch {
      toast.error('Failed to delete group');
    } finally {
      setDeleteBusy(false);
    }
  };

  const handleSaved = (saved: Group) => {
    setGroups((prev) => {
      const exists = prev.some((g) => g.id === saved.id);
      return exists
        ? prev.map((g) => (g.id === saved.id ? saved : g))
        : [saved, ...prev];
    });
    setEditTarget(null);
    setCreateOpen(false);
  };

  return (
    <div className="flex flex-col gap-5 p-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold">Groups</h2>
          <p className="text-sm text-muted-foreground">
            Organise users and assign shared permissions.
          </p>
        </div>
        <Button size="sm" onClick={() => setCreateOpen(true)} className="gap-1.5 shrink-0">
          <Plus className="h-4 w-4" />
          New group
        </Button>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex justify-center py-16">
          <Spinner size="md" />
        </div>
      ) : groups.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border py-16 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
            <Users className="h-6 w-6 text-muted-foreground" />
          </div>
          <p className="font-medium text-muted-foreground">No groups yet</p>
          <p className="text-sm text-muted-foreground/70">
            Create a group to assign permissions to multiple users at once.
          </p>
          <Button size="sm" variant="outline" onClick={() => setCreateOpen(true)} className="mt-1 gap-1.5">
            <Plus className="h-4 w-4" /> Create first group
          </Button>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {groups.map((g) => (
            <GroupItem
              key={g.id}
              group={g}
              onEdit={setEditTarget}
              onDelete={setDeleteTarget}
            />
          ))}
        </div>
      )}

      {/* Create modal (null group = create mode) */}
      <EditGroupModal
        group={null}
        open={createOpen}
        allUsers={allUsers}
        onClose={() => setCreateOpen(false)}
        onSaved={handleSaved}
      />

      {/* Edit modal */}
      <EditGroupModal
        group={editTarget}
        open={!!editTarget}
        allUsers={allUsers}
        onClose={() => setEditTarget(null)}
        onSaved={handleSaved}
      />

      <ConfirmDialog
        open={!!deleteTarget}
        title={`Delete "${deleteTarget?.name}"?`}
        description="This will remove the group and revoke permissions assigned through it."
        confirmLabel="Delete group"
        loading={deleteBusy}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}

export default GroupsPanel;
