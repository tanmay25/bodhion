'use client';

import { ArrowUpDown, ExternalLink } from 'lucide-react';
import { useState } from 'react';
import type { ModelAnalyticsItem } from '@/lib/api/admin/analytics';

interface ModelUsageTableProps {
  data:      ModelAnalyticsItem[];
  tokenMap?: Record<string, number>;
  loading:   boolean;
  onSelect?: (modelId: string) => void;
}

type SortKey = 'name' | 'count' | 'total_tokens';

function SkeletonRow() {
  return (
    <tr className="admin-table-row">
      {[1, 2, 3].map((i) => (
        <td key={i} className="px-4 py-3">
          <div
            className="h-4 animate-pulse rounded"
            style={{ width: i === 1 ? '60%' : '30%', background: 'var(--bodhion-search-bg)' }}
          />
        </td>
      ))}
    </tr>
  );
}

export function ModelUsageTable({ data, tokenMap = {}, loading, onSelect }: ModelUsageTableProps) {
  const [sortKey, setSortKey]   = useState<SortKey>('count');
  const [sortAsc, setSortAsc]   = useState(false);

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortAsc((a) => !a);
    else { setSortKey(key); setSortAsc(false); }
  }

  const sorted = [...data].sort((a, b) => {
    let v = 0;
    if (sortKey === 'name')       v = (a.name ?? a.model_id).localeCompare(b.name ?? b.model_id);
    else if (sortKey === 'count') v = a.count - b.count;
    else                          v = (tokenMap[a.model_id] ?? 0) - (tokenMap[b.model_id] ?? 0);
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
        Model Usage
      </h3>
      <div className="admin-table-wrap overflow-x-auto rounded-lg">
        <table className="w-full text-sm">
          <thead>
            <tr>
              <th className={thCls} onClick={() => toggleSort('name')}>
                Model <SortIcon col="name" />
              </th>
              <th className={thCls} onClick={() => toggleSort('count')}>
                Messages <SortIcon col="count" />
              </th>
              <th className={thCls} onClick={() => toggleSort('total_tokens')}>
                Tokens <SortIcon col="total_tokens" />
              </th>
              <th className="admin-table-head px-4 py-2 text-right text-xs font-medium uppercase tracking-wide w-10" />
            </tr>
          </thead>
          <tbody>
            {loading
              ? Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} />)
              : sorted.length === 0
              ? (
                <tr>
                  <td colSpan={4} className="px-4 py-6 text-center text-sm" style={{ color: 'var(--bodhion-text-secondary)' }}>
                    No model data for this period.
                  </td>
                </tr>
              )
              : sorted.map((row) => (
                <tr key={row.model_id} className="admin-table-row">
                  <td className="px-4 py-3 font-medium" style={{ color: 'var(--bodhion-text-primary)' }}>
                    {row.name ?? row.model_id}
                  </td>
                  <td className="px-4 py-3 tabular-nums" style={{ color: 'var(--bodhion-text-secondary)' }}>
                    {row.count.toLocaleString()}
                  </td>
                  <td className="px-4 py-3 tabular-nums" style={{ color: 'var(--bodhion-text-secondary)' }}>
                    {tokenMap[row.model_id] != null ? tokenMap[row.model_id].toLocaleString() : '—'}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {onSelect && (
                      <button
                        onClick={() => onSelect(row.model_id)}
                        className="rounded p-1 transition-colors hover:text-[rgba(37,215,255,0.9)]"
                        style={{ color: 'var(--bodhion-text-secondary)' }}
                        title="View details"
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default ModelUsageTable;
