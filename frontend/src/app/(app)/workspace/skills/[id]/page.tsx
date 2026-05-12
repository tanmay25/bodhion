'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Globe, Lock, Pencil, Plus, Search, X } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Input } from '@/components/ui/Input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/Modal';
import { CodeEditor } from '@/components/shared/CodeEditor';
import type { CodeEditorHandle } from '@/components/shared/CodeEditor';
import { SkillMarkdownEditor } from '@/components/workspace/skills/SkillMarkdownEditor';
import { getToken } from '@/lib/auth/session';
import {
  getSkillById,
  updateSkill,
  updateSkillAccess,
  getWorkspaceGroups,
  getWorkspaceGroupInfoById,
  getWorkspaceUserInfoById,
  type AccessGrant,
  type WorkspaceGroupInfo,
  type WorkspaceUserInfo,
} from '@/lib/api/workspace';
import { searchUsers as searchUsersApi } from '@/lib/api/users';
import type { Skill } from '@/types/api';
import { useAuthStore } from '@/store/authStore';

type SkillWithAccess = Skill & { write_access?: boolean };

// ── Access grant helpers ──────────────────────────────────────────────────────

const normalizeAccessGrants = (value: unknown): AccessGrant[] => {
  if (value === null) {
    return [{ principal_type: 'user', principal_id: '*', permission: 'read' }];
  }
  if (!Array.isArray(value)) return [];
  const grants: AccessGrant[] = [];
  for (const item of value) {
    if (!item || typeof item !== 'object') continue;
    const g = item as Partial<AccessGrant>;
    if (
      (g.principal_type === 'user' || g.principal_type === 'group') &&
      typeof g.principal_id === 'string' &&
      (g.permission === 'read' || g.permission === 'write')
    ) {
      grants.push({
        id: g.id,
        principal_type: g.principal_type,
        principal_id: g.principal_id,
        permission: g.permission,
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
    (g) => g.principal_type === 'user' && g.principal_id === '*' && g.permission === 'read'
  );

const getPrincipalIdsByPermission = (
  grants: AccessGrant[],
  principalType: 'user' | 'group',
  permission: 'read' | 'write'
) =>
  Array.from(
    new Set(
      grants
        .filter((g) => g.principal_type === principalType && g.permission === permission)
        .map((g) => g.principal_id)
    )
  );

const hasPrincipalGrant = (
  grants: AccessGrant[],
  principalType: 'user' | 'group',
  principalId: string,
  permission: 'read' | 'write'
) =>
  grants.some(
    (g) =>
      g.principal_type === principalType &&
      g.principal_id === principalId &&
      g.permission === permission
  );

const upsertPrincipalGrant = (
  grants: AccessGrant[],
  principalType: 'user' | 'group',
  principalId: string,
  permission: 'read' | 'write'
): AccessGrant[] => {
  if (hasPrincipalGrant(grants, principalType, principalId, permission)) return grants;
  return [...grants, { principal_type: principalType, principal_id: principalId, permission }];
};

const removePrincipalGrant = (
  grants: AccessGrant[],
  principalType: 'user' | 'group',
  principalId: string,
  permission: 'read' | 'write'
): AccessGrant[] =>
  grants.filter(
    (g) =>
      !(
        g.principal_type === principalType &&
        g.principal_id === principalId &&
        g.permission === permission
      )
  );

const removePrincipal = (
  grants: AccessGrant[],
  principalType: 'user' | 'group',
  principalId: string
): AccessGrant[] => {
  let next = removePrincipalGrant(grants, principalType, principalId, 'read');
  next = removePrincipalGrant(next, principalType, principalId, 'write');
  return next;
};

const togglePrincipalWrite = (
  grants: AccessGrant[],
  principalType: 'user' | 'group',
  principalId: string
): AccessGrant[] => {
  const hasWrite = hasPrincipalGrant(grants, principalType, principalId, 'write');
  if (hasWrite) return removePrincipalGrant(grants, principalType, principalId, 'write');
  let next = upsertPrincipalGrant(grants, principalType, principalId, 'read');
  next = upsertPrincipalGrant(next, principalType, principalId, 'write');
  return next;
};

const setPublicGrant = (grants: AccessGrant[], isPublic: boolean): AccessGrant[] => {
  const filtered = grants.filter(
    (g) => !(g.principal_type === 'user' && g.principal_id === '*' && g.permission === 'read')
  );
  if (!isPublic) return filtered;
  return [
    ...filtered,
    { principal_type: 'user' as const, principal_id: '*', permission: 'read' as const },
  ];
};

const formatDate = (epoch: number) =>
  new Date(epoch * 1000).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

// ── Page ──────────────────────────────────────────────────────────────────────

export default function SkillDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const currentUser = useAuthStore((s) => s.user);
  const id = params?.id ?? '';

  // Skill state
  const [skill, setSkill] = useState<SkillWithAccess | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name: '', description: '' });
  const codeRef = useRef<CodeEditorHandle>(null);
  const mdContentRef = useRef<string>('');

  // Access modal
  const [showAccess, setShowAccess] = useState(false);
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

  const canWrite = skill?.write_access !== false;
  const canShare =
    currentUser?.role === 'admin' ||
    Boolean(
      (currentUser?.permissions as { sharing?: Record<string, boolean> } | undefined)?.sharing
    );

  // Derived from draftAccessGrants
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
      getPrincipalIdsByPermission(draftAccessGrants, 'user', 'read').filter((p) => p !== '*'),
    [draftAccessGrants]
  );
  const writeUserIds = useMemo(
    () =>
      getPrincipalIdsByPermission(draftAccessGrants, 'user', 'write').filter((p) => p !== '*'),
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
      .sort((a, b) => ((a as WorkspaceUserInfo).name ?? a.id).localeCompare((b as WorkspaceUserInfo).name ?? b.id));
  }, [readUserIds, userById, writeUserIds]);

  const isPublic = useMemo(() => hasPublicReadGrant(draftAccessGrants), [draftAccessGrants]);

  const addAccessQueryLower = useMemo(
    () => addAccessQuery.trim().toLowerCase(),
    [addAccessQuery]
  );

  const filteredAddGroups = useMemo(() => {
    const list = availableGroups.slice().sort((a, b) => a.name.localeCompare(b.name));
    if (!addAccessQueryLower) return list;
    return list.filter((g) => g.name.toLowerCase().includes(addAccessQueryLower));
  }, [availableGroups, addAccessQueryLower]);

  const filteredAddUsers = useMemo(() => {
    const list = availableUsers
      .slice()
      .sort((a, b) => (a.name ?? a.id).localeCompare(b.name ?? b.id));
    if (!addAccessQueryLower) return list;
    return list.filter((u) =>
      `${u.name ?? ''} ${u.email ?? ''} ${u.id}`.toLowerCase().includes(addAccessQueryLower)
    );
  }, [availableUsers, addAccessQueryLower]);

  // ── Load ──────────────────────────────────────────────────────────────────

  const load = useCallback(async () => {
    const token = getToken();
    if (!token || !id) return;
    setLoading(true);
    try {
      const result = await getSkillById(token, id);
      const skillData = result as SkillWithAccess;
      setSkill(skillData);
      setForm({ name: skillData.name ?? '', description: skillData.description ?? '' });
      mdContentRef.current = skillData.content ?? '';
      setDraftAccessGrants(normalizeAccessGrants(skillData.access_grants ?? []));
    } catch {
      toast.error('Failed to load skill');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  // ── Edit skill ────────────────────────────────────────────────────────────

  const handleSave = async () => {
    const token = getToken();
    if (!token || !skill) return;
    if (!form.name.trim()) {
      toast.error('Name is required');
      return;
    }
    setSaving(true);
    const isMarkdown = skill.content_type === 'markdown' ||
      skill.content?.trimStart().startsWith('---');
    try {
      const content = isMarkdown
        ? mdContentRef.current
        : (codeRef.current?.getValue() ?? skill.content ?? '');
      const updated = await updateSkill(token, skill.id, {
        name: form.name,
        description: form.description || undefined,
        content,
        content_type: skill.content_type ?? (isMarkdown ? 'markdown' : 'python'),
      } as Partial<Skill>);
      setSkill({ ...(updated as SkillWithAccess), write_access: skill.write_access });
      setEditing(false);
      toast.success('Skill saved');
    } catch (err: unknown) {
      const raw = (err as { detail?: unknown })?.detail;
      const msg = Array.isArray(raw)
        ? (raw as Array<{ msg?: string }>).map((e) => e.msg ?? String(e)).join('; ')
        : typeof raw === 'string' ? raw : 'Failed to save skill';
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  const cancelEdit = () => {
    setEditing(false);
    setForm({ name: skill?.name ?? '', description: skill?.description ?? '' });
  };

  // ── Access helpers ────────────────────────────────────────────────────────

  const hydrateAccessMetadata = useCallback(
    async (grants: AccessGrant[]) => {
      const token = getToken();
      if (!token) return;
      setLoadingAccessMeta(true);
      try {
        const groups = await getWorkspaceGroups(token).catch(() => []);
        if (Array.isArray(groups)) {
          const map: Record<string, WorkspaceGroupInfo> = {};
          for (const g of groups) {
            if (g?.id) map[g.id] = g;
          }
          setGroupById((prev) => ({ ...prev, ...map }));
          setAvailableGroups(groups);
        }

        const unknownGroupIds = Array.from(
          new Set(
            grants
              .filter((g) => g.principal_type === 'group')
              .map((g) => g.principal_id)
          )
        ).filter((pid) => !groupById[pid]);

        if (unknownGroupIds.length > 0) {
          const resolved = await Promise.all(
            unknownGroupIds.map((pid) =>
              getWorkspaceGroupInfoById(token, pid).catch(() => null)
            )
          );
          setGroupById((prev) => {
            const next = { ...prev };
            for (const item of resolved) {
              if (item?.id) next[item.id] = item;
            }
            return next;
          });
        }

        const unknownUserIds = Array.from(
          new Set(
            grants
              .filter((g) => g.principal_type === 'user' && g.principal_id !== '*')
              .map((g) => g.principal_id)
          )
        ).filter((pid) => !userById[pid]);

        if (unknownUserIds.length > 0) {
          const resolved = await Promise.all(
            unknownUserIds.map((pid) =>
              getWorkspaceUserInfoById(token, pid).catch(() => null)
            )
          );
          setUserById((prev) => {
            const next = { ...prev };
            for (const item of resolved) {
              if (item?.id) next[item.id] = item;
            }
            return next;
          });
        }
      } finally {
        setLoadingAccessMeta(false);
      }
    },
    [groupById, userById]
  );

  const fetchUsersForAddAccess = useCallback(
    async (queryValue: string) => {
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
          ? (
              response as {
                users: Array<{ id: string; name?: string; email?: string }>;
              }
            ).users
          : [];

        const mapped = list
          .filter((u) => typeof u?.id === 'string' && u.id.length > 0)
          .filter((u) => u.id !== currentUser?.id)
          .map((u) => ({ id: u.id, name: u.name, email: u.email }));

        setAvailableUsers(mapped);
        setUserById((prev) => {
          const next = { ...prev };
          for (const u of mapped) next[u.id] = u;
          return next;
        });
      } finally {
        setLoadingAddAccessUsers(false);
      }
    },
    [currentUser?.id]
  );

  // Debounce user search whenever the "Add Access" modal is open
  useEffect(() => {
    if (!showAddAccessModal) return;
    const t = setTimeout(() => void fetchUsersForAddAccess(addAccessQuery), 220);
    return () => clearTimeout(t);
  }, [showAddAccessModal, addAccessQuery, fetchUsersForAddAccess]);

  const openAccessModal = () => {
    const normalized = normalizeAccessGrants(skill?.access_grants ?? []);
    setDraftAccessGrants(normalized);
    setAddAccessQuery('');
    setSelectedAddGroupIds([]);
    setSelectedAddUserIds([]);
    setShowAccess(true);
    void hydrateAccessMetadata(normalized);
  };

  const commitAddAccess = () => {
    if (selectedAddGroupIds.length === 0 && selectedAddUserIds.length === 0) {
      toast.error('Select at least one user or group');
      return;
    }
    setDraftAccessGrants((prev) => {
      let next = [...prev];
      for (const gid of selectedAddGroupIds) {
        next = upsertPrincipalGrant(next, 'group', gid, 'read');
      }
      for (const uid of selectedAddUserIds) {
        next = upsertPrincipalGrant(next, 'user', uid, 'read');
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
    if (!token || !skill) return;
    setSavingAccess(true);
    try {
      await updateSkillAccess(token, skill.id, draftAccessGrants);
      setSkill((prev) =>
        prev ? { ...prev, access_grants: draftAccessGrants } : prev
      );
      toast.success('Access saved');
      setShowAccess(false);
    } catch {
      toast.error('Failed to save access');
    } finally {
      setSavingAccess(false);
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="kd-page">
        <div className="kd-loading">Loading skill...</div>
      </div>
    );
  }

  if (!skill) {
    return (
      <div className="kd-page" style={{ gap: '1rem', padding: '2rem' }}>
        <div className="kd-loading">Skill not found.</div>
        <Button variant="outline" size="sm" onClick={() => router.push('/workspace/skills')}>
          Back to Skills
        </Button>
      </div>
    );
  }

  return (
    <div className="kd-page">
      {/* Header */}
      <div className="kd-header">
        <button className="kd-back-btn" onClick={() => router.push('/workspace/skills')}>
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div className="kd-breadcrumb">
          <span
            className="kd-breadcrumb-parent"
            onClick={() => router.push('/workspace/skills')}
          >
            Skills
          </span>
          <span className="kd-breadcrumb-sep">/</span>
          <span className="kd-breadcrumb-current">{skill.name}</span>
        </div>
        <div className="ml-auto flex items-center gap-2">
          {!canWrite && <Badge variant="outline">Read Only</Badge>}
          {canWrite && canShare && (
            <button className="kd-access-btn" onClick={openAccessModal} title="Manage access">
              <Lock className="h-3.5 w-3.5" />
              <span>Access</span>
            </button>
          )}
          {canWrite && !editing && (
            <button className="kd-access-btn" onClick={() => setEditing(true)}>
              <Pencil className="h-3.5 w-3.5" />
              <span>Edit</span>
            </button>
          )}
        </div>
      </div>

      {/* Body */}
      <div className="kd-body sd-body">
        {/* Metadata panel */}
        <div className="kd-meta-card">
          <div className="kd-meta-label">Skill Details</div>
          <div className="kd-field">
            <label className="kd-field-label">Name</label>
            <Input
              className="kd-field-input"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              disabled={!editing}
              placeholder="Skill name"
            />
          </div>
          <div className="kd-field">
            <label className="kd-field-label">ID</label>
            <Input className="kd-field-input" value={skill.id} disabled />
          </div>
          <div className="kd-field">
            <label className="kd-field-label">Description</label>
            <textarea
              className="kd-field-textarea"
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              disabled={!editing}
              placeholder="What does this skill do?"
              rows={3}
            />
          </div>
          <div className="kd-meta-footer">
            <span className="kd-meta-ts">Updated {formatDate(skill.updated_at)}</span>
            {editing && (
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" disabled={saving} onClick={cancelEdit}>
                  Cancel
                </Button>
                <Button size="sm" disabled={saving} onClick={() => void handleSave()}>
                  {saving ? 'Saving…' : 'Save'}
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* Code panel */}
        {(() => {
          const isMarkdown = skill.content_type === 'markdown' ||
            skill.content?.trimStart().startsWith('---');
          return (
            <div className="sd-code-card">
              <div className="sd-code-header">
                <span className="sd-code-title">Content</span>
                <span className="sd-code-lang">
                  {isMarkdown ? 'SKILL.md' : 'Python'}
                </span>
              </div>
              <div className="sd-code-body">
                {isMarkdown ? (
                  editing ? (
                    <div className="skill-md-host overflow-y-auto h-full px-3 py-3">
                      <SkillMarkdownEditor
                        initialContent={skill.content ?? ''}
                        onChange={(assembled) => { mdContentRef.current = assembled; }}
                        onFmChange={(fm) => {
                          setForm((f) => ({ ...f, name: fm.name || f.name, description: fm.description || f.description }));
                        }}
                      />
                    </div>
                  ) : (
                    <pre className="h-full overflow-auto px-4 py-3 font-mono text-xs leading-relaxed whitespace-pre-wrap break-words">
                      {skill.content ?? ''}
                    </pre>
                  )
                ) : (
                  <CodeEditor
                    ref={codeRef}
                    language="python"
                    value={skill.content ?? ''}
                    height="100%"
                    readOnly={!editing}
                    onSave={editing ? () => void handleSave() : undefined}
                  />
                )}
              </div>
            </div>
          );
        })()}
      </div>

      {/* ── Access modal ────────────────────────────────────────────────────── */}
      <Dialog open={showAccess} onOpenChange={setShowAccess}>
        <DialogContent className="workspace-access-modal max-w-xl">
          <DialogHeader>
            <DialogTitle>Access Control</DialogTitle>
            <DialogDescription>
              Manage who can access {skill.name}.
            </DialogDescription>
          </DialogHeader>

          {/* Public / Private */}
          <div className="workspace-access-privacy">
            <div className="workspace-access-privacy__icon" aria-hidden>
              {isPublic ? <Globe className="h-4 w-4" /> : <Lock className="h-4 w-4" />}
            </div>
            <div className="workspace-access-privacy__content">
              <select
                value={isPublic ? 'public' : 'private'}
                className="workspace-access-privacy__select"
                onChange={(e) =>
                  setDraftAccessGrants((prev) =>
                    setPublicGrant(prev, e.target.value === 'public')
                  )
                }
              >
                <option value="private">Private</option>
                <option value="public">Public</option>
              </select>
              <p className="workspace-access-privacy__hint">
                {isPublic
                  ? 'Accessible to all users'
                  : 'Only selected users and groups can access'}
              </p>
            </div>
          </div>

          {/* Access list */}
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
                        <div className="workspace-access-item__name">
                          {group.name ?? group.id}
                        </div>
                        {typeof group.member_count === 'number' && (
                          <div className="workspace-access-item__meta">
                            {group.member_count} members
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="workspace-access-item__actions">
                      <button
                        type="button"
                        className={`workspace-access-badge ${
                          canWriteGroup
                            ? 'workspace-access-badge--write'
                            : 'workspace-access-badge--read'
                        }`}
                        onClick={() =>
                          setDraftAccessGrants((prev) =>
                            togglePrincipalWrite(prev, 'group', group.id)
                          )
                        }
                      >
                        {canWriteGroup ? 'WRITE' : 'READ'}
                      </button>
                      <button
                        type="button"
                        className="workspace-access-remove"
                        onClick={() =>
                          setDraftAccessGrants((prev) =>
                            removePrincipal(prev, 'group', group.id)
                          )
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
                const u = user as WorkspaceUserInfo;
                return (
                  <div key={`user-${user.id}`} className="workspace-access-item">
                    <div className="workspace-access-item__identity">
                      <div className="workspace-access-item__avatar">
                        {(u.name ?? user.id).slice(0, 2).toUpperCase()}
                      </div>
                      <div className="workspace-access-item__text">
                        <div className="workspace-access-item__name">{u.name ?? user.id}</div>
                        {u.email && (
                          <div className="workspace-access-item__meta">{u.email}</div>
                        )}
                      </div>
                    </div>
                    <div className="workspace-access-item__actions">
                      <button
                        type="button"
                        className={`workspace-access-badge ${
                          canWriteUser
                            ? 'workspace-access-badge--write'
                            : 'workspace-access-badge--read'
                        }`}
                        onClick={() =>
                          setDraftAccessGrants((prev) =>
                            togglePrincipalWrite(prev, 'user', user.id)
                          )
                        }
                      >
                        {canWriteUser ? 'WRITE' : 'READ'}
                      </button>
                      <button
                        type="button"
                        className="workspace-access-remove"
                        onClick={() =>
                          setDraftAccessGrants((prev) =>
                            removePrincipal(prev, 'user', user.id)
                          )
                        }
                        aria-label={`Remove ${u.name ?? user.id}`}
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
                <div className="workspace-access-empty">Loading access details...</div>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button
              className="workspace-access-save"
              onClick={() => void saveAccess()}
              disabled={savingAccess}
            >
              {savingAccess ? 'Saving...' : 'Save Access'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Add Access sub-modal ─────────────────────────────────────────────── */}
      <Dialog open={showAddAccessModal} onOpenChange={setShowAddAccessModal}>
        <DialogContent className="workspace-add-access-modal max-w-xl">
          <DialogHeader>
            <DialogTitle>Add Access</DialogTitle>
            <DialogDescription>
              Select users and groups to grant read access.
            </DialogDescription>
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
                      <div className="workspace-add-access-avatar">
                        {group.name.slice(0, 2).toUpperCase()}
                      </div>
                      <div className="workspace-add-access-item__text">
                        <div className="workspace-add-access-item__name">{group.name}</div>
                        {typeof group.member_count === 'number' && (
                          <div className="workspace-add-access-item__meta">
                            {group.member_count} members
                          </div>
                        )}
                      </div>
                    </div>
                    <input
                      type="checkbox"
                      className="workspace-add-access-checkbox"
                      checked={selectedAddGroupIds.includes(group.id)}
                      onChange={(e) =>
                        setSelectedAddGroupIds((prev) =>
                          e.target.checked
                            ? [...new Set([...prev, group.id])]
                            : prev.filter((gid) => gid !== group.id)
                        )
                      }
                    />
                  </label>
                ))
              )}
            </div>

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
                        <div className="workspace-add-access-item__name">
                          {user.name ?? user.id}
                        </div>
                        {user.email && (
                          <div className="workspace-add-access-item__meta">{user.email}</div>
                        )}
                      </div>
                    </div>
                    <input
                      type="checkbox"
                      className="workspace-add-access-checkbox"
                      checked={selectedAddUserIds.includes(user.id)}
                      onChange={(e) =>
                        setSelectedAddUserIds((prev) =>
                          e.target.checked
                            ? [...new Set([...prev, user.id])]
                            : prev.filter((uid) => uid !== user.id)
                        )
                      }
                    />
                  </label>
                ))
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddAccessModal(false)}>
              Cancel
            </Button>
            <Button
              className="workspace-add-access-submit"
              onClick={() => commitAddAccess()}
            >
              Add
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
