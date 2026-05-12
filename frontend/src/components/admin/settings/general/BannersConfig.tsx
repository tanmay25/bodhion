'use client';

import { Plus, X } from 'lucide-react';
import { SettingsSection } from '@/components/shared/SettingsSection';
import { Button } from '@/components/ui/Button';
import type { Banner } from '@/lib/api/admin/settings';

const TYPE_STYLE: Record<string, string> = {
  info:    'bg-blue-500/10 border-blue-500/30',
  success: 'bg-green-500/10 border-green-500/30',
  warning: 'bg-yellow-500/10 border-yellow-500/30',
  error:   'bg-red-500/10 border-red-500/30',
};

interface Props {
  banners:  Banner[];
  onChange: (banners: Banner[]) => void;
  onSave:   () => void;
  saving:   boolean;
}

export function BannersConfig({ banners, onChange, onSave, saving }: Props) {
  const addBanner = () => {
    if (banners.length > 0 && banners.at(-1)!.content === '') return;
    onChange([
      ...banners,
      {
        id:          crypto.randomUUID(),
        type:        'info',
        title:       '',
        content:     '',
        dismissible: true,
        timestamp:   Math.floor(Date.now() / 1000),
      },
    ]);
  };

  const update = (idx: number, patch: Partial<Banner>) =>
    onChange(banners.map((b, i) => (i === idx ? { ...b, ...patch } : b)));

  const remove = (idx: number) =>
    onChange(banners.filter((_, i) => i !== idx));

  return (
    <SettingsSection
      title="Banners"
      description="System-wide banners shown at the top of the chat interface."
      onSave={onSave}
      saving={saving}
    >
      <div className="flex flex-col gap-2">
        {banners.map((banner, idx) => (
          <div
            key={banner.id}
            className={`flex items-start gap-2 rounded-lg border px-3 py-2 ${TYPE_STYLE[banner.type] ?? ''}`}
          >
            {/* Type */}
            <select
              value={banner.type}
              onChange={(e) => update(idx, { type: e.target.value as Banner['type'] })}
              className="admin-select h-7 shrink-0 rounded px-1 text-xs"
            >
              <option value="info">Info</option>
              <option value="warning">Warning</option>
              <option value="error">Error</option>
              <option value="success">Success</option>
            </select>

            {/* Content */}
            <textarea
              rows={1}
              value={banner.content}
              onChange={(e) => update(idx, { content: e.target.value })}
              placeholder="Banner content…"
              className="admin-input min-h-[28px] flex-1 resize-none rounded px-2 py-1 text-xs"
            />

            {/* Dismissible */}
            <label className="flex shrink-0 items-center gap-1.5 text-xs" style={{ color: 'var(--bodhion-text-secondary)' }}>
              <input
                type="checkbox"
                checked={banner.dismissible}
                onChange={(e) => update(idx, { dismissible: e.target.checked })}
                className="h-3.5 w-3.5 rounded"
                style={{ accentColor: 'var(--bodhion-accent)' }}
              />
              Dismissible
            </label>

            {/* Remove */}
            <button
              type="button"
              onClick={() => remove(idx)}
              className="shrink-0 rounded p-0.5 opacity-60 transition-opacity hover:opacity-100"
              style={{ color: 'var(--bodhion-text-secondary)' }}
              aria-label="Remove banner"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
      </div>

      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={addBanner}
        className="mt-1"
      >
        <Plus className="mr-1.5 h-3.5 w-3.5" />
        Add Banner
      </Button>
    </SettingsSection>
  );
}

export default BannersConfig;
