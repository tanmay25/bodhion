'use client';

import { useEffect, useMemo, useState } from 'react';
import { Globe, Lock, Plus, Search, X } from 'lucide-react';
import { toast } from 'sonner';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { AdminLoadingSplash } from '@/components/admin/AdminLoadingSplash';
import { useAuthStore } from '@/store/authStore';
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
  getWorkspaceServices,
  getWorkspaceGroupInfoById,
  getWorkspaceGroups,
  getWorkspaceUserInfoById,
  updateServiceAccess,
  type WorkspaceGroupInfo,
  type WorkspaceService,
  type WorkspaceUserInfo,
} from '@/lib/api/workspace';
import { searchUsers as searchUsersApi } from '@/lib/api/users';

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
    const key = `${grant.principal_type}:${grant.principal_id}:${grant.permission}`;
    map.set(key, grant);
  }

  return Array.from(map.values());
};

const hasPublicReadGrant = (grants: AccessGrant[]) =>
  grants.some(
    (grant) =>
      grant.principal_type === 'user' && grant.principal_id === '*' && grant.permission === 'read'
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
    {
      principal_type: 'user' as const,
      principal_id: '*',
      permission: 'read' as const,
    },
  ];
};

export default function WorkspaceServicesPage() {
  const currentUser = useAuthStore((s) => s.user);
  const [services, setServices] = useState<WorkspaceService[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');

  const [showAccessModal, setShowAccessModal] = useState(false);
  const [selectedService, setSelectedService] = useState<WorkspaceService | null>(null);
  const [draftAccessGrants, setDraftAccessGrants] = useState<AccessGrant[]>([]);
  const [groupById, setGroupById] = useState<Record<string, WorkspaceGroupInfo>>({});
  const [userById, setUserById] = useState<Record<string, WorkspaceUserInfo>>({});
  const [availableGroups, setAvailableGroups] = useState<WorkspaceGroupInfo[]>([]);
  const [availableUsers, setAvailableUsers] = useState<WorkspaceUserInfo[]>([]);
  const [showAddAccessModal, setShowAddAccessModal] = useState(false);
  const [addAccessQuery, setAddAccessQuery] = useState('');
  const [selectedAddGroupIds, setSelectedAddGroupIds] = useState<string[]>([]);
  const [selectedAddUserIds, setSelectedAddUserIds] = useState<string[]>([]);
  const [loadingAddAccessUsers, setLoadingAddAccessUsers] = useState(false);
  const [savingAccess, setSavingAccess] = useState(false);
  const [loadingAccessMeta, setLoadingAccessMeta] = useState(false);

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
      getPrincipalIdsByPermission(draftAccessGrants, 'user', 'read').filter((id) => id !== '*'),
    [draftAccessGrants]
  );
  const writeUserIds = useMemo(
    () =>
      getPrincipalIdsByPermission(draftAccessGrants, 'user', 'write').filter((id) => id !== '*'),
    [draftAccessGrants]
  );

  const accessGroups = useMemo(() => {
    const ids = Array.from(new Set([...readGroupIds, ...writeGroupIds]));
    return ids
      .map((id) => groupById[id] ?? { id, name: id })
      .sort((a, b) => (a.name ?? a.id).localeCompare(b.name ?? b.id));
  }, [groupById, readGroupIds, writeGroupIds]);

  const accessUsers = useMemo(() => {
    const ids = Array.from(new Set([...readUserIds, ...writeUserIds]));
    return ids
      .map((id) => userById[id] ?? { id, name: id })
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

  const hydrateAccessMetadata = async (grants: AccessGrant[]) => {
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
      const unknownGroupIds = groupIds.filter((id) => !groupById[id]);
      if (unknownGroupIds.length > 0) {
        const resolvedGroups = await Promise.all(
          unknownGroupIds.map(async (id) => {
            try {
              return await getWorkspaceGroupInfoById(token, id);
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
      const unknownUserIds = userIds.filter((id) => !userById[id]);
      if (unknownUserIds.length > 0) {
        const resolvedUsers = await Promise.all(
          unknownUserIds.map(async (id) => {
            try {
              return await getWorkspaceUserInfoById(token, id);
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
  };

  const fetchUsersForAddAccess = async (queryValue: string) => {
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
          if (user.id) next[user.id] = user;
        }
        return next;
      });
    } finally {
      setLoadingAddAccessUsers(false);
    }
  };

  const filteredServices = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return services;
    return services.filter((service) => {
      return (
        (service?.name ?? '').toLowerCase().includes(q) ||
        (service?.route ?? '').toLowerCase().includes(q) ||
        (service?.type ?? '').toLowerCase().includes(q) ||
        (service?.description ?? '').toLowerCase().includes(q) ||
        (service?.status ?? '').toLowerCase().includes(q)
      );
    });
  }, [services, query]);

  const loadServices = async () => {
    const token = getToken();
    if (!token) return;
    setLoading(true);
    try {
      const list = await getWorkspaceServices(token);
      setServices(list ?? []);
    } catch {
      toast.error('Failed to load services');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadServices();
  }, []);

  useEffect(() => {
    if (!showAddAccessModal) return;

    const timer = setTimeout(() => {
      void fetchUsersForAddAccess(addAccessQuery);
    }, 220);

    return () => clearTimeout(timer);
  }, [showAddAccessModal, addAccessQuery, currentUser?.id]);

  const openAccess = (service: WorkspaceService) => {
    setSelectedService(service);
    const normalized = normalizeAccessGrants(service?.access_grants ?? []);
    setDraftAccessGrants(normalized);
    setShowAddAccessModal(false);
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
    if (!selectedService) return;
    const token = getToken();
    if (!token) return;

    setSavingAccess(true);
    try {
      const updated = await updateServiceAccess(token, selectedService.id, draftAccessGrants);
      const normalized = normalizeAccessGrants(updated?.access_grants ?? draftAccessGrants);
      setServices((prev) =>
        prev.map((service) =>
          service.id === selectedService.id
            ? { ...service, access_grants: normalized }
            : service
        )
      );
      toast.success('Service access updated');
      setShowAccessModal(false);
    } catch {
      toast.error('Failed to update service access');
    } finally {
      setSavingAccess(false);
    }
  };

  return (
    <>
      <div className="workspace-services-page">
        <div className="workspace-services-toolbar">
          <div className="workspace-services-toolbar__top">
            <div className="workspace-services-title">
              <div>Services Access</div>
              <div className="workspace-services-count">{filteredServices.length}</div>
            </div>
          </div>
        </div>

        <div className="workspace-services-surface">
          <div className="workspace-services-searchbar">
            <div className="flex flex-1 items-center">
              <div className="workspace-services-search-icon">
                <Search className="h-3.5 w-3.5" />
              </div>
              <Input
                className="workspace-services-search-input"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                aria-label="Search Services"
                placeholder="Search Services"
                maxLength={500}
              />
              {query && (
                <div className="self-center rounded-l-xl bg-transparent pl-1.5">
                  <button
                    className="workspace-services-clear"
                    aria-label="Clear search"
                    onClick={() => setQuery('')}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              )}
            </div>
          </div>

          {loading ? (
            <AdminLoadingSplash
              title="Loading Services…"
              subtitle="Fetching service configuration"
            />
          ) : filteredServices.length === 0 ? (
            <div className="workspace-services-empty">No services available</div>
          ) : (
            <div className="workspace-services-grid">
              {filteredServices.map((service) => (
                <div key={service.id} className="workspace-services-card">
                  <div className="workspace-services-card__body">
                    <div className="workspace-services-card__header">
                      <div className="workspace-services-card__name">{service.name}</div>
                      <div className="workspace-services-card__status uppercase">
                        {service.status ?? 'active'}
                      </div>
                    </div>
                    <div className="workspace-services-card__meta">
                      <span>{service.route}</span>
                      <span className="uppercase">{service.type ?? 'service'}</span>
                    </div>
                    <p>{service.description ?? 'No description available.'}</p>
                  </div>
                  <div className="workspace-services-card__actions">
                    <button
                      className="workspace-services-button workspace-services-button--primary"
                      onClick={() => openAccess(service)}
                    >
                      Manage Access
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <Dialog open={showAccessModal} onOpenChange={setShowAccessModal}>
        <DialogContent className="workspace-access-modal max-w-xl">
          <DialogHeader>
            <DialogTitle>Access Control</DialogTitle>
            <DialogDescription>Manage who can access {selectedService?.name ?? 'this service'}.</DialogDescription>
          </DialogHeader>

          <div className="workspace-access-privacy">
            <div className="workspace-access-privacy__icon" aria-hidden>
              {isPublic ? <Globe className="h-4 w-4" /> : <Lock className="h-4 w-4" />}
            </div>
            <div className="workspace-access-privacy__content">
              <select
                value={isPublic ? 'public' : 'private'}
                className="workspace-access-privacy__select"
                onChange={(e) => {
                  setDraftAccessGrants((prev) => setPublic(prev, e.target.value === 'public'));
                }}
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
                const canWrite = writeGroupIds.includes(group.id);
                return (
                  <div key={`group-${group.id}`} className="workspace-access-item">
                    <div className="workspace-access-item__identity">
                      <div className="workspace-access-item__avatar">
                        {(group.name ?? group.id).slice(0, 2).toUpperCase()}
                      </div>
                      <div className="workspace-access-item__text">
                        <div className="workspace-access-item__name">{group.name ?? group.id}</div>
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
                        className={`workspace-access-badge ${canWrite ? 'workspace-access-badge--write' : 'workspace-access-badge--read'}`}
                        onClick={() =>
                          setDraftAccessGrants((prev) => togglePrincipalWrite(prev, 'group', group.id))
                        }
                      >
                        {canWrite ? 'WRITE' : 'READ'}
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
                const canWrite = writeUserIds.includes(user.id);
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
                        className={`workspace-access-badge ${canWrite ? 'workspace-access-badge--write' : 'workspace-access-badge--read'}`}
                        onClick={() =>
                          setDraftAccessGrants((prev) => togglePrincipalWrite(prev, 'user', user.id))
                        }
                      >
                        {canWrite ? 'WRITE' : 'READ'}
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
                            : prev.filter((id) => id !== group.id)
                        )
                      }
                    />
                  </label>
                ))
              )}
            </div>

            <div className="workspace-add-access-section">
              <div className="workspace-add-access-section__title">Users</div>
              {filteredAddUsers.length === 0 ? (
                <div className="workspace-add-access-empty">
                  {loadingAddAccessUsers ? 'Loading users...' : 'No users found.'}
                </div>
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
                      onChange={(e) =>
                        setSelectedAddUserIds((prev) =>
                          e.target.checked
                            ? [...new Set([...prev, user.id])]
                            : prev.filter((id) => id !== user.id)
                        )
                      }
                    />
                  </label>
                ))
              )}
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowAddAccessModal(false);
                setAddAccessQuery('');
                setSelectedAddGroupIds([]);
                setSelectedAddUserIds([]);
              }}
            >
              Cancel
            </Button>
            <Button className="workspace-add-access-submit" onClick={() => commitAddAccess()}>
              Add
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
