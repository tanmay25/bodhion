'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Download,
  Ellipsis,
  Globe,
  Pencil,
  Plus,
  Search,
  Sparkles,
  Trash2,
  X,
  CopyPlus,
} from 'lucide-react';
import { toast } from 'sonner';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { AdminLoadingSplash } from '@/components/admin/AdminLoadingSplash';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/Modal';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/Dropdown';
import { CodeEditor } from '@/components/shared/CodeEditor';
import type { CodeEditorHandle } from '@/components/shared/CodeEditor';
import { getToken } from '@/lib/auth/session';
import {
  getSkillList,
  createSkill,
  updateSkill,
  deleteSkill,
  toggleSkillById,
  updateSkillAccess,
  getWorkspaceGroups,
} from '@/lib/api/workspace';
import type { AccessGrant } from '@/lib/api/workspace';
import { searchUsers as searchUsersApi } from '@/lib/api/users';
import { ServiceAccessTab } from '@/components/admin/services/ServiceAccessTab';
import type { GrantDraft, PrincipalOption } from '@/components/admin/services/ServiceAccessTab';
import type { Skill } from '@/types/api';
import { useAuthStore } from '@/store/authStore';
import { SkillHubBrowser } from '@/components/workspace/skills/SkillHubBrowser';
import { SkillMarkdownEditor } from '@/components/workspace/skills/SkillMarkdownEditor';

const PAGE_SIZE = 30;

const SKILL_TEMPLATE = `"""
Skill: <name>
Description: <what this skill does>
"""

class Skills:
    def skill_function(self, input: str) -> str:
        """
        Implement your skill logic here.
        """
        return input
`;

const slugify = (s: string) =>
  s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

const capitalize = (v?: string) => (v ? v.charAt(0).toUpperCase() + v.slice(1) : '');

const formatDate = (epoch: number) =>
  new Date(epoch * 1000).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

type SkillItem = Skill & { write_access?: boolean };

interface SkillFormState {
  id: string;
  name: string;
  description: string;
}

