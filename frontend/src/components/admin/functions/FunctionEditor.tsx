'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronLeft, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { Button }      from '@/components/ui/Button';
import { CodeEditor, type CodeEditorHandle } from '@/components/shared/CodeEditor';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { getToken }    from '@/lib/auth/session';
import {
  createFunction,
  updateFunctionById,
  type AdminFunction,
} from '@/lib/api/admin/functions';

// Default boilerplate shown in the editor for new functions
const BOILERPLATE = `"""
title: Example Filter
author: bodhion
version: 0.1
"""

from pydantic import BaseModel, Field
from typing import Optional


class Filter:
    class Valves(BaseModel):
        priority: int = Field(default=0, description="Priority level for the filter operations.")
        max_turns: int = Field(default=8, description="Maximum allowable conversation turns.")

    def __init__(self):
        self.valves = self.Valves()

    def inlet(self, body: dict, __user__: Optional[dict] = None) -> dict:
        print(f"inlet:{__name__}")
        return body

    def outlet(self, body: dict, __user__: Optional[dict] = None) -> dict:
        print(f"outlet:{__name__}")
        return body
`;

interface FunctionEditorProps {
  /** Provide when editing an existing function */
  initial?: AdminFunction;
  mode:     'create' | 'edit';
  /** Where to navigate after save or back. Defaults to '/admin/functions' */
  returnPath?: string;
}

export function FunctionEditor({ initial, mode, returnPath = '/admin/functions' }: FunctionEditorProps) {
  const router    = useRouter();
  const editorRef = useRef<CodeEditorHandle>(null);

  const [name,    setName]    = useState(initial?.name    ?? '');
  const [id,      setId]      = useState(initial?.id      ?? '');
  const [desc,    setDesc]    = useState(initial?.meta?.description ?? '');
  const [saving,  setSaving]  = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  // Auto-derive ID from name for new functions
  const handleNameChange = (v: string) => {
    setName(v);
    if (mode === 'create') setId(v.replace(/\s+/g, '_').toLowerCase());
  };

  const doSave = async () => {
    const content = editorRef.current?.getValue() ?? initial?.content ?? '';
    const token   = getToken();
    if (!token) return;

    setSaving(true);
    try {
      if (mode === 'create') {
        await createFunction(token, {
          id,
          name,
          meta:    { description: desc },
          content,
          is_active: true,
          is_global: false,
        });
        toast.success('Function created');
      } else {
        await updateFunctionById(token, initial!.id, {
          name,
          meta:    { ...initial?.meta, description: desc },
          content,
        });
        toast.success('Function updated');
      }
      router.push(returnPath);
    } catch (err: unknown) {
      const detail = (err as { detail?: string })?.detail;
      toast.error(detail ?? 'Failed to save function');
    } finally {
      setSaving(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (mode === 'create') {
      setShowConfirm(true);
    } else {
      doSave();
    }
  };

  return (
    <div className="flex h-full flex-col">
      <form onSubmit={handleSubmit} className="flex h-full flex-col gap-3">
        {/* Top bar */}
        <div className="flex flex-col gap-0.5">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => router.push(returnPath)}
              className="rounded-lg p-1.5 transition-colors hover:bg-[rgba(255,255,255,0.06)]"
              style={{ color: 'var(--bodhion-text-secondary)' }}
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <input
              type="text"
              value={name}
              onChange={(e) => handleNameChange(e.target.value)}
              placeholder="Function Name"
              required
              className="flex-1 bg-transparent text-xl font-semibold outline-none placeholder:opacity-40"
              style={{ color: 'var(--bodhion-text-primary)' }}
            />
            <span
              className="shrink-0 rounded px-2 py-0.5 text-xs font-semibold uppercase"
              style={{ background: 'rgba(37,215,255,0.1)', color: 'rgba(37,215,255,0.9)' }}
            >
              Function
            </span>
          </div>

          <div className="flex items-center gap-3 pl-9">
            {mode === 'edit' ? (
              <span className="text-sm" style={{ color: 'var(--bodhion-text-secondary)' }}>{id}</span>
            ) : (
              <input
                type="text"
                value={id}
                onChange={(e) => setId(e.target.value)}
                placeholder="function_id"
                required
                className="bg-transparent text-sm outline-none placeholder:opacity-40"
                style={{ color: 'var(--bodhion-text-secondary)' }}
              />
            )}
            <input
              type="text"
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
              placeholder="Function description…"
              required
              className="flex-1 bg-transparent text-sm outline-none placeholder:opacity-40"
              style={{ color: 'var(--bodhion-text-secondary)' }}
            />
          </div>
        </div>

        {/* Code editor — fills remaining height */}
        <div className="flex-1 min-h-0">
          <CodeEditor
            ref={editorRef}
            value={initial?.content ?? BOILERPLATE}
            language="python"
            height="100%"
            onSave={() => {
              if (mode === 'create') setShowConfirm(true);
              else doSave();
            }}
          />
        </div>

        {/* Footer */}
        <div className="flex items-start justify-between gap-3 pb-2">
          <div className="flex items-start gap-1.5 text-xs" style={{ color: 'var(--bodhion-text-secondary)' }}>
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-400" />
            <span>
              <strong style={{ color: 'var(--bodhion-text-primary)' }}>Warning:</strong>{' '}
              Functions allow arbitrary code execution. Don&apos;t install from sources you don&apos;t trust.
            </span>
          </div>
          <Button type="submit" disabled={saving} className="shrink-0">
            {saving ? 'Saving…' : 'Save'}
          </Button>
        </div>
      </form>

      {/* Security confirm for new functions */}
      <ConfirmDialog
        open={showConfirm}
        title="Create function"
        confirmLabel="I understand, create"
        variant="default"
        onConfirm={() => { setShowConfirm(false); doSave(); }}
        onCancel={() => setShowConfirm(false)}
      >
        <div className="flex flex-col gap-3 text-sm">
          <div
            className="rounded-lg px-4 py-3"
            style={{ background: 'rgba(251,146,60,0.1)', color: 'rgba(251,146,60,0.9)', border: '1px solid rgba(251,146,60,0.3)' }}
          >
            <p className="font-medium mb-1">Security Warning</p>
            <ul className="list-disc pl-4 text-xs space-y-0.5">
              <li>Functions allow arbitrary code execution.</li>
              <li>Do not install functions from sources you do not fully trust.</li>
            </ul>
          </div>
          <p style={{ color: 'var(--bodhion-text-secondary)' }}>
            I acknowledge the risks and have verified the trustworthiness of the source.
          </p>
        </div>
      </ConfirmDialog>
    </div>
  );
}

export default FunctionEditor;
