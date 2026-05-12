'use client';

import { useEffect, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Pencil, Settings2, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Input } from '@/components/ui/Input';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/Modal';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { CodeEditor } from '@/components/shared/CodeEditor';
import type { CodeEditorHandle } from '@/components/shared/CodeEditor';
import { getToken } from '@/lib/auth/session';
import {
  getToolById,
  updateTool,
  deleteTool,
  getToolUserValvesSpec,
  getToolUserValves,
  updateToolUserValves,
} from '@/lib/api/workspace';
import type { Tool } from '@/types/api';

type ToolWithAccess = Tool & { write_access?: boolean };

// ── Valve types ───────────────────────────────────────────────────────────────

interface ValveFieldSpec {
  type: string;
  title?: string;
  description?: string;
  default?: unknown;
  enum?: string[];
}

interface ValveSpec {
  properties: Record<string, ValveFieldSpec>;
  required?: string[];
}

// ── Valve field renderer ──────────────────────────────────────────────────────

function ValveField({
  name,
  spec,
  value,
  onChange,
}: {
  name: string;
  spec: ValveFieldSpec;
  value: unknown;
  onChange: (v: unknown) => void;
}) {
  const label = spec.title ?? name;
  const inputCls = 'admin-input h-9 w-full rounded-md px-3 text-sm';

  if (spec.type === 'boolean') {
    return (
      <div className="flex items-center justify-between gap-3">
        <div className="flex flex-col">
          <span className="text-sm font-medium text-[var(--bodhion-text-primary)]">{label}</span>
          {spec.description && (
            <span className="text-xs text-[var(--bodhion-text-secondary)]">{spec.description}</span>
          )}
        </div>
        <input
          type="checkbox"
          checked={!!value}
          onChange={(e) => onChange(e.target.checked)}
          className="h-4 w-4 cursor-pointer rounded accent-[rgba(37,215,255,0.9)]"
        />
      </div>
    );
  }

  if (spec.enum?.length) {
    return (
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium text-[var(--bodhion-text-primary)]">{label}</label>
        {spec.description && (
          <span className="text-xs text-[var(--bodhion-text-secondary)]">{spec.description}</span>
        )}
        <select
          value={String(value ?? '')}
          onChange={(e) => onChange(e.target.value)}
          className="admin-select h-9 w-full rounded-md px-3 text-sm"
        >
          {spec.enum.map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </select>
      </div>
    );
  }

  if (spec.type === 'integer' || spec.type === 'number') {
    return (
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium text-[var(--bodhion-text-primary)]">{label}</label>
        {spec.description && (
          <span className="text-xs text-[var(--bodhion-text-secondary)]">{spec.description}</span>
        )}
        <input
          type="number"
          value={(value as number) ?? ''}
          onChange={(e) =>
            onChange(
              spec.type === 'integer'
                ? parseInt(e.target.value, 10)
                : parseFloat(e.target.value),
            )
          }
          className={inputCls}
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-sm font-medium text-[var(--bodhion-text-primary)]">{label}</label>
      {spec.description && (
        <span className="text-xs text-[var(--bodhion-text-secondary)]">{spec.description}</span>
      )}
      <input
        type="text"
        value={String(value ?? '')}
        onChange={(e) => onChange(e.target.value)}
        className={inputCls}
      />
    </div>
  );
}

// ── User Valves Modal ─────────────────────────────────────────────────────────

function ToolUserValvesModal({
  tool,
  onClose,
}: {
  tool: ToolWithAccess | null;
  onClose: () => void;
}) {
  const [spec, setSpec] = useState<ValveSpec | null>(null);
  const [values, setValues] = useState<Record<string, unknown>>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!tool) return;
    setLoading(true);
    const token = getToken();
    if (!token) { setLoading(false); return; }

    Promise.all([getToolUserValvesSpec(token, tool.id), getToolUserValves(token, tool.id)])
      .then(([specRes, valuesRes]) => {
        setSpec((specRes as unknown as ValveSpec) ?? null);
        setValues((valuesRes as Record<string, unknown>) ?? {});
      })
      .catch(() => { setSpec(null); setValues({}); })
      .finally(() => setLoading(false));
  }, [tool?.id]);

  const handleSave = async () => {
    if (!tool) return;
    const token = getToken();
    if (!token) return;
    setSaving(true);
    try {
      await updateToolUserValves(token, tool.id, values);
      toast.success('Settings saved');
      onClose();
    } catch {
      toast.error('Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const fields = Object.entries(spec?.properties ?? {});

  return (
    <Dialog open={!!tool} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="admin-dialog flex max-h-[90vh] flex-col sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Configure — {tool?.name}</DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto py-1 pr-1">
          {loading ? (
            <div className="flex flex-col gap-4">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="flex flex-col gap-1.5">
                  <div className="h-4 w-24 animate-pulse rounded bg-[var(--bodhion-search-bg)]" />
                  <div className="h-9 w-full animate-pulse rounded bg-[var(--bodhion-search-bg)]" />
                </div>
              ))}
            </div>
          ) : fields.length === 0 ? (
            <p className="py-4 text-center text-sm text-[var(--bodhion-text-secondary)]">
              No configurable settings for this tool.
            </p>
          ) : (
            <div className="flex flex-col gap-4">
              {fields.map(([name, fieldSpec]) => (
                <ValveField
                  key={name}
                  name={name}
                  spec={fieldSpec}
                  value={values[name] ?? fieldSpec.default}
                  onChange={(v) => setValues((prev) => ({ ...prev, [name]: v }))}
                />
              ))}
            </div>
          )}
        </div>

        {!loading && fields.length > 0 && (
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={onClose} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={() => void handleSave()} disabled={saving}>
              {saving ? 'Saving…' : 'Save'}
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const formatDate = (epoch: number) =>
  new Date(epoch * 1000).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

const capitalize = (v?: string) => (v ? v.charAt(0).toUpperCase() + v.slice(1) : '');

// ── Page ──────────────────────────────────────────────────────────────────────

export default function ToolDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const id = params?.id ?? '';

  const [tool, setTool] = useState<ToolWithAccess | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name: '', description: '' });
  const codeRef = useRef<CodeEditorHandle>(null);

  const [valvesOpen, setValvesOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const canWrite = tool?.write_access !== false;

  // ── Load ──────────────────────────────────────────────────────────────────

  useEffect(() => {
    const load = async () => {
      const token = getToken();
      if (!token || !id) return;
      setLoading(true);
      try {
        const result = await getToolById(token, id);
        const toolData = result as ToolWithAccess;
        setTool(toolData);
        setForm({
          name: toolData.name ?? '',
          description: (toolData.meta?.description as string | undefined) ?? '',
        });
      } catch {
        toast.error('Failed to load tool');
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, [id]);

  // ── Save ──────────────────────────────────────────────────────────────────

  const handleSave = async () => {
    const token = getToken();
    if (!token || !tool) return;
    if (!form.name.trim()) {
      toast.error('Name is required');
      return;
    }
    setSaving(true);
    try {
      const content = codeRef.current?.getValue() ?? tool.content ?? '';
      const updated = await updateTool(token, tool.id, {
        name: form.name,
        meta: { description: form.description || undefined },
        content,
      });
      setTool({ ...(updated as ToolWithAccess), write_access: tool.write_access });
      setEditing(false);
      toast.success('Tool saved');
    } catch (err: unknown) {
      const detail = (err as { detail?: string })?.detail;
      toast.error(detail ?? 'Failed to save tool');
    } finally {
      setSaving(false);
    }
  };

  const cancelEdit = () => {
    setEditing(false);
    setForm({
      name: tool?.name ?? '',
      description: (tool?.meta?.description as string | undefined) ?? '',
    });
  };

  // ── Delete ────────────────────────────────────────────────────────────────

  const handleDelete = async () => {
    const token = getToken();
    if (!token || !tool) return;
    setDeleting(true);
    try {
      await deleteTool(token, tool.id);
      toast.success(`Deleted "${tool.name}"`);
      router.push('/workspace/tools');
    } catch {
      toast.error('Failed to delete tool');
      setDeleting(false);
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="kd-page">
        <div className="kd-loading">Loading tool...</div>
      </div>
    );
  }

  if (!tool) {
    return (
      <div className="kd-page" style={{ gap: '1rem', padding: '2rem' }}>
        <div className="kd-loading">Tool not found.</div>
        <Button variant="outline" size="sm" onClick={() => router.push('/workspace/tools')}>
          Back to Tools
        </Button>
      </div>
    );
  }

  const specCount = (tool.specs ?? []).length;

  return (
    <div className="kd-page">
      {/* Header */}
      <div className="kd-header">
        <button className="kd-back-btn" onClick={() => router.push('/workspace/tools')}>
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div className="kd-breadcrumb">
          <span
            className="kd-breadcrumb-parent"
            onClick={() => router.push('/workspace/tools')}
          >
            Tools
          </span>
          <span className="kd-breadcrumb-sep">/</span>
          <span className="kd-breadcrumb-current">{tool.name}</span>
        </div>
        <div className="ml-auto flex items-center gap-2">
          {!canWrite && <Badge variant="outline">Read Only</Badge>}
          {tool.has_user_valves && (
            <button
              className="kd-access-btn"
              onClick={() => setValvesOpen(true)}
              title="Configure user settings"
            >
              <Settings2 className="h-3.5 w-3.5" />
              <span>Configure</span>
            </button>
          )}
          {canWrite && !editing && (
            <button className="kd-access-btn" onClick={() => setEditing(true)}>
              <Pencil className="h-3.5 w-3.5" />
              <span>Edit</span>
            </button>
          )}
          {canWrite && (
            <button
              className="kd-access-btn kd-access-btn--danger"
              onClick={() => setDeleteOpen(true)}
              title="Delete tool"
            >
              <Trash2 className="h-3.5 w-3.5" />
              <span>Delete</span>
            </button>
          )}
        </div>
      </div>

      {/* Body */}
      <div className="kd-body sd-body">
        {/* Metadata panel */}
        <div className="kd-meta-card">
          <div className="kd-meta-label">Tool Details</div>

          <div className="kd-field">
            <label className="kd-field-label">Name</label>
            <Input
              className="kd-field-input"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              disabled={!editing}
              placeholder="Tool name"
            />
          </div>

          <div className="kd-field">
            <label className="kd-field-label">ID</label>
            <Input className="kd-field-input" value={tool.id} disabled />
          </div>

          <div className="kd-field">
            <label className="kd-field-label">Description</label>
            <textarea
              className="kd-field-textarea"
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              disabled={!editing}
              placeholder="What does this tool do?"
              rows={3}
            />
          </div>

          {/* Badges */}
          <div className="flex flex-wrap gap-2 pt-1">
            {specCount > 0 && (
              <Badge variant="outline" className="workspace-tools-spec-badge">
                {specCount} fn{specCount !== 1 ? 's' : ''}
              </Badge>
            )}
            {tool.has_user_valves && (
              <Badge variant="outline" className="workspace-tools-valves-badge">
                configurable
              </Badge>
            )}
          </div>

          <div className="kd-meta-footer">
            <span className="kd-meta-ts">
              {capitalize(tool.user?.name ?? tool.user?.email ?? '')}
              {tool.user && ' · '}
              Updated {formatDate(tool.updated_at)}
            </span>
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
        <div className="sd-code-card">
          <div className="sd-code-header">
            <span className="sd-code-title">Content</span>
            <span className="sd-code-lang">Python</span>
          </div>
          <div className="sd-code-body">
            <CodeEditor
              ref={codeRef}
              language="python"
              value={tool.content ?? ''}
              height="100%"
              readOnly={!editing}
              onSave={editing ? () => void handleSave() : undefined}
            />
          </div>
        </div>
      </div>

      {/* User Valves modal */}
      <ToolUserValvesModal
        tool={valvesOpen ? tool : null}
        onClose={() => setValvesOpen(false)}
      />

      {/* Delete confirm */}
      <ConfirmDialog
        open={deleteOpen}
        title="Delete Tool"
        description={`"${tool.name}" will be permanently deleted.`}
        confirmLabel="Delete"
        variant="destructive"
        loading={deleting}
        onConfirm={() => void handleDelete()}
        onCancel={() => setDeleteOpen(false)}
      />
    </div>
  );
}
