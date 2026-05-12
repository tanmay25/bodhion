'use client';

import { useEffect, useRef, useState } from 'react';
import { Plus, Pencil, Trash2, Check, X, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { useWorkspaceStore } from '@/store/workspaceStore';
import { useAuthStore } from '@/store/authStore';
import { getToken } from '@/lib/auth/session';
import { updateUserSettings } from '@/lib/api/users';
import {
  getMemories, addMemory, updateMemory, deleteMemory, deleteAllMemories,
  type Memory,
} from '@/lib/api/configs';
import { cn } from '@/lib/utils/cn';

// ── Toggle ────────────────────────────────────────────────────────────────────

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={cn('iface-toggle', checked && 'iface-toggle--on')}
    >
      <span className="iface-toggle-thumb" />
    </button>
  );
}

// ── Single memory card ────────────────────────────────────────────────────────

function MemoryCard({
  memory,
  onDelete,
  onUpdate,
}: {
  memory: Memory;
  onDelete: () => void;
  onUpdate: (content: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(memory.content);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const startEdit = () => {
    setDraft(memory.content);
    setEditing(true);
    setTimeout(() => textareaRef.current?.focus(), 40);
  };

  const cancelEdit = () => {
    setEditing(false);
    setDraft(memory.content);
  };

  const saveEdit = () => {
    if (draft.trim() && draft.trim() !== memory.content) {
      onUpdate(draft.trim());
    }
    setEditing(false);
  };

  const date = new Date(memory.updated_at * 1000).toLocaleDateString(undefined, {
    month: 'short', day: 'numeric', year: 'numeric',
  });

  return (
    <div className={cn('mem-card', editing && 'mem-card--editing')}>
      {editing ? (
        <>
          <textarea
            ref={textareaRef}
            className="mem-edit-textarea"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={3}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) saveEdit();
              if (e.key === 'Escape') cancelEdit();
            }}
          />
          <div className="mem-edit-actions">
            <span className="mem-edit-hint">Ctrl+Enter to save · Esc to cancel</span>
            <div className="mem-edit-btns">
              <button type="button" className="conn-icon-btn" onClick={cancelEdit} aria-label="Cancel">
                <X className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                className="conn-icon-btn mem-save-btn"
                onClick={saveEdit}
                disabled={!draft.trim()}
                aria-label="Save"
              >
                <Check className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </>
      ) : (
        <>
          <p className="mem-content">{memory.content}</p>
          <div className="mem-meta">
            <span className="mem-date">{date}</span>
            <div className="mem-actions">
              {confirmDelete ? (
                <>
                  <span className="mem-confirm-text">Delete?</span>
                  <button type="button" className="conn-icon-btn conn-icon-btn--danger" onClick={onDelete} aria-label="Confirm delete">
                    <Check className="h-3.5 w-3.5" />
                  </button>
                  <button type="button" className="conn-icon-btn" onClick={() => setConfirmDelete(false)} aria-label="Cancel delete">
                    <X className="h-3.5 w-3.5" />
                  </button>
                </>
              ) : (
                <>
                  <button type="button" className="conn-icon-btn" onClick={startEdit} aria-label="Edit">
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button type="button" className="conn-icon-btn conn-icon-btn--danger" onClick={() => setConfirmDelete(true)} aria-label="Delete">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ── Add memory form ───────────────────────────────────────────────────────────

function AddMemoryForm({ onAdd, onCancel }: { onAdd: (content: string) => void; onCancel: () => void }) {
  const [content, setContent] = useState('');

  return (
    <div className="mem-add-form">
      <textarea
        className="mem-edit-textarea"
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder={'Enter a detail about yourself for your LLMs to recall.\nRefer to yourself as "User" (e.g., "User is learning Spanish").'}
        rows={3}
        autoFocus
        onKeyDown={(e) => {
          if (e.key === 'Enter' && (e.ctrlKey || e.metaKey) && content.trim()) onAdd(content.trim());
          if (e.key === 'Escape') onCancel();
        }}
      />
      <div className="mem-edit-actions">
        <span className="mem-edit-hint">Ctrl+Enter to save</span>
        <div className="mem-edit-btns">
          <button type="button" className="conn-btn conn-btn--ghost" onClick={onCancel}>Cancel</button>
          <button
            type="button"
            className="conn-btn conn-btn--primary"
            disabled={!content.trim()}
            onClick={() => content.trim() && onAdd(content.trim())}
          >
            Add
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Clear-all confirm banner ──────────────────────────────────────────────────

function ClearConfirmBanner({ onConfirm, onCancel }: { onConfirm: () => void; onCancel: () => void }) {
  return (
    <div className="mem-clear-banner">
      <AlertTriangle className="h-4 w-4 mem-clear-icon" />
      <span className="mem-clear-text">This will permanently delete all memories. Continue?</span>
      <div className="mem-clear-actions">
        <button type="button" className="conn-btn conn-btn--ghost" onClick={onCancel}>Cancel</button>
        <button type="button" className="conn-btn mem-clear-confirm-btn" onClick={onConfirm}>
          Clear all
        </button>
      </div>
    </div>
  );
}

// ── Main tab ──────────────────────────────────────────────────────────────────

export function PersonalizationTab({ onRegisterSave }: { onRegisterSave: (fn: () => Promise<void>) => void }) {
  const settings      = useWorkspaceStore((s) => s.settings);
  const patchSettings = useWorkspaceStore((s) => s.patchSettings);
  const config        = useAuthStore((s) => s.config);

  const memoriesEnabled = config?.features?.enable_memories ?? false;

  const [memoryOn,      setMemoryOn]      = useState(settings.memory ?? false);
  const [memories,      setMemories]      = useState<Memory[]>([]);
  const [loadingMem,    setLoadingMem]    = useState(false);
  const [showAdd,       setShowAdd]       = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  // Sync toggle from store when modal opens
  useEffect(() => { setMemoryOn(settings.memory ?? false); }, [settings.memory]);

  // Load memories when memory feature is on and toggle is enabled
  useEffect(() => {
    if (!memoriesEnabled || !memoryOn) return;
    const token = getToken();
    if (!token) return;
    setLoadingMem(true);
    getMemories(token)
      .then(setMemories)
      .catch(() => toast.error('Failed to load memories'))
      .finally(() => setLoadingMem(false));
  }, [memoriesEnabled, memoryOn]);

  // Latest-ref pattern — keep both settings and memoryOn current in the closure
  const latestRef = useRef({ settings, memoryOn });
  latestRef.current = { settings, memoryOn };

  useEffect(() => {
    onRegisterSave(async () => {
      const token = getToken();
      if (!token) throw new Error('Not authenticated');
      const { settings: s, memoryOn: m } = latestRef.current;
      await updateUserSettings(token, { ui: { ...s, memory: m } });
      patchSettings({ memory: m });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onRegisterSave]);

  const handleAddMemory = async (content: string) => {
    const token = getToken();
    if (!token) return;
    try {
      const created = await addMemory(token, content);
      setMemories((prev) => [created, ...prev]);
      setShowAdd(false);
      toast.success('Memory added');
    } catch {
      toast.error('Failed to add memory');
    }
  };

  const handleUpdateMemory = async (id: string, content: string) => {
    const token = getToken();
    if (!token) return;
    try {
      const updated = await updateMemory(token, id, content);
      setMemories((prev) => prev.map((m) => (m.id === id ? updated : m)));
      toast.success('Memory updated');
    } catch {
      toast.error('Failed to update memory');
    }
  };

  const handleDeleteMemory = async (id: string) => {
    const token = getToken();
    if (!token) return;
    try {
      await deleteMemory(token, id);
      setMemories((prev) => prev.filter((m) => m.id !== id));
      toast.success('Memory deleted');
    } catch {
      toast.error('Failed to delete memory');
    }
  };

  const handleClearAll = async () => {
    const token = getToken();
    if (!token) return;
    try {
      await deleteAllMemories(token);
      setMemories([]);
      setShowClearConfirm(false);
      toast.success('All memories cleared');
    } catch {
      toast.error('Failed to clear memories');
    }
  };

  return (
    <div className="settings-tab-content">

      {/* ── Memory toggle ──────────────────────────────────── */}
      <div className="settings-section">
        <div className="iface-row" style={{ borderTop: 'none' }}>
          <div className="iface-row-text">
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span className="iface-row-label">Memory</span>
              <span className="intg-badge">Experimental</span>
            </div>
            <span className="iface-row-desc">
              Personalise interactions by letting LLMs remember things about you across conversations.
            </span>
          </div>
          <Toggle
            checked={memoryOn}
            onChange={(v) => {
              if (!memoriesEnabled) {
                toast.error('Memory is not enabled on this server');
                return;
              }
              setMemoryOn(v);
            }}
          />
        </div>

        {!memoriesEnabled && (
          <p className="mem-feature-disabled">
            Memory is disabled on this server. Contact your administrator to enable it.
          </p>
        )}
      </div>

      {/* ── Memory list (shown when on + feature enabled) ── */}
      {memoriesEnabled && memoryOn && (
        <div className="settings-section">
          <div className="mem-list-header">
            <span className="settings-section-title" style={{ marginBottom: 0 }}>Memories</span>
            <button
              type="button"
              className="conn-icon-btn"
              onClick={() => { setShowAdd((v) => !v); }}
              aria-label="Add memory"
            >
              <Plus className="h-4 w-4" />
            </button>
          </div>

          {showAdd && (
            <AddMemoryForm
              onAdd={handleAddMemory}
              onCancel={() => setShowAdd(false)}
            />
          )}

          <div className="mem-list">
            {loadingMem && (
              <div className="mem-loading">
                <span className="mem-loading-dot" /><span className="mem-loading-dot" /><span className="mem-loading-dot" />
              </div>
            )}

            {!loadingMem && memories.length === 0 && !showAdd && (
              <div className="conn-empty">No memories yet. Click <strong>+</strong> to add one.</div>
            )}

            {memories.map((m) => (
              <MemoryCard
                key={m.id}
                memory={m}
                onDelete={() => handleDeleteMemory(m.id)}
                onUpdate={(content) => handleUpdateMemory(m.id, content)}
              />
            ))}
          </div>

          {memories.length > 0 && !showClearConfirm && (
            <button
              type="button"
              className="mem-clear-btn"
              onClick={() => setShowClearConfirm(true)}
            >
              <Trash2 className="h-3.5 w-3.5" />
              Clear all memories
            </button>
          )}

          {showClearConfirm && (
            <ClearConfirmBanner
              onConfirm={handleClearAll}
              onCancel={() => setShowClearConfirm(false)}
            />
          )}
        </div>
      )}

    </div>
  );
}
