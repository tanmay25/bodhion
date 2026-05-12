'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  Search, Plus, Download, Upload, Globe, Settings2,
  Pencil, Copy, Trash2, MoreHorizontal, X,
} from 'lucide-react';
import { toast } from 'sonner';
import { getToken }         from '@/lib/auth/session';
import { Switch }           from '@/components/ui/Switch';
import { ConfirmDialog }    from '@/components/shared/ConfirmDialog';
import { ValvesModal }      from './ValvesModal';
import {
  getFunctionList,
  deleteFunctionById,
  toggleFunctionById,
  toggleGlobalById,
  exportFunctions,
  getFunctionById,
  type AdminFunction,
} from '@/lib/api/admin/functions';

type TypeFilter = '' | 'pipe' | 'filter' | 'action';

function typeBadgeStyle(type: string) {
  if (type === 'pipe')   return { color: 'rgba(130,100,255,0.9)', background: 'rgba(130,100,255,0.1)' };
  if (type === 'filter') return { color: 'rgba(37,215,255,0.9)',  background: 'rgba(37,215,255,0.1)'  };
  if (type === 'action') return { color: 'rgba(251,146,60,0.9)',  background: 'rgba(251,146,60,0.1)'  };
  return { color: 'var(--bodhion-text-secondary)', background: 'var(--bodhion-search-bg)' };
}

function RowMenu({
  func,
  onEdit, onClone, onExport, onDelete, onToggleGlobal,
}: {
  func:           AdminFunction;
  onEdit:         () => void;
  onClone:        () => void;
  onExport:       () => void;
  onDelete:       () => void;
  onToggleGlobal: () => void;
}) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={(e) => { e.stopPropagation(); setOpen((o) => !o); }}
        className="rounded-lg p-1.5 transition-colors hover:bg-[rgba(255,255,255,0.06)]"
        style={{ color: 'var(--bodhion-text-secondary)' }}
        title="More options"
      >
        <MoreHorizontal className="h-4 w-4" />
      </button>

      {open && (
        <div className="admin-popover absolute right-0 z-20 mt-1 w-44 rounded-lg py-1" onClick={(e) => e.stopPropagation()}>
          {/* Global toggle (filter + action only) */}
          {['filter', 'action'].includes(func.type) && (
            <>
              <div className="flex items-center justify-between px-3 py-1.5">
                <span className="flex items-center gap-2 text-sm" style={{ color: 'var(--bodhion-text-primary)' }}>
                  <Globe className="h-3.5 w-3.5" /> Global
                </span>
                <Switch
                  checked={func.is_global}
                  onCheckedChange={() => { onToggleGlobal(); setOpen(false); }}
                />
              </div>
              <div className="my-1 border-t" style={{ borderColor: 'var(--bodhion-card-border)' }} />
            </>
          )}
          <button className="admin-popover-item w-full" onClick={() => { onEdit(); setOpen(false); }}>
            <Pencil className="h-3.5 w-3.5" /> Edit
          </button>
          <button className="admin-popover-item w-full" onClick={() => { onClone(); setOpen(false); }}>
            <Copy className="h-3.5 w-3.5" /> Clone
          </button>
          <button className="admin-popover-item w-full" onClick={() => { onExport(); setOpen(false); }}>
            <Download className="h-3.5 w-3.5" /> Export
          </button>
          <div className="my-1 border-t" style={{ borderColor: 'var(--bodhion-card-border)' }} />
          <button className="admin-popover-item admin-popover-item--danger w-full" onClick={() => { onDelete(); setOpen(false); }}>
            <Trash2 className="h-3.5 w-3.5" /> Delete
          </button>
        </div>
      )}
    </div>
  );
}

