'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Search, X, UserPlus } from 'lucide-react';

import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/Modal';
import { Button }    from '@/components/ui/Button';
import { Switch }    from '@/components/ui/Switch';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/Avatar';
import { cn }        from '@/lib/utils/cn';

import { getToken } from '@/lib/auth/session';
import { adminCreateGroup, adminUpdateGroup } from '@/lib/api/admin/users';
import type { Group, AdminUser } from '@/types/api';
import type { UserPermissions }  from '@/types/auth';

// ─── Types ────────────────────────────────────────────────────────────────────

interface PermState {
  chat: {
    temporary: boolean; delete: boolean; edit: boolean; stt: boolean;
    call: boolean; multiple_models: boolean; file_upload: boolean;
    image_generation: boolean; web_search: boolean; code_interpreter: boolean; arena: boolean;
  };
  workspace: { models: boolean; knowledge: boolean; prompts: boolean; tools: boolean };
  features: {
    direct_tool_servers: boolean; web_search: boolean; image_generation: boolean;
    code_interpreter: boolean; leaderboard: boolean; notes: boolean; channels: boolean;
  };
}

const DEFAULT_PERMS: PermState = {
  chat: {
    temporary: false, delete: false, edit: false, stt: false, call: false,
    multiple_models: false, file_upload: false, image_generation: false,
    web_search: false, code_interpreter: false, arena: false,
  },
  workspace: { models: false, knowledge: false, prompts: false, tools: false },
  features: {
    direct_tool_servers: false, web_search: false, image_generation: false,
    code_interpreter: false, leaderboard: false, notes: false, channels: false,
  },
};

function permFromGroup(group: Group | null): PermState {
  if (!group?.permissions) return DEFAULT_PERMS;
  const p = group.permissions as UserPermissions;
  return {
    chat: {
      temporary:        !!(p.chat?.temporary),
      delete:           !!(p.chat?.delete),
      edit:             !!(p.chat?.edit),
      stt:              !!(p.chat?.stt),
      call:             !!(p.chat?.call),
      multiple_models:  !!(p.chat?.multiple_models),
      file_upload:      !!(p.chat?.file_upload),
      image_generation: !!(p.chat?.image_generation),
      web_search:       !!(p.chat?.web_search),
      code_interpreter: !!(p.chat?.code_interpreter),
      arena:            !!(p.chat?.arena),
    },
    workspace: {
      models:    !!(p.workspace?.models),
      knowledge: !!(p.workspace?.knowledge),
      prompts:   !!(p.workspace?.prompts),
      tools:     !!(p.workspace?.tools),
    },
    features: {
      direct_tool_servers: !!(p.features?.direct_tool_servers),
      web_search:          !!(p.features?.web_search),
      image_generation:    !!(p.features?.image_generation),
      code_interpreter:    !!(p.features?.code_interpreter),
      leaderboard:         !!(p.features?.leaderboard),
      notes:               !!(p.features?.notes),
      channels:            !!(p.features?.channels),
    },
  };
}

// ─── Permission row ───────────────────────────────────────────────────────────

