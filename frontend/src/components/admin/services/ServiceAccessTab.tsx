'use client';

import { useState, useMemo, useEffect, useRef } from 'react';
import { X, Plus, Globe, User, Users, ChevronDown, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import type { AccessGrant } from '@/lib/api/admin/services';

export type GrantDraft = Pick<AccessGrant, 'principal_type' | 'principal_id' | 'permission'>;

export interface PrincipalOption {
  id: string;
  label: string;
  sub?: string;
}

interface ServiceAccessTabProps {
  grants: GrantDraft[];
  onChange: (grants: GrantDraft[]) => void;
  /** Static user list — used when onSearchUsers is not provided */
  users?: PrincipalOption[];
  /** Static group list for combobox selection */
  groups?: PrincipalOption[];
  /** Async user search (takes priority over static users) */
  onSearchUsers?: (query: string) => Promise<PrincipalOption[]>;
  /** Show spinner while groups/options are loading */
  loadingOptions?: boolean;
  /** View-only mode — hides all editing controls */
  readOnly?: boolean;
}

function grantLabel(g: GrantDraft, users?: PrincipalOption[], groups?: PrincipalOption[]) {
  if (g.principal_type === 'user' && g.principal_id === '*') return 'Everyone (public)';
  if (g.principal_type === 'user' && users) {
    const found = users.find((u) => u.id === g.principal_id);
    if (found) return found.label;
  }
  if (g.principal_type === 'group' && groups) {
    const found = groups.find((gr) => gr.id === g.principal_id);
    if (found) return found.label;
  }
  return g.principal_id;
}

export function ServiceAccessTab({
  grants,
  onChange,
  users,
  groups,
  onSearchUsers,
  loadingOptions = false,
  readOnly = false,
}: ServiceAccessTabProps) {
  const [principalType, setPrincipalType] = useState<'user' | 'group'>('user');
  const [principalId, setPrincipalId]     = useState('');
  const [searchQuery, setSearchQuery]     = useState('');
  const [dropdownOpen, setDropdownOpen]   = useState(false);
  const [permission, setPermission]       = useState<'read' | 'write'>('read');
  const [addError, setAddError]           = useState<string | null>(null);

  // Async search state
  const [searchResults, setSearchResults]   = useState<PrincipalOption[]>([]);
  const [isSearching, setIsSearching]       = useState(false);
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const useAsyncSearch = principalType === 'user' && !!onSearchUsers;
  const hasStaticOptions = principalType === 'user' ? !!users : !!groups;
  const hasCombobox = useAsyncSearch || hasStaticOptions;

  // Debounced async user search
  useEffect(() => {
    if (!useAsyncSearch) return;
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    const q = searchQuery.trim();
    if (!q) { setSearchResults([]); return; }
    searchDebounceRef.current = setTimeout(async () => {
      setIsSearching(true);
      try {
        const results = await onSearchUsers(q);
        setSearchResults(results);
      } finally {
        setIsSearching(false);
      }
    }, 300);
    return () => { if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery, useAsyncSearch]);

  // Static filtered options (for groups or when static users list provided)
  const staticOptions = useMemo<PrincipalOption[]>(() => {
    const pool = principalType === 'user' ? (users ?? []) : (groups ?? []);
    const q = searchQuery.trim().toLowerCase();
    const filtered = q
      ? pool.filter(
          (o) =>
            o.label.toLowerCase().includes(q) ||
            (o.sub && o.sub.toLowerCase().includes(q)) ||
            o.id.toLowerCase().includes(q)
        )
      : pool;
    return filtered.slice(0, 12);
  }, [principalType, users, groups, searchQuery]);

  const displayOptions = useAsyncSearch ? searchResults : staticOptions;

  const switchType = (t: 'user' | 'group') => {
    setPrincipalType(t);
    setPrincipalId('');
    setSearchQuery('');
    setDropdownOpen(false);
    setAddError(null);
    setSearchResults([]);
  };

  const selectOption = (opt: PrincipalOption) => {
    setPrincipalId(opt.id);
    setSearchQuery(opt.label);
    setDropdownOpen(false);
    setAddError(null);
  };

  const handleAdd = () => {
    const id = hasCombobox ? principalId.trim() : searchQuery.trim();
    if (!id) {
      setAddError(hasCombobox ? `Select a ${principalType} from the list.` : 'Principal ID cannot be empty.');
      return;
    }
    const isDupe = grants.some(
      (g) => g.principal_type === principalType && g.principal_id === id && g.permission === permission
    );
    if (isDupe) { setAddError('This grant already exists.'); return; }
    setAddError(null);
    onChange([...grants, { principal_type: principalType, principal_id: id, permission }]);
    setPrincipalId('');
    setSearchQuery('');
    setSearchResults([]);
  };

  const handleRemove = (idx: number) => onChange(grants.filter((_, i) => i !== idx));

  const setPublicRead = () => {
    const hasPublic = grants.some(
      (g) => g.principal_type === 'user' && g.principal_id === '*' && g.permission === 'read'
    );
    if (!hasPublic) onChange([...grants, { principal_type: 'user', principal_id: '*', permission: 'read' }]);
  };

  return (
    <div className="svc-access-tab flex flex-col gap-4">

      {/* ── Current grants ── */}
      <div className="flex flex-col gap-2">
        <span className="svc-access-section-label">Current Access Grants</span>

        {grants.length === 0 ? (
          <div className="svc-access-empty">
            No grants — only the owner and admins can access this skill.
          </div>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {grants.map((g, i) => (
              <div
                key={i}
                className={cn('svc-grant-chip', g.permission === 'write' && 'svc-grant-chip--write')}
              >
                {g.principal_type === 'user' && g.principal_id === '*' ? (
                  <Globe style={{ width: '0.72rem', height: '0.72rem' }} />
                ) : g.principal_type === 'user' ? (
                  <User style={{ width: '0.72rem', height: '0.72rem' }} />
                ) : (
                  <Users style={{ width: '0.72rem', height: '0.72rem' }} />
                )}
                <span className="svc-grant-chip-label">{grantLabel(g, users, groups)}</span>
                <span className="svc-grant-chip-perm">{g.permission}</span>
                {!readOnly && (
                  <button
                    type="button"
                    className="svc-grant-chip-remove"
                    onClick={() => handleRemove(i)}
                    title="Remove grant"
                  >
                    <X style={{ width: '0.65rem', height: '0.65rem' }} />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Editing controls (hidden in readOnly mode) ── */}
      {!readOnly && (
        <>
          <button type="button" className="svc-public-btn" onClick={setPublicRead}>
            <Globe style={{ width: '0.85rem', height: '0.85rem' }} />
            Make publicly accessible (everyone read)
          </button>

          <div className="svc-access-section">
            <span className="svc-access-section-label">Add Grant</span>

            <div className="flex flex-col gap-2">
              {/* Type toggle */}
              <div className="flex gap-1.5">
                {(['user', 'group'] as const).map((pt) => (
                  <button
                    key={pt}
                    type="button"
                    className={cn('svc-type-pill', principalType === pt && 'svc-type-pill--active')}
                    onClick={() => switchType(pt)}
                  >
                    {pt === 'user'
                      ? <User style={{ width: '0.75rem', height: '0.75rem' }} />
                      : <Users style={{ width: '0.75rem', height: '0.75rem' }} />}
                    {pt.charAt(0).toUpperCase() + pt.slice(1)}
                  </button>
                ))}
              </div>

              {/* Principal selector */}
              {hasCombobox ? (
                <div style={{ position: 'relative' }}>
                  <div style={{ position: 'relative' }}>
                    <input
                      className="svc-access-input"
                      style={{ paddingRight: '2rem' }}
                      value={searchQuery}
                      placeholder={
                        loadingOptions
                          ? 'Loading…'
                          : principalType === 'user'
                            ? 'Search by name or email…'
                            : 'Search groups by name…'
                      }
                      disabled={loadingOptions}
                      onChange={(e) => {
                        setSearchQuery(e.target.value);
                        setPrincipalId('');
                        setDropdownOpen(true);
                        setAddError(null);
                      }}
                      onFocus={() => setDropdownOpen(true)}
                      onBlur={() => setTimeout(() => setDropdownOpen(false), 150)}
                      onKeyDown={(e) => {
                        if (e.key === 'Escape') setDropdownOpen(false);
                        if (e.key === 'Enter') { e.preventDefault(); handleAdd(); }
                      }}
                    />
                    <span style={{
                      position: 'absolute', right: '0.6rem', top: '50%',
                      transform: 'translateY(-50%)', pointerEvents: 'none',
                      display: 'flex', alignItems: 'center',
                    }}>
                      {isSearching
                        ? <Loader2 style={{ width: '0.8rem', height: '0.8rem', color: 'var(--bodhion-text-secondary)', animation: 'spin 1s linear infinite' }} />
                        : <ChevronDown style={{ width: '0.85rem', height: '0.85rem', color: 'var(--bodhion-text-secondary)' }} />
                      }
                    </span>
                  </div>

                  {dropdownOpen && displayOptions.length > 0 && (
                    <div className="svc-dropdown">
                      {displayOptions.map((opt) => (
                        <button
                          key={opt.id}
                          type="button"
                          className={cn('svc-dropdown-item', principalId === opt.id && 'svc-dropdown-item--selected')}
                          onMouseDown={(e) => { e.preventDefault(); selectOption(opt); }}
                        >
                          <span className="svc-dropdown-label">{opt.label}</span>
                          {opt.sub && <span className="svc-dropdown-sub">{opt.sub}</span>}
                        </button>
                      ))}
                    </div>
                  )}

                  {dropdownOpen && !isSearching && displayOptions.length === 0 && searchQuery.trim() && (
                    <div className="svc-dropdown">
                      <div className="svc-dropdown-empty">No results for &quot;{searchQuery}&quot;</div>
                    </div>
                  )}
                </div>
              ) : (
                <input
                  className="svc-access-input"
                  value={searchQuery}
                  placeholder={principalType === 'user' ? 'User ID (or * for public)' : 'Group ID'}
                  onChange={(e) => { setSearchQuery(e.target.value); setPrincipalId(''); setAddError(null); }}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAdd(); } }}
                />
              )}

              {/* Permission toggle */}
              <div className="flex gap-1.5">
                {(['read', 'write'] as const).map((p) => (
                  <button
                    key={p}
                    type="button"
                    className={cn('svc-type-pill', permission === p && 'svc-type-pill--active')}
                    onClick={() => setPermission(p)}
                  >
                    {p.charAt(0).toUpperCase() + p.slice(1)}
                  </button>
                ))}
              </div>

              <button type="button" className="svc-add-grant-btn" onClick={handleAdd}>
                <Plus style={{ width: '0.85rem', height: '0.85rem' }} />
                Add Grant
              </button>

              {addError && <p className="svc-access-error">{addError}</p>}
            </div>
          </div>
        </>
      )}

      <div className="svc-access-note">
        <strong>Admin</strong> users always have full access regardless of grants.
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        .svc-access-tab { color: var(--bodhion-text-primary); }

        .svc-access-section-label {
          font-size: 0.78rem; font-weight: 600; letter-spacing: 0.04em;
          color: var(--bodhion-text-secondary); text-transform: uppercase;
        }
        .svc-access-empty {
          font-size: 0.82rem; color: var(--bodhion-text-secondary);
          padding: 0.75rem 1rem; border-radius: 0.85rem;
          border: 1px dashed var(--bodhion-card-border);
        }
        .svc-grant-chip {
          display: inline-flex; align-items: center; gap: 0.35rem;
          padding: 0.25rem 0.6rem; border-radius: 999px;
          border: 1px solid rgba(37,215,255,0.25); background: rgba(37,215,255,0.07);
          color: var(--bodhion-text-primary); font-size: 0.74rem;
        }
        .svc-grant-chip--write { border-color: rgba(251,191,36,0.3); background: rgba(251,191,36,0.07); }
        .svc-grant-chip-label {
          font-weight: 500; max-width: 14rem;
          overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
        }
        .svc-grant-chip-perm {
          font-size: 0.64rem; font-weight: 700; letter-spacing: 0.05em;
          text-transform: uppercase; opacity: 0.7;
        }
        .svc-grant-chip-remove {
          background: none; border: none; cursor: pointer;
          color: var(--bodhion-text-secondary); display: flex; align-items: center;
          padding: 0; transition: color 0.15s;
        }
        .svc-grant-chip-remove:hover { color: #f87171; }

        .svc-public-btn {
          display: inline-flex; align-items: center; gap: 0.4rem;
          padding: 0.4rem 0.85rem; border-radius: 0.75rem;
          border: 1px solid rgba(37,215,255,0.25); background: rgba(37,215,255,0.06);
          color: var(--bodhion-accent); font-size: 0.8rem; font-weight: 500;
          cursor: pointer; align-self: flex-start; transition: background 0.15s;
        }
        .svc-public-btn:hover { background: rgba(37,215,255,0.12); }

        .svc-access-section {
          display: flex; flex-direction: column; gap: 0.65rem;
          padding: 0.85rem 1rem; border-radius: 1rem;
          border: 1px solid var(--bodhion-card-border); background: var(--bodhion-card-bg);
        }
        .svc-type-pill {
          display: inline-flex; align-items: center; gap: 0.3rem;
          padding: 0.3rem 0.75rem; border-radius: 999px;
          border: 1px solid var(--bodhion-shell-border); background: transparent;
          color: var(--bodhion-text-secondary); font-size: 0.78rem; font-weight: 500;
          cursor: pointer; transition: border-color 0.15s, color 0.15s, background 0.15s;
        }
        .svc-type-pill--active {
          border-color: var(--bodhion-accent); background: rgba(37,215,255,0.1); color: var(--bodhion-accent);
        }
        .svc-access-input {
          width: 100%; padding: 0.45rem 0.75rem; border-radius: 0.75rem;
          border: 1px solid var(--bodhion-search-border); background: var(--bodhion-search-bg);
          color: var(--bodhion-text-primary); font-size: 0.84rem; outline: none;
          transition: border-color 0.15s;
        }
        .svc-access-input:focus { border-color: var(--bodhion-accent); box-shadow: 0 0 0 2px rgba(37,215,255,0.12); }
        .svc-access-input::placeholder { color: var(--bodhion-text-secondary); opacity: 0.55; }
        .svc-access-input:disabled { opacity: 0.45; cursor: not-allowed; }

        .svc-dropdown {
          position: absolute; top: calc(100% + 4px); left: 0; right: 0; z-index: 9999;
          border-radius: 0.85rem; border: 1px solid var(--bodhion-card-border);
          background: var(--bodhion-shell-bg, #0d1f2d);
          box-shadow: 0 8px 24px rgba(0,0,0,0.35);
          max-height: 220px; overflow-y: auto; padding: 0.3rem;
        }
        .svc-dropdown-item {
          display: flex; align-items: center; justify-content: space-between; gap: 0.5rem;
          width: 100%; padding: 0.45rem 0.65rem; border-radius: 0.6rem; border: none;
          background: transparent; color: var(--bodhion-text-primary);
          font-size: 0.82rem; text-align: left; cursor: pointer; transition: background 0.1s;
        }
        .svc-dropdown-item:hover, .svc-dropdown-item--selected { background: rgba(37,215,255,0.09); }
        .svc-dropdown-label { font-weight: 500; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; flex: 1; }
        .svc-dropdown-sub { font-size: 0.74rem; color: var(--bodhion-text-secondary); white-space: nowrap; flex-shrink: 0; }
        .svc-dropdown-empty { padding: 0.6rem 0.65rem; font-size: 0.8rem; color: var(--bodhion-text-secondary); }

        .svc-add-grant-btn {
          display: inline-flex; align-items: center; gap: 0.35rem;
          padding: 0.4rem 0.9rem; border-radius: 0.75rem; border: none;
          background: var(--bodhion-primary-button); box-shadow: var(--bodhion-primary-button-shadow);
          color: #fff; font-size: 0.8rem; font-weight: 600;
          cursor: pointer; align-self: flex-start; transition: opacity 0.15s;
        }
        .svc-add-grant-btn:hover { opacity: 0.88; }

        .svc-access-error { font-size: 0.72rem; color: #f87171; margin: 0; }

        .svc-access-note {
          font-size: 0.76rem; color: var(--bodhion-text-secondary); line-height: 1.55;
          padding: 0.65rem 0.9rem; border-radius: 0.85rem;
          border: 1px solid var(--bodhion-card-border); background: rgba(255,255,255,0.02);
        }
      `}</style>
    </div>
  );
}
