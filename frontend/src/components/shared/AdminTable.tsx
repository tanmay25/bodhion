'use client';

import * as React from 'react';
import { ChevronUp, ChevronDown, ChevronsUpDown } from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import { Spinner } from '@/components/ui/Spinner';

export interface AdminColumn<T> {
  key: string;
  label: string;
  sortable?: boolean;
  className?: string;
  headerClassName?: string;
  render: (row: T, index: number) => React.ReactNode;
}

interface AdminTableProps<T> {
  columns: AdminColumn<T>[];
  rows: T[];
  getRowKey: (row: T) => string;
  sortBy?: string;
  sortDir?: 'asc' | 'desc';
  onSort?: (key: string) => void;
  loading?: boolean;
  emptyTitle?: string;
  emptyDescription?: string;
  onRowClick?: (row: T) => void;
  className?: string;
}

export function AdminTable<T>({
  columns,
  rows,
  getRowKey,
  sortBy,
  sortDir,
  onSort,
  loading = false,
  emptyTitle = 'No results found',
  emptyDescription,
  onRowClick,
  className,
}: AdminTableProps<T>) {
  const SortIcon = ({ colKey }: { colKey: string }) => {
    if (sortBy !== colKey)
      return <ChevronsUpDown className="h-3 w-3 opacity-40 shrink-0" />;
    return sortDir === 'asc' ? (
      <ChevronUp className="h-3 w-3 shrink-0" />
    ) : (
      <ChevronDown className="h-3 w-3 shrink-0" />
    );
  };

  return (
    <div className={cn('relative overflow-hidden rounded-xl admin-table-wrap', className)}>
      {loading && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/30 backdrop-blur-[2px]">
          <Spinner size="md" />
        </div>
      )}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="admin-table-head">
              {columns.map((col) => (
                <th
                  key={col.key}
                  onClick={() => col.sortable && onSort?.(col.key)}
                  className={cn(
                    'px-4 py-3 text-left text-xs font-medium uppercase tracking-wide',
                    col.sortable && onSort && 'cursor-pointer select-none transition-colors',
                    col.headerClassName
                  )}
                  style={{ color: 'var(--bodhion-text-secondary)' }}
                >
                  <span className="inline-flex items-center gap-1">
                    {col.label}
                    {col.sortable && onSort && <SortIcon colKey={col.key} />}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {!loading && rows.length === 0 ? (
              <tr>
                <td colSpan={columns.length}>
                  <div className="flex flex-col items-center justify-center gap-2 py-14 text-center">
                    <p className="text-sm font-medium" style={{ color: 'var(--bodhion-text-secondary)' }}>{emptyTitle}</p>
                    {emptyDescription && (
                      <p className="text-xs opacity-60" style={{ color: 'var(--bodhion-text-secondary)' }}>{emptyDescription}</p>
                    )}
                  </div>
                </td>
              </tr>
            ) : (
              rows.map((row, i) => (
                <tr
                  key={getRowKey(row)}
                  onClick={() => onRowClick?.(row)}
                  className={cn(
                    'admin-table-row',
                    onRowClick && 'cursor-pointer'
                  )}
                >
                  {columns.map((col) => (
                    <td key={col.key} className={cn('px-4 py-3 align-middle', col.className)}>
                      {col.render(row, i)}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default AdminTable;
