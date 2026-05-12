'use client';

import { useState } from 'react';
import { ArrowUpDown } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/Avatar';
import type { UserAnalyticsItem } from '@/lib/api/admin/analytics';

interface UserUsageTableProps {
  data:    UserAnalyticsItem[];
  loading: boolean;
}

type SortKey = 'name' | 'count' | 'total_tokens';

function userInitials(name?: string, email?: string) {
  const label = name ?? email ?? '?';
  return label.split(' ').slice(0, 2).map((w) => w[0]).join('').toUpperCase();
}

function SkeletonRow() {
  return (
    <tr className="admin-table-row">
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="h-7 w-7 animate-pulse rounded-full" style={{ background: 'var(--bodhion-search-bg)' }} />
          <div className="h-4 w-32 animate-pulse rounded" style={{ background: 'var(--bodhion-search-bg)' }} />
        </div>
      </td>
      {[1, 2].map((i) => (
        <td key={i} className="px-4 py-3">
          <div className="h-4 w-16 animate-pulse rounded" style={{ background: 'var(--bodhion-search-bg)' }} />
        </td>
      ))}
    </tr>
  );
}

export function UserUsageTable({ data, loading }: UserUsageTableProps) {
  const [sortKey, setSortKey] = useState<SortKey>('count');
  const [sortAsc, setSortAsc] = useState(false);

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortAsc((a) => !a);
    else { setSortKey(key); setSortAsc(false); }
  }

  const sorted = [...data].sort((a, b) => {
    let v = 0;
    if (sortKey === 'name')
      v = (a.name ?? a.email ?? '').localeCompare(b.name ?? b.email ?? '');
    else if (sortKey === 'count')
      v = a.count - b.count;
    else
      v = (a.total_tokens ?? 0) - (b.total_tokens ?? 0);
    return sortAsc ? v : -v;
  });

  function SortIcon({ col }: { col: SortKey }) {
    if (sortKey !== col) return <ArrowUpDown className="ml-1 inline h-3 w-3 opacity-40" />;
    return (
      <span className="ml-1 inline-block text-[10px] leading-none" style={{ color: 'rgba(37,215,255,0.9)' }}>
        {sortAsc ? '▲' : '▼'}
      </span>
    );
  }

  const thCls = 'admin-table-head px-4 py-2 text-left text-xs font-medium uppercase tracking-wide select-none cursor-pointer whitespace-nowrap';

  return (
    <div className="admin-card flex flex-col gap-3 rounded-xl p-4">
      <h3 className="text-sm font-semibold" style={{ color: 'var(--bodhion-text-primary)' }}>
        Top Users
      </h3>
      <div className="admin-table-wrap overflow-x-auto rounded-lg">
        <table className="w-full text-sm">
          <thead>
            <tr>
              <th className={thCls} onClick={() => toggleSort('name')}>
                User <SortIcon col="name" />
              </th>
              <th className={thCls} onClick={() => toggleSort('count')}>
                Messages <SortIcon col="count" />
              </th>
              <th className={thCls} onClick={() => toggleSort('total_tokens')}>
                Tokens <SortIcon col="total_tokens" />
              </th>
            </tr>
          </thead>
          <tbody>
            {loading
              ? Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} />)
              : sorted.length === 0
              ? (
                <tr>
                  <td colSpan={3} className="px-4 py-6 text-center text-sm" style={{ color: 'var(--bodhion-text-secondary)' }}>
                    No user data for this period.
                  </td>
                </tr>
              )
              : sorted.map((row) => (
                <tr key={row.user_id} className="admin-table-row">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Avatar className="h-7 w-7 text-xs">
                        <AvatarImage src={undefined} alt={row.name} />
                        <AvatarFallback>{userInitials(row.name, row.email)}</AvatarFallback>
                      </Avatar>
                      <div className="flex flex-col">
                        <span className="font-medium leading-none" style={{ color: 'var(--bodhion-text-primary)' }}>
                          {row.name ?? row.email ?? row.user_id}
                        </span>
                        {row.name && row.email && (
                          <span className="mt-0.5 text-xs leading-none" style={{ color: 'var(--bodhion-text-secondary)' }}>
                            {row.email}
                          </span>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 tabular-nums" style={{ color: 'var(--bodhion-text-secondary)' }}>
                    {row.count.toLocaleString()}
                  </td>
                  <td className="px-4 py-3 tabular-nums" style={{ color: 'var(--bodhion-text-secondary)' }}>
                    {row.total_tokens != null ? row.total_tokens.toLocaleString() : '—'}
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default UserUsageTable;