function PermRow({
  label, checked, onChange,
}: {
  label: string; checked: boolean; onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-2">
      <span className="text-sm text-foreground">{label}</span>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}

// ─── EditGroupModal ───────────────────────────────────────────────────────────

type TabId = 'general' | 'permissions' | 'users';

interface EditGroupModalProps {
  group:    Group | null;
  open:     boolean;
  allUsers: AdminUser[];
  onClose:  () => void;
  onSaved:  (group: Group) => void;
}

function userInitials(name: string) {
  return name.split(' ').slice(0, 2).map((w) => w[0]).join('').toUpperCase();
}

export function EditGroupModal({ group, open, allUsers, onClose, onSaved }: EditGroupModalProps) {
  const isCreate = group === null;
  const [activeTab,   setActiveTab]   = useState<TabId>('general');
  const [name,        setName]        = useState('');
  const [description, setDescription] = useState('');
  const [perms,       setPerms]       = useState<PermState>(DEFAULT_PERMS);
  const [memberIds,   setMemberIds]   = useState<string[]>([]);
  const [userSearch,  setUserSearch]  = useState('');
  const [saving,      setSaving]      = useState(false);

  useEffect(() => {
    if (!open) return;
    setActiveTab('general');
    setName(group?.name ?? '');
    setDescription(group?.description ?? '');
    setPerms(permFromGroup(group));
    setMemberIds(group?.user_ids ?? []);
    setUserSearch('');
  }, [open, group]);

  // ── Permissions helpers ───────────────────────────────────────────────────

  const setChatPerm  = <K extends keyof PermState['chat']>(k: K, v: boolean) =>
    setPerms((p) => ({ ...p, chat:      { ...p.chat,      [k]: v } }));
  const setWsPerm    = <K extends keyof PermState['workspace']>(k: K, v: boolean) =>
    setPerms((p) => ({ ...p, workspace: { ...p.workspace, [k]: v } }));
  const setFeatPerm  = <K extends keyof PermState['features']>(k: K, v: boolean) =>
    setPerms((p) => ({ ...p, features:  { ...p.features,  [k]: v } }));

  // ── User membership helpers ───────────────────────────────────────────────

  const safeUsers = Array.isArray(allUsers) ? allUsers : [];
  const filteredUsers = safeUsers.filter((u) => {
    if (!userSearch.trim()) return true;
    const q = userSearch.toLowerCase();
    return u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q);
  });

  const toggleMember = (userId: string) => {
    setMemberIds((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    );
  };

  // ── Save ──────────────────────────────────────────────────────────────────

  const handleSave = async () => {
    if (!name.trim()) {
      setActiveTab('general');
      toast.error('Group name is required');
      return;
    }
    setSaving(true);
    try {
      const token = getToken();
      if (!token) throw new Error('No token');
      const payload = {
        name:        name.trim(),
        description: description.trim() || undefined,
        permissions: perms as unknown as UserPermissions,
        user_ids:    memberIds,
      };
      const saved = isCreate
        ? await adminCreateGroup(token, payload)
        : await adminUpdateGroup(token, group!.id, payload);
      onSaved(saved);
      toast.success(isCreate ? 'Group created' : 'Group updated');
    } catch (err: unknown) {
      const detail = (err as { detail?: string })?.detail;
      toast.error(detail ?? 'Failed to save group');
    } finally {
      setSaving(false);
    }
  };

  // ── Tab nav ───────────────────────────────────────────────────────────────

  const TABS: { id: TabId; label: string }[] = [
    { id: 'general',     label: 'General' },
    { id: 'permissions', label: 'Permissions' },
    { id: 'users',       label: `Members (${memberIds.length})` },
  ];

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="admin-dialog flex max-h-[90vh] flex-col sm:max-w-lg">
        <DialogHeader className="shrink-0">
          <DialogTitle>{isCreate ? 'Create group' : `Edit "${group?.name}"`}</DialogTitle>
        </DialogHeader>

        {/* Tab bar */}
        <div className="shrink-0 border-b" style={{ borderColor: 'var(--bodhion-card-border)' }}>
          <div className="flex gap-1 px-1">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  'relative px-3 py-2.5 text-sm font-medium transition-colors',
                  activeTab === tab.id
                    ? 'text-[var(--bodhion-text-primary)]'
                    : 'text-[var(--bodhion-text-secondary)] hover:text-[var(--bodhion-text-primary)]'
                )}
              >
                {tab.label}
                {activeTab === tab.id && (
                  <span className="absolute inset-x-0 bottom-0 h-0.5 rounded-full bg-primary" />
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Tab content */}
        <div className="min-h-0 flex-1 overflow-y-auto px-1 py-3">

          {/* ── General ──────────────────────────────────────────────────── */}
          {activeTab === 'general' && (
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium">Group name <span className="text-destructive">*</span></label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Engineering Team"
                  autoFocus
                  className="admin-input h-9 w-full rounded-md px-3 text-sm"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium">Description <span className="text-muted-foreground font-normal">(optional)</span></label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="What is this group for?"
                  rows={3}
                  className="admin-input w-full resize-none rounded-md px-3 py-2 text-sm"
                />
              </div>
            </div>
          )}

          {/* ── Permissions ──────────────────────────────────────────────── */}
          {activeTab === 'permissions' && (
            <div className="flex flex-col gap-5">
              {/* Chat */}
              <section>
                <p className="admin-section-label mb-1">Chat</p>
                <div className="rounded-lg border px-3" style={{ borderColor: 'var(--bodhion-card-border)' }}>
                  <PermRow label="Temporary chats"     checked={perms.chat.temporary}        onChange={(v) => setChatPerm('temporary', v)} />
                  <PermRow label="Delete messages"     checked={perms.chat.delete}            onChange={(v) => setChatPerm('delete', v)} />
                  <PermRow label="Edit messages"       checked={perms.chat.edit}              onChange={(v) => setChatPerm('edit', v)} />
                  <PermRow label="Speech to text"      checked={perms.chat.stt}               onChange={(v) => setChatPerm('stt', v)} />
                  <PermRow label="Voice calls"         checked={perms.chat.call}              onChange={(v) => setChatPerm('call', v)} />
                  <PermRow label="Multiple models"     checked={perms.chat.multiple_models}   onChange={(v) => setChatPerm('multiple_models', v)} />
                  <PermRow label="File uploads"        checked={perms.chat.file_upload}       onChange={(v) => setChatPerm('file_upload', v)} />
                  <PermRow label="Image generation"    checked={perms.chat.image_generation}  onChange={(v) => setChatPerm('image_generation', v)} />
                  <PermRow label="Web search"          checked={perms.chat.web_search}        onChange={(v) => setChatPerm('web_search', v)} />
                  <PermRow label="Code interpreter"    checked={perms.chat.code_interpreter}  onChange={(v) => setChatPerm('code_interpreter', v)} />
                  <PermRow label="Arena mode"          checked={perms.chat.arena}             onChange={(v) => setChatPerm('arena', v)} />
                </div>
              </section>

              {/* Workspace */}
              <section>
                <p className="admin-section-label mb-1">Workspace</p>
                <div className="rounded-lg border px-3" style={{ borderColor: 'var(--bodhion-card-border)' }}>
                  <PermRow label="Manage models"    checked={perms.workspace.models}    onChange={(v) => setWsPerm('models', v)} />
                  <PermRow label="Manage knowledge" checked={perms.workspace.knowledge} onChange={(v) => setWsPerm('knowledge', v)} />
                  <PermRow label="Manage prompts"   checked={perms.workspace.prompts}   onChange={(v) => setWsPerm('prompts', v)} />
                  <PermRow label="Manage tools"     checked={perms.workspace.tools}     onChange={(v) => setWsPerm('tools', v)} />
                </div>
              </section>

              {/* Features */}
              <section>
                <p className="admin-section-label mb-1">Features</p>
                <div className="rounded-lg border px-3" style={{ borderColor: 'var(--bodhion-card-border)' }}>
                  <PermRow label="Direct tool servers" checked={perms.features.direct_tool_servers} onChange={(v) => setFeatPerm('direct_tool_servers', v)} />
                  <PermRow label="Web search"          checked={perms.features.web_search}          onChange={(v) => setFeatPerm('web_search', v)} />
                  <PermRow label="Image generation"    checked={perms.features.image_generation}    onChange={(v) => setFeatPerm('image_generation', v)} />
                  <PermRow label="Code interpreter"    checked={perms.features.code_interpreter}    onChange={(v) => setFeatPerm('code_interpreter', v)} />
                  <PermRow label="Leaderboard"         checked={perms.features.leaderboard}         onChange={(v) => setFeatPerm('leaderboard', v)} />
                  <PermRow label="Notes"               checked={perms.features.notes}               onChange={(v) => setFeatPerm('notes', v)} />
                  <PermRow label="Channels"            checked={perms.features.channels}            onChange={(v) => setFeatPerm('channels', v)} />
                </div>
              </section>
            </div>
          )}

          {/* ── Users (Members) ──────────────────────────────────────────── */}
          {activeTab === 'users' && (
            <div className="flex flex-col gap-3">
              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                <input
                  type="search"
                  value={userSearch}
                  onChange={(e) => setUserSearch(e.target.value)}
                  placeholder="Search users…"
                  className="admin-input h-9 w-full rounded-md pl-9 pr-3 text-sm"
                />
              </div>

              {/* User list */}
              <div className="flex flex-col rounded-lg border" style={{ borderColor: 'var(--bodhion-card-border)' }}>
                {filteredUsers.length === 0 && (
                  <p className="py-6 text-center text-sm" style={{ color: 'var(--bodhion-text-secondary)' }}>No users found.</p>
                )}
                {filteredUsers.map((u) => {
                  const isMember = memberIds.includes(u.id);
                  return (
                    <div key={u.id} className="flex items-center gap-3 px-3 py-2.5">
                      <Avatar className="h-7 w-7 shrink-0">
                        <AvatarImage src={u.profile_image_url} alt={u.name} />
                        <AvatarFallback className="text-[10px]">{userInitials(u.name)}</AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{u.name}</p>
                        <p className="truncate text-xs" style={{ color: 'var(--bodhion-text-secondary)' }}>{u.email}</p>
                      </div>
                      <button
                        onClick={() => toggleMember(u.id)}
                        className={cn(
                          'shrink-0 rounded-full p-1.5 transition-colors',
                          isMember
                            ? 'bg-destructive/10 text-destructive hover:bg-destructive/20'
                            : 'bg-primary/10 text-primary hover:bg-primary/20'
                        )}
                        title={isMember ? 'Remove from group' : 'Add to group'}
                      >
                        {isMember
                          ? <X className="h-3.5 w-3.5" />
                          : <UserPlus className="h-3.5 w-3.5" />}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="shrink-0 gap-2 border-t pt-4" style={{ borderColor: 'var(--bodhion-card-border)' }}>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? 'Saving…' : isCreate ? 'Create group' : 'Save changes'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default EditGroupModal;
