'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { getToken } from '@/lib/auth/session';
import {
  getFunctionValvesSpec,
  getFunctionValves,
  updateFunctionValves,
  type AdminFunction,
  type ValveSpec,
} from '@/lib/api/admin/functions';

interface ValvesModalProps {
  func:    AdminFunction | null;
  onClose: () => void;
}

const FIELD_CLS = 'admin-input h-9 w-full rounded-md px-3 text-sm';

function ValveField({
  name,
  spec,
  value,
  onChange,
}: {
  name:     string;
  spec:     ValveSpec['properties'][string];
  value:    unknown;
  onChange: (v: unknown) => void;
}) {
  const label = spec.title ?? name;
  const desc  = spec.description;

  // Boolean
  if (spec.type === 'boolean') {
    return (
      <div className="flex items-center justify-between gap-3">
        <div className="flex flex-col">
          <span className="text-sm font-medium" style={{ color: 'var(--bodhion-text-primary)' }}>{label}</span>
          {desc && <span className="text-xs" style={{ color: 'var(--bodhion-text-secondary)' }}>{desc}</span>}
        </div>
        <input
          type="checkbox"
          checked={!!value}
          onChange={(e) => onChange(e.target.checked)}
          className="h-4 w-4 rounded accent-[rgba(37,215,255,0.9)] cursor-pointer"
        />
      </div>
    );
  }

  // Enum / select
  if (spec.enum?.length) {
    return (
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium" style={{ color: 'var(--bodhion-text-primary)' }}>{label}</label>
        {desc && <span className="text-xs" style={{ color: 'var(--bodhion-text-secondary)' }}>{desc}</span>}
        <select
          value={String(value ?? '')}
          onChange={(e) => onChange(e.target.value)}
          className="admin-select h-9 w-full rounded-md px-3 text-sm"
        >
          {spec.enum.map((opt) => (
            <option key={opt} value={opt}>{opt}</option>
          ))}
        </select>
      </div>
    );
  }

  // Integer / number
  if (spec.type === 'integer' || spec.type === 'number') {
    return (
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium" style={{ color: 'var(--bodhion-text-primary)' }}>{label}</label>
        {desc && <span className="text-xs" style={{ color: 'var(--bodhion-text-secondary)' }}>{desc}</span>}
        <input
          type="number"
          value={value as number ?? ''}
          onChange={(e) => onChange(spec.type === 'integer' ? parseInt(e.target.value, 10) : parseFloat(e.target.value))}
          className={FIELD_CLS}
        />
      </div>
    );
  }

  // Default: string
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-sm font-medium" style={{ color: 'var(--bodhion-text-primary)' }}>{label}</label>
      {desc && <span className="text-xs" style={{ color: 'var(--bodhion-text-secondary)' }}>{desc}</span>}
      <input
        type="text"
        value={String(value ?? '')}
        onChange={(e) => onChange(e.target.value)}
        className={FIELD_CLS}
      />
    </div>
  );
}

export function ValvesModal({ func, onClose }: ValvesModalProps) {
  const open = !!func;

  const [spec,    setSpec]    = useState<ValveSpec | null>(null);
  const [values,  setValues]  = useState<Record<string, unknown>>({});
  const [loading, setLoading] = useState(false);
  const [saving,  setSaving]  = useState(false);

  useEffect(() => {
    if (!func) return;
    setLoading(true);
    const token = getToken();
    if (!token) { setLoading(false); return; }

    Promise.all([
      getFunctionValvesSpec(token, func.id),
      getFunctionValves(token, func.id),
    ])
      .then(([specRes, valuesRes]) => {
        setSpec(specRes ?? null);
        setValues((valuesRes as Record<string, unknown>) ?? {});
      })
      .catch(() => { setSpec(null); setValues({}); })
      .finally(() => setLoading(false));
  }, [func?.id]);

  const handleSave = async () => {
    if (!func) return;
    setSaving(true);
    const token = getToken();
    try {
      await updateFunctionValves(token!, func.id, values);
      toast.success('Valves saved');
      onClose();
    } catch {
      toast.error('Failed to save valves');
    } finally {
      setSaving(false);
    }
  };

  const properties = spec?.properties ?? {};
  const fields     = Object.entries(properties);

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="admin-dialog flex max-h-[90vh] flex-col sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Valves — {func?.name}</DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto pr-1">
          {loading ? (
            <div className="flex flex-col gap-4">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="flex flex-col gap-1.5">
                  <div className="h-4 w-24 animate-pulse rounded" style={{ background: 'var(--bodhion-search-bg)' }} />
                  <div className="h-9 w-full animate-pulse rounded" style={{ background: 'var(--bodhion-search-bg)' }} />
                </div>
              ))}
            </div>
          ) : fields.length === 0 ? (
            <p className="py-4 text-sm text-center" style={{ color: 'var(--bodhion-text-secondary)' }}>
              No configurable valves for this function.
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
            <Button onClick={handleSave} disabled={saving}>
              {saving ? 'Saving…' : 'Save'}
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}

export default ValvesModal;