export function FunctionList({ routePrefix = '/admin/functions' }: { routePrefix?: string }) {
  const router = useRouter();

  const [functions,  setFunctions]  = useState<AdminFunction[]>([]);
  const [filtered,   setFiltered]   = useState<AdminFunction[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [query,      setQuery]      = useState('');
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('');

  const [deleteTarget,  setDeleteTarget]  = useState<AdminFunction | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const [valvesFunc, setValvesFunc] = useState<AdminFunction | null>(null);

  // Import file flow
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importFiles,   setImportFiles]   = useState<FileList | null>(null);
  const [showImportWarn, setShowImportWarn] = useState(false);

  // Debounced filter
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const applyFilter = useCallback(
    (list: AdminFunction[], q: string, t: TypeFilter) => {
      const lq = q.toLowerCase();
      return list
        .filter((f) =>
          (t === '' || f.type === t) &&
          (q === '' ||
            f.name.toLowerCase().includes(lq) ||
            f.id.toLowerCase().includes(lq) ||
            (f.user?.name ?? '').toLowerCase().includes(lq) ||
            (f.user?.email ?? '').toLowerCase().includes(lq))
        )
        .sort((a, b) => a.type.localeCompare(b.type) || a.name.localeCompare(b.name));
    },
    []
  );

  const load = useCallback(async () => {
    const token = getToken();
    if (!token) return;
    setLoading(true);
    try {
      const list = await getFunctionList(token);
      const arr  = Array.isArray(list) ? list : [];
      setFunctions(arr);
      setFiltered(applyFilter(arr, query, typeFilter));
    } catch {
      toast.error('Failed to load functions');
    } finally {
      setLoading(false);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { load(); }, [load]);

  // Re-filter on query / type change
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setFiltered(applyFilter(functions, query, typeFilter));
    }, 250);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query, typeFilter, functions, applyFilter]);

  // ── Actions ─────────────────────────────────────────────────────────────────

  const handleToggleActive = async (func: AdminFunction) => {
    const token = getToken();
    if (!token) return;
    try {
      const updated = await toggleFunctionById(token, func.id);
      setFunctions((prev) => prev.map((f) => f.id === func.id ? { ...f, ...updated } : f));
    } catch {
      toast.error('Failed to toggle function');
    }
  };

  const handleToggleGlobal = async (func: AdminFunction) => {
    const token = getToken();
    if (!token) return;
    try {
      const updated = await toggleGlobalById(token, func.id);
      setFunctions((prev) => prev.map((f) => f.id === func.id ? { ...f, ...updated } : f));
      toast.success(updated.is_global ? 'Globally enabled' : 'Globally disabled');
    } catch {
      toast.error('Failed to toggle global');
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleteLoading(true);
    const token = getToken();
    try {
      await deleteFunctionById(token!, deleteTarget.id);
      toast.success('Function deleted');
      setFunctions((prev) => prev.filter((f) => f.id !== deleteTarget.id));
      setDeleteTarget(null);
    } catch {
      toast.error('Failed to delete function');
    } finally {
      setDeleteLoading(false);
    }
  };

  const handleClone = async (func: AdminFunction) => {
    const token = getToken();
    if (!token) return;
    try {
      const full = await getFunctionById(token, func.id);
      sessionStorage.setItem('function', JSON.stringify({
        ...full,
        id:   `${full.id}_clone`,
        name: `${full.name} (Clone)`,
      }));
      router.push(`${routePrefix}/create`);
    } catch {
      toast.error('Failed to clone function');
    }
  };

  const handleExportOne = async (func: AdminFunction) => {
    const token = getToken();
    if (!token) return;
    try {
      const full = await getFunctionById(token, func.id);
      const blob = new Blob([JSON.stringify([full], null, 2)], { type: 'application/json' });
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href     = url;
      a.download = `function-${func.id}-${Date.now()}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error('Export failed');
    }
  };

  const handleExportAll = async () => {
    const token = getToken();
    if (!token) return;
    try {
      const data = await exportFunctions(token);
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href     = url;
      a.download = `functions-export-${Date.now()}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error('Export failed');
    }
  };

  const handleImportFiles = () => {
    if (!importFiles?.length) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const parsed = JSON.parse(e.target?.result as string);
        // Store first function in sessionStorage and navigate to create
        const func = Array.isArray(parsed) ? parsed[0] : parsed;
        sessionStorage.setItem('function', JSON.stringify('function' in func ? func.function : func));
        router.push(`${routePrefix}/create`);
        toast.success('Function loaded. Review and save.');
      } catch {
        toast.error('Invalid JSON file');
      }
    };
    reader.readAsText(importFiles[0]);
    setImportFiles(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const TYPE_FILTERS: { label: string; value: TypeFilter }[] = [
    { label: 'All',    value: ''       },
    { label: 'Pipe',   value: 'pipe'   },
    { label: 'Filter', value: 'filter' },
    { label: 'Action', value: 'action' },
  ];

  return (
    <>
      {/* Toolbar */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <h2 className="text-base font-semibold" style={{ color: 'var(--bodhion-text-primary)' }}>
            Functions
          </h2>
          {!loading && (
            <span className="text-sm" style={{ color: 'var(--bodhion-text-secondary)' }}>
              {filtered.length}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Import */}
          <input
            ref={fileInputRef}
            type="file"
            accept=".json"
            className="hidden"
            onChange={(e) => {
              if (e.target.files?.length) {
                setImportFiles(e.target.files);
                setShowImportWarn(true);
              }
            }}
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors"
            style={{ background: 'var(--bodhion-search-bg)', color: 'var(--bodhion-text-secondary)', border: '1px solid var(--bodhion-search-border)' }}
          >
            <Upload className="h-3.5 w-3.5" /> Import
          </button>

          {/* Export all */}
          {functions.length > 0 && (
            <button
              onClick={handleExportAll}
              className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors"
              style={{ background: 'var(--bodhion-search-bg)', color: 'var(--bodhion-text-secondary)', border: '1px solid var(--bodhion-search-border)' }}
            >
              <Download className="h-3.5 w-3.5" /> Export
            </button>
          )}

          {/* New function */}
          <button
            onClick={() => router.push(`${routePrefix}/create`)}
            className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors"
            style={{ background: 'rgba(37,215,255,0.15)', color: 'rgba(37,215,255,0.9)', border: '1px solid rgba(37,215,255,0.3)' }}
          >
            <Plus className="h-3.5 w-3.5" /> New Function
          </button>
        </div>
      </div>

      {/* Search + type filter */}
      <div
        className="mb-4 rounded-xl p-3"
        style={{ background: 'var(--bodhion-card-bg)', border: '1px solid var(--bodhion-card-border)' }}
      >
        {/* Search */}
        <div className="relative mb-2">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2" style={{ color: 'var(--bodhion-text-secondary)' }} />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search functions…"
            className="admin-input h-9 w-full rounded-md pl-9 pr-8 text-sm"
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-full p-0.5"
              style={{ color: 'var(--bodhion-text-secondary)' }}
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </div>

        {/* Type pill filters */}
        <div className="flex gap-1">
          {TYPE_FILTERS.map(({ label, value }) => (
            <button
              key={value}
              onClick={() => setTypeFilter(value)}
              className="rounded-full px-3 py-0.5 text-xs font-medium transition-colors"
              style={
                typeFilter === value
                  ? { background: 'rgba(37,215,255,0.15)', color: 'rgba(37,215,255,0.9)' }
                  : { background: 'var(--bodhion-search-bg)', color: 'var(--bodhion-text-secondary)' }
              }
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Grid */}
      {loading ? (
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="admin-card flex items-center gap-3 rounded-xl p-3">
              <div className="flex-1 flex flex-col gap-2">
                <div className="h-4 w-1/3 animate-pulse rounded" style={{ background: 'var(--bodhion-search-bg)' }} />
                <div className="h-3 w-2/3 animate-pulse rounded" style={{ background: 'var(--bodhion-search-bg)' }} />
              </div>
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <span className="text-3xl">😕</span>
          <p className="text-sm font-medium" style={{ color: 'var(--bodhion-text-primary)' }}>No functions found</p>
          <p className="text-xs" style={{ color: 'var(--bodhion-text-secondary)' }}>
            Try adjusting your search or filter.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          {filtered.map((func) => (
            <div
              key={func.id}
              className="admin-card flex items-center gap-3 rounded-xl p-3 cursor-pointer"
              onClick={() => router.push(`${routePrefix}/edit?id=${encodeURIComponent(func.id)}`)}
            >
              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span
                    className="shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase"
                    style={typeBadgeStyle(func.type)}
                  >
                    {func.type}
                  </span>
                  <span className="truncate text-sm font-medium" style={{ color: 'var(--bodhion-text-primary)' }}>
                    {func.name}
                  </span>
                  {func.meta?.manifest?.version && (
                    <span className="shrink-0 text-xs" style={{ color: 'var(--bodhion-text-secondary)' }}>
                      v{func.meta.manifest.version}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {func.user?.name && (
                    <span className="text-xs shrink-0" style={{ color: 'var(--bodhion-text-secondary)' }}>
                      By {func.user.name}
                    </span>
                  )}
                  {func.meta?.description && (
                    <span className="truncate text-xs" style={{ color: 'var(--bodhion-text-secondary)' }}>
                      {func.meta.description}
                    </span>
                  )}
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                {/* Valves */}
                <button
                  onClick={() => setValvesFunc(func)}
                  title="Valves"
                  className="rounded-lg p-1.5 transition-colors hover:bg-[rgba(255,255,255,0.06)]"
                  style={{ color: 'var(--bodhion-text-secondary)' }}
                >
                  <Settings2 className="h-4 w-4" />
                </button>

                {/* Context menu */}
                <RowMenu
                  func={func}
                  onEdit={() => router.push(`${routePrefix}/edit?id=${encodeURIComponent(func.id)}`)}
                  onClone={() => handleClone(func)}
                  onExport={() => handleExportOne(func)}
                  onDelete={() => setDeleteTarget(func)}
                  onToggleGlobal={() => handleToggleGlobal(func)}
                />

                {/* Active toggle */}
                <Switch
                  checked={func.is_active}
                  onCheckedChange={() => handleToggleActive(func)}
                />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Dialogs */}
      <ConfirmDialog
        open={showImportWarn}
        title="Import function"
        confirmLabel="I understand, continue"
        variant="default"
        description=""
        onConfirm={() => { setShowImportWarn(false); handleImportFiles(); }}
        onCancel={() => { setShowImportWarn(false); setImportFiles(null); if (fileInputRef.current) fileInputRef.current.value = ''; }}
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
            I acknowledge the risks associated with executing arbitrary code and have verified the trustworthiness of the source.
          </p>
        </div>
      </ConfirmDialog>

      <ConfirmDialog
        open={!!deleteTarget}
        title={`Delete "${deleteTarget?.name}"?`}
        description="This action cannot be undone."
        confirmLabel="Delete"
        variant="destructive"
        loading={deleteLoading}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />

      <ValvesModal
        func={valvesFunc}
        onClose={() => setValvesFunc(null)}
      />
    </>
  );
}

export default FunctionList;