export default function SkillsPage() {
  const user = useAuthStore((s) => s.user);
  const router = useRouter();

  const [loaded, setLoaded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<SkillItem[]>([]);
  const [total, setTotal] = useState(0);
  const [query, setQuery] = useState('');
  const [viewOption, setViewOption] = useState('');
  const [page, setPage] = useState(1);

  // editor modal
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingSkill, setEditingSkill] = useState<SkillItem | null>(null);
  const [form, setForm] = useState<SkillFormState>({ id: '', name: '', description: '' });
  const [idTouched, setIdTouched] = useState(false);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<'details' | 'access'>('details');
  const [accessGrants, setAccessGrants] = useState<GrantDraft[]>([]);
  const [groupsForAccess, setGroupsForAccess] = useState<PrincipalOption[]>([]);
  const [groupsLoaded, setGroupsLoaded] = useState(false);
  const [accessOptionsLoading, setAccessOptionsLoading] = useState(false);
  const codeRef = useRef<CodeEditorHandle>(null);

  // content type toggle: 'python' | 'markdown'
  const [contentType, setContentType] = useState<'python' | 'markdown'>('python');
  // assembled SKILL.md content from SkillMarkdownEditor
  const mdContentRef = useRef<string>('');
  // name + description surfaced from SkillMarkdownEditor frontmatter
  const mdFmRef = useRef<{ name: string; description: string }>({ name: '', description: '' });

  // page-level view: my skills list vs hub browser
  const [pageView, setPageView] = useState<'mine' | 'hub'>('mine');

  // delete confirm
  const [deleteTarget, setDeleteTarget] = useState<SkillItem | null>(null);
  const [deleting, setDeleting] = useState(false);

  const pageCount = useMemo(() => Math.max(1, Math.ceil(total / PAGE_SIZE)), [total]);

  const canCreate =
    user?.role === 'admin' ||
    Boolean((user?.permissions?.workspace as Record<string, boolean> | undefined)?.skills);

  useEffect(() => {
    setViewOption(localStorage.getItem('workspaceViewOption') ?? '');
    setLoaded(true);
  }, []);

  const loadSkills = async () => {
    const token = getToken();
    if (!token) return;
    setLoading(true);
    try {
      const result = await getSkillList(token, {
        query: query || undefined,
        viewOption: viewOption || undefined,
        page,
      });
      setItems((result?.items ?? []) as SkillItem[]);
      setTotal(result?.total ?? 0);
    } catch {
      toast.error('Failed to load skills');
    } finally {
      setLoading(false);
    }
  };

  // debounce query changes
  useEffect(() => {
    if (!loaded) return;
    const t = window.setTimeout(() => {
      setPage(1);
      void loadSkills();
    }, 300);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  useEffect(() => {
    if (!loaded) return;
    setPage(1);
    void loadSkills();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewOption, loaded]);

  useEffect(() => {
    if (!loaded) return;
    void loadSkills();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  // Lazy-load groups the first time the Access tab is opened per dialog session
  useEffect(() => {
    if (!editorOpen || activeTab !== 'access' || groupsLoaded) return;
    const token = getToken();
    if (!token) return;
    setAccessOptionsLoading(true);
    getWorkspaceGroups(token)
      .then((groupList) => {
        setGroupsForAccess(
          (groupList ?? []).map((g) => ({
            id: g.id,
            label: g.name,
            sub: g.member_count != null ? `${g.member_count} members` : undefined,
          }))
        );
        setGroupsLoaded(true);
      })
      .catch(() => toast.error('Failed to load groups'))
      .finally(() => setAccessOptionsLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editorOpen, activeTab]);

  // Async user search — called by ServiceAccessTab on every keystroke
  const searchUsersForAccess = useCallback(async (q: string): Promise<PrincipalOption[]> => {
    const token = getToken();
    if (!token || !q.trim()) return [];
    try {
      const result = await searchUsersApi(token, { query: q });
      return (result?.users ?? []).map((u) => ({
        id: u.id,
        label: u.name || u.email,
        sub: u.email,
      }));
    } catch {
      return [];
    }
  }, []);

  // ── Editor helpers ──────────────────────────────────────────────────────────

  const openCreate = () => {
    setEditingSkill(null);
    setForm({ id: '', name: '', description: '' });
    setIdTouched(false);
    setAccessGrants([]);
    setActiveTab('details');
    setContentType('python');
    mdContentRef.current = '';
    mdFmRef.current = { name: '', description: '' };
    setGroupsLoaded(false);
    setEditorOpen(true);
  };

  const openEdit = (skill: SkillItem) => {
    setEditingSkill(skill);
    setForm({ id: skill.id, name: skill.name, description: skill.description ?? '' });
    setIdTouched(true);
    setAccessGrants(
      (skill.access_grants ?? []).map((g) => ({
        principal_type: g.principal_type,
        principal_id: g.principal_id,
        permission: g.permission,
      }))
    );
    setActiveTab('details');
    // Fallback: sniff content if content_type is missing (e.g. pre-migration skills)
    const detectedType =
      skill.content_type ??
      (skill.content?.trimStart().startsWith('---') ? 'markdown' : 'python');
    const ct = detectedType as 'python' | 'markdown';
    setContentType(ct);
    mdContentRef.current = ct === 'markdown' ? (skill.content ?? '') : '';
    mdFmRef.current = { name: skill.name, description: skill.description ?? '' };
    setGroupsLoaded(false);
    setEditorOpen(true);
  };

  const closeEditor = () => {
    setEditorOpen(false);
    setEditingSkill(null);
    setActiveTab('details');
  };

  const handleNameChange = (name: string) => {
    setForm((f) => ({
      ...f,
      name,
      id: idTouched ? f.id : slugify(name),
    }));
  };

  const handleSave = async () => {
    const token = getToken();
    if (!token) return;

    // Pick content from the active editor
    const content =
      contentType === 'markdown'
        ? mdContentRef.current
        : (codeRef.current?.getValue() ?? '');

    // In markdown mode, name/id/description come from SkillMarkdownEditor frontmatter
    const skillName   = contentType === 'markdown' ? mdFmRef.current.name        : form.name;
    const skillDesc   = contentType === 'markdown' ? mdFmRef.current.description  : form.description;
    const skillId     = contentType === 'markdown'
      ? skillName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
      : form.id;

    if (!skillName.trim()) {
      toast.error('Name is required');
      return;
    }
    if (!skillId.trim()) {
      toast.error('ID is required');
      return;
    }
    if (contentType === 'markdown' && !content.trim()) {
      toast.error('Skill content cannot be empty');
      return;
    }

    setSaving(true);
    try {
      if (editingSkill) {
        await updateSkill(token, editingSkill.id, {
          name: skillName,
          description: skillDesc || undefined,
          content,
          content_type: contentType,
        } as Partial<Skill>);
        await updateSkillAccess(token, editingSkill.id, accessGrants as AccessGrant[]);
        toast.success('Skill updated');
      } else {
        const created = await createSkill(token, {
          id: skillId,
          name: skillName,
          description: skillDesc || undefined,
          content,
          content_type: contentType,
        } as Partial<Skill>);
        if (created && accessGrants.length > 0) {
          await updateSkillAccess(token, created.id, accessGrants as AccessGrant[]);
        }
        toast.success('Skill created');
      }
      closeEditor();
      setPage(1);
      await loadSkills();
    } catch (err: unknown) {
      const raw = (err as { detail?: unknown })?.detail;
      const errorMsg = Array.isArray(raw)
        ? (raw as Array<{ msg?: string }>).map((e) => e.msg ?? String(e)).join('; ')
        : typeof raw === 'string'
          ? raw
          : editingSkill ? 'Failed to update skill' : 'Failed to create skill';
      toast.error(errorMsg);
    } finally {
      setSaving(false);
    }
  };

  // ── Actions ─────────────────────────────────────────────────────────────────

  const handleToggle = async (skill: SkillItem) => {
    const token = getToken();
    if (!token) return;
    try {
      await toggleSkillById(token, skill.id);
      await loadSkills();
    } catch {
      toast.error('Failed to update skill status');
    }
  };

  const handleClone = async (skill: SkillItem) => {
    const token = getToken();
    if (!token) return;
    const cloneId = `${skill.id}-clone-${Date.now().toString().slice(-5)}`;
    try {
      await createSkill(token, {
        id: cloneId,
        name: `${skill.name} (Clone)`,
        description: skill.description,
        content: skill.content ?? '',
      });
      toast.success('Skill cloned');
      setPage(1);
      await loadSkills();
    } catch {
      toast.error('Failed to clone skill');
    }
  };

  const handleExport = (skill: SkillItem) => {
    const blob = new Blob([JSON.stringify(skill, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `skill-${skill.id}-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const confirmDelete = (skill: SkillItem) => setDeleteTarget(skill);

  const handleDelete = async () => {
    const token = getToken();
    if (!token || !deleteTarget) return;
    setDeleting(true);
    try {
      await deleteSkill(token, deleteTarget.id);
      toast.success(`Deleted "${deleteTarget.name}"`);
      setDeleteTarget(null);
      setPage(1);
      await loadSkills();
    } catch {
      toast.error('Failed to delete skill');
    } finally {
      setDeleting(false);
    }
  };

  // ── Render ──────────────────────────────────────────────────────────────────

  if (!loaded) return <AdminLoadingSplash title="Loading Skills…" subtitle="Fetching workspace skills" />;

  return (
    <div className="workspace-skills-page">

      {/* ── Toolbar ── */}
      <div className="workspace-prompts-toolbar">
        <div className="workspace-prompts-toolbar__top">
          <div className="workspace-prompts-title">
            <div>Skills</div>
            {pageView === 'mine' && <div className="workspace-prompts-count">{total}</div>}
          </div>
          <div className="workspace-prompts-actions">
            {pageView === 'mine' && canCreate && (
              <Button
                type="button"
                className="workspace-prompts-button workspace-prompts-button--primary"
                onClick={openCreate}
              >
                <Plus className="h-3.5 w-3.5" />
                New Skill
              </Button>
            )}
          </div>
        </div>

        {/* Page-level tab bar */}
        <div className="flex gap-1 border-b border-[var(--bodhion-border)] mt-2">
          <button
            type="button"
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors -mb-px ${
              pageView === 'mine'
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
            onClick={() => setPageView('mine')}
          >
            My Skills
          </button>
          <button
            type="button"
            className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium border-b-2 transition-colors -mb-px ${
              pageView === 'hub'
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
            onClick={() => setPageView('hub')}
          >
            <Globe className="h-3.5 w-3.5" />
            Browse Hub
          </button>
        </div>
      </div>

      {/* ── Hub browser ── */}
      {pageView === 'hub' && (
        <div className="workspace-prompts-surface">
          <SkillHubBrowser
            installedSkills={items}
            onInstalled={(newSkill) => {
              setItems((prev) => [newSkill as SkillItem, ...prev]);
              setTotal((t) => t + 1);
              setPageView('mine');
            }}
          />
        </div>
      )}

      {/* ── List surface ── */}
      {pageView === 'mine' && <div className="workspace-prompts-surface">

        {/* Search bar */}
        <div className="workspace-prompts-searchbar">
          <div className="workspace-prompts-search-icon">
            <Search className="h-3.5 w-3.5" />
          </div>
          <Input
            className="workspace-prompts-search-input"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search Skills"
            aria-label="Search Skills"
            maxLength={500}
          />
          {query && (
            <div className="self-center rounded-l-xl bg-transparent pl-1.5">
              <button
                className="workspace-prompts-clear"
                aria-label="Clear search"
                onClick={() => setQuery('')}
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          )}
        </div>

        {/* Filters */}
        <div className="workspace-prompts-filters">
          <div className="workspace-prompts-filters__inner">
            <select
              value={viewOption}
              onChange={(e) => {
                localStorage.setItem('workspaceViewOption', e.target.value);
                setViewOption(e.target.value);
              }}
              className="workspace-models-filter-select"
            >
              <option value="">All</option>
              <option value="created">Created by you</option>
              <option value="shared">Shared with you</option>
            </select>
          </div>
        </div>

        {/* Content */}
        {loading ? (
          <AdminLoadingSplash title="Loading Skills…" subtitle="Fetching workspace skills" />
        ) : items.length === 0 ? (
          <div className="workspace-skills-empty">
            <Sparkles className="workspace-skills-empty__icon" />
            <div className="workspace-skills-empty__title">No skills found</div>
            <div className="workspace-skills-empty__sub">
              {canCreate
                ? 'Create a skill to extend workspace capabilities.'
                : 'No skills are available to you yet.'}
            </div>
          </div>
        ) : (
          <div className="workspace-prompts-grid">
            {items.map((skill) => (
              <div key={skill.id} className="workspace-prompts-card">
                <button
                  type="button"
                  className="min-w-0 flex-1 pl-1 text-left"
                  onClick={() => router.push(`/workspace/skills/${skill.id}`)}
                >
                  <div className="mb-0.5 flex items-center gap-2">
                    <div className="line-clamp-1 font-medium">{skill.name}</div>
                    <div className="workspace-skills-id line-clamp-1">{skill.id}</div>
                    {skill.content_type === 'markdown' && (
                      <Badge variant="outline" className="text-xs shrink-0">SKILL.md</Badge>
                    )}
                    {skill.write_access === false && <Badge variant="outline">Read Only</Badge>}
                  </div>
                  <div className="flex gap-1 text-xs text-[var(--bodhion-text-secondary)]">
                    {skill.description ? (
                      <div className="line-clamp-1">{skill.description}</div>
                    ) : (
                      <div className="italic opacity-50">No description</div>
                    )}
                    <div>·</div>
                    <div className="shrink-0">
                      {capitalize(skill.user?.name ?? skill.user?.email ?? 'Unknown')}
                    </div>
                    <div>·</div>
                    <div className="shrink-0">{formatDate(skill.updated_at)}</div>
                  </div>
                </button>

                <div className="flex flex-row gap-1 self-center">
                  {skill.write_access !== false && (
                    <button
                      className="workspace-prompts-icon-btn workspace-prompts-icon-btn--danger"
                      type="button"
                      aria-label="Delete skill"
                      onClick={() => confirmDelete(skill)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}

                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button
                        className="workspace-prompts-icon-btn"
                        type="button"
                        aria-label="More options"
                      >
                        <Ellipsis className="h-4 w-4" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-[160px]">
                      {skill.write_access !== false && (
                        <DropdownMenuItem onClick={() => openEdit(skill)}>
                          <Pencil className="mr-2 h-4 w-4" />
                          Edit
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuItem onClick={() => void handleClone(skill)}>
                        <CopyPlus className="mr-2 h-4 w-4" />
                        Clone
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleExport(skill)}>
                        <Download className="mr-2 h-4 w-4" />
                        Export
                      </DropdownMenuItem>
                      {skill.write_access !== false && (
                        <>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className="text-red-500 focus:text-red-500"
                            onClick={() => confirmDelete(skill)}
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Delete
                          </DropdownMenuItem>
                        </>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>

                  <button
                    type="button"
                    className={`workspace-model-switch ${skill.is_active !== false ? 'workspace-model-switch--on' : ''}`}
                    aria-label={skill.is_active !== false ? 'Disable skill' : 'Enable skill'}
                    onClick={() => void handleToggle(skill)}
                  >
                    <span className="workspace-model-switch__thumb" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Pagination */}
        {total > PAGE_SIZE && (
          <div className="mt-2 flex items-center justify-end gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={page <= 1 || loading}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              Previous
            </Button>
            <span className="text-xs text-[var(--bodhion-text-secondary)]">
              Page {page} / {pageCount}
            </span>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={page >= pageCount || loading}
              onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
            >
              Next
            </Button>
          </div>
        )}
      </div>}

      {/* ── View / Create / Edit modal ── */}
      <Dialog open={editorOpen} onOpenChange={(v) => !v && closeEditor()}>
        <DialogContent aria-describedby={undefined} className="workspace-skills-editor-dialog">
          <DialogHeader>
            <DialogTitle>
              {editingSkill ? 'Edit Skill' : 'New Skill'}
            </DialogTitle>
          </DialogHeader>

          {/* Tab bar */}
          <div className="workspace-skills-tabs">
            <button
              type="button"
              className={`workspace-skills-tab${activeTab === 'details' ? ' workspace-skills-tab--active' : ''}`}
              onClick={() => setActiveTab('details')}
            >
              Details
            </button>
            <button
              type="button"
              className={`workspace-skills-tab${activeTab === 'access' ? ' workspace-skills-tab--active' : ''}`}
              onClick={() => setActiveTab('access')}
            >
              Access Control
            </button>
          </div>

          {activeTab === 'details' ? (
            <div className={`workspace-skills-editor-body${contentType === 'markdown' ? ' workspace-skills-editor-body--scroll' : ''}`}>

              {/* Content-type: toggle when creating, readonly badge when editing */}
              {editingSkill ? (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">Type:</span>
                  <Badge variant="outline" className="text-xs">
                    {contentType === 'markdown' ? 'Markdown (SKILL.md)' : 'Python'}
                  </Badge>
                </div>
              ) : (
                <div className="flex gap-1 rounded-lg border p-1 w-fit bg-muted/40">
                  <button
                    type="button"
                    onClick={() => setContentType('python')}
                    className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                      contentType === 'python'
                        ? 'bg-background shadow text-foreground'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    Python
                  </button>
                  <button
                    type="button"
                    onClick={() => setContentType('markdown')}
                    className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                      contentType === 'markdown'
                        ? 'bg-background shadow text-foreground'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    Markdown (SKILL.md)
                  </button>
                </div>
              )}

              {contentType === 'markdown' ? (
                /* ── Markdown / Hermes-style editor ── */
                <div className="skill-md-host">
                  <SkillMarkdownEditor
                    initialContent={editingSkill?.content ?? ''}
                    onChange={(assembled) => { mdContentRef.current = assembled; }}
                    onFmChange={(fm) => { mdFmRef.current = fm; }}
                  />
                </div>
              ) : (
                /* ── Python editor (existing fields + CodeEditor) ── */
                <>
                  {/* Name + ID — side-by-side to save vertical space */}
                  <div className="workspace-skills-field-row">
                    <div className="workspace-skills-field">
                      <label className="workspace-skills-label" htmlFor="skill-name">
                        Name <span className="text-red-400">*</span>
                      </label>
                      <Input
                        id="skill-name"
                        placeholder="e.g. Web Summariser"
                        value={form.name}
                        onChange={(e) => handleNameChange(e.target.value)}
                        maxLength={100}
                      />
                    </div>
                    <div className="workspace-skills-field">
                      <label className="workspace-skills-label" htmlFor="skill-id">
                        ID <span className="text-red-400">*</span>
                        <span className="workspace-skills-label-hint">kebab-case</span>
                      </label>
                      <Input
                        id="skill-id"
                        placeholder="e.g. web-summariser"
                        value={form.id}
                        disabled={!!editingSkill}
                        onChange={(e) => {
                          setIdTouched(true);
                          setForm((f) => ({ ...f, id: e.target.value.toLowerCase().replace(/\s+/g, '-') }));
                        }}
                        maxLength={64}
                      />
                    </div>
                  </div>

                  {/* Description */}
                  <div className="workspace-skills-field">
                    <label className="workspace-skills-label" htmlFor="skill-desc">
                      Description
                    </label>
                    <Input
                      id="skill-desc"
                      placeholder="What does this skill do? (optional)"
                      value={form.description}
                      onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                      maxLength={300}
                    />
                  </div>

                  {/* Code editor */}
                  <div className="workspace-skills-field workspace-skills-field--grow">
                    <label className="workspace-skills-label">
                      Content <span className="text-xs opacity-60">(Python)</span>
                    </label>
                    <div className="workspace-skills-editor-wrap">
                      <CodeEditor
                        ref={codeRef}
                        language="python"
                        value={editingSkill?.content ?? SKILL_TEMPLATE}
                        height="100%"
                        onSave={handleSave}
                      />
                    </div>
                  </div>
                </>
              )}
            </div>
          ) : (
            <div className="workspace-skills-access-body">
              <ServiceAccessTab
                grants={accessGrants}
                onChange={setAccessGrants}
                onSearchUsers={searchUsersForAccess}
                groups={groupsForAccess}
                loadingOptions={accessOptionsLoading}
              />
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-2">
            <Button variant="outline" onClick={closeEditor} disabled={saving}>Cancel</Button>
            <Button onClick={() => void handleSave()} disabled={saving}>
              {saving ? 'Saving…' : editingSkill ? 'Save Changes' : 'Create Skill'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Delete confirm ── */}
      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete Skill"
        description={`"${deleteTarget?.name}" will be permanently deleted.`}
        confirmLabel="Delete"
        variant="destructive"
        loading={deleting}
        onConfirm={() => void handleDelete()}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
