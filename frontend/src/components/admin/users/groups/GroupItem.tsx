'use client';

import { Users, MoreHorizontal, Pencil, Trash2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/Button';
import type { Group } from '@/types/api';

interface GroupItemProps {
  group: Group;
  onEdit:   (g: Group) => void;
  onDelete: (g: Group) => void;
}

export function GroupItem({ group, onEdit, onDelete }: GroupItemProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [menuOpen]);

  const memberCount = group.user_ids?.length ?? 0;

  return (
    <div className="admin-card flex flex-col gap-3 rounded-xl p-4">
      {/* Header row */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Users className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <p className="truncate font-semibold text-foreground">{group.name}</p>
            {group.description && (
              <p className="truncate text-xs text-muted-foreground">{group.description}</p>
            )}
          </div>
        </div>

        {/* Action menu */}
        <div ref={menuRef} className="relative shrink-0">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => setMenuOpen((v) => !v)}
            aria-label="Group actions"
          >
            <MoreHorizontal className="h-4 w-4" />
          </Button>
          {menuOpen && (
            <div className="absolute right-0 z-20 mt-1 w-36 rounded-lg border border-border bg-popover py-1 shadow-lg">
              <button
                className="flex w-full items-center gap-2 px-3 py-1.5 text-sm hover:bg-muted/50 transition-colors"
                onClick={() => { setMenuOpen(false); onEdit(group); }}
              >
                <Pencil className="h-3.5 w-3.5 text-muted-foreground" /> Edit group
              </button>
              <div className="my-1 border-t border-border" />
              <button
                className="flex w-full items-center gap-2 px-3 py-1.5 text-sm text-destructive hover:bg-destructive/10 transition-colors"
                onClick={() => { setMenuOpen(false); onDelete(group); }}
              >
                <Trash2 className="h-3.5 w-3.5" /> Delete
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Footer: member count */}
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Users className="h-3.5 w-3.5" />
        <span>
          {memberCount} {memberCount === 1 ? 'member' : 'members'}
        </span>
      </div>
    </div>
  );
}

export default GroupItem;
