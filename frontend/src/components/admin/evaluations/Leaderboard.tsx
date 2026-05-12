'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { Search, ArrowUpDown } from 'lucide-react';
import { toast } from 'sonner';
import { getToken } from '@/lib/auth/session';
import {
  getLeaderboard,
  type LeaderboardEntry,
} from '@/lib/api/admin/evaluations';
import { LeaderboardModal } from './modals/LeaderboardModal';

type SortKey = 'rank' | 'name' | 'rating' | 'won' | 'lost';

interface RankedModel {
  id:       string;
  name:     string;
  imageUrl: string;
  rating:   number | null;
  won:      number;
  lost:     number;
  top_tags: { tag: string; count: number }[];
}

function SkeletonRow() {
  return (
    <tr className="admin-table-row">
      {[1, 2, 3, 4, 5].map((i) => (
        <td key={i} className="px-3 py-2">
          <div
            className="h-4 animate-pulse rounded"
            style={{ width: i === 2 ? '60%' : '25%', background: 'var(--bodhion-search-bg)' }}
          />
        </td>
      ))}
    </tr>
  );
}

export function Leaderboard() {
  const [models,   setModels]   = useState<RankedModel[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [query,    setQuery]    = useState('');
  const [sortKey,  setSortKey]  = useState<SortKey>('rating');
  const [sortAsc,  setSortAsc]  = useState(false);
  const [selected, setSelected] = useState<RankedModel | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async (q: string) => {
    setLoading(true);
    const token = getToken();
    if (!token) { setLoading(false); return; }
    try {
      const res = await getLeaderboard(token, q);
      const entries: LeaderboardEntry[] = res?.entries ?? [];
      // Build ranked list from entries (backend already provides model_id + stats)
      const ranked: RankedModel[] = entries.map((e) => ({
        id:       e.model_id,
        name:     e.model_id,
        imageUrl: `/api/v1/models/model/profile/image?id=${encodeURIComponent(e.model_id)}`,
        rating:   e.rating,
        won:      e.won,
        lost:     e.lost,
        top_tags: e.top_tags ?? [],
      }));

      setModels(ranked);
    } catch {
      toast.error('Failed to load leaderboard');
    } finally {
      setLoading(false);
    }
  }, []);

  // Debounced search
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => load(query), 400);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query, load]);

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortAsc((a) => !a);
    else { setSortKey(key); setSortAsc(key === 'name'); }
  }

  const sorted = [...models].sort((a, b) => {
    let v = 0;
    if (sortKey === 'name')   v = a.name.localeCompare(b.name);
    else if (sortKey === 'rating') v = (a.rating ?? -Infinity) - (b.rating ?? -Infinity);
    else if (sortKey === 'won')    v = a.won  - b.won;
    else if (sortKey === 'lost')   v = a.lost - b.lost;
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

  const thCls = 'admin-table-head px-3 py-2 text-xs font-medium uppercase tracking-wide select-none cursor-pointer whitespace-nowrap';

  return (
    <>
      {/* Header */}
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <h2 className="text-base font-semibold" style={{ color: 'var(--bodhion-text-primary)' }}>
            Leaderboard
          </h2>
          {!loading && (
            <span className="text-sm" style={{ color: 'var(--bodhion-text-secondary)' }}>
              {models.length}
            </span>
          )}
        </div>

        {/* Search — re-ranks by topic similarity */}
        <div className="relative w-56">
          <Search
            className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2"
            style={{ color: 'var(--bodhion-text-secondary)' }}
          />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Re-rank by topic…"
            className="admin-input h-9 w-full rounded-md pl-8 pr-3 text-sm"
          />
        </div>
      </div>

      {/* Table */}
      <div className="admin-table-wrap overflow-x-auto rounded-lg">
        <table className="w-full text-sm">
          <thead>
            <tr>
              <th className={thCls} onClick={() => toggleSort('rank')}>
                RK <SortIcon col="rank" />
              </th>
              <th className={`${thCls} text-left`} onClick={() => toggleSort('name')}>
                Model <SortIcon col="name" />
              </th>
              <th className={`${thCls} text-right`} onClick={() => toggleSort('rating')}>
                Rating <SortIcon col="rating" />
              </th>
              <th className={`${thCls} text-right`} onClick={() => toggleSort('won')}>
                Won <SortIcon col="won" />
              </th>
              <th className={`${thCls} text-right`} onClick={() => toggleSort('lost')}>
                Lost <SortIcon col="lost" />
              </th>
            </tr>
          </thead>
          <tbody>
            {loading
              ? Array.from({ length: 6 }).map((_, i) => <SkeletonRow key={i} />)
              : sorted.length === 0
              ? (
                <tr>
                  <td colSpan={5} className="px-3 py-6 text-center text-sm" style={{ color: 'var(--bodhion-text-secondary)' }}>
                    No models found.
                  </td>
                </tr>
              )
              : sorted.map((model, idx) => {
                const total = model.won + model.lost;
                const wonPct  = total > 0 ? ((model.won  / total) * 100).toFixed(1) : null;
                const lostPct = total > 0 ? ((model.lost / total) * 100).toFixed(1) : null;
                return (
                  <tr
                    key={model.id}
                    className="admin-table-row group cursor-pointer"
                    onClick={() => setSelected(model)}
                  >
                    {/* Rank */}
                    <td className="px-3 py-2 font-medium" style={{ color: 'var(--bodhion-text-primary)' }}>
                      {model.rating != null ? idx + 1 : '—'}
                    </td>
                    {/* Model */}
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-2">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={model.imageUrl}
                          alt={model.name}
                          className="h-5 w-5 rounded-full object-cover shrink-0"
                          onError={(e) => { (e.currentTarget as HTMLImageElement).src = '/favicon.png'; }}
                        />
                        <span className="font-medium line-clamp-1" style={{ color: 'var(--bodhion-text-primary)' }}>
                          {model.name}
                        </span>
                      </div>
                    </td>
                    {/* Rating */}
                    <td className="px-3 py-2 text-right font-medium tabular-nums" style={{ color: 'var(--bodhion-text-primary)' }}>
                      {model.rating != null ? model.rating : '—'}
                    </td>
                    {/* Won */}
                    <td className="px-3 py-2 text-right tabular-nums" style={{ color: 'rgba(52,211,153,0.9)' }}>
                      {model.won === 0 && model.lost === 0 ? '—' : (
                        <>
                          <span className="group-hover:hidden">{model.won}</span>
                          <span className="hidden group-hover:inline">{wonPct}%</span>
                        </>
                      )}
                    </td>
                    {/* Lost */}
                    <td className="px-3 py-2 text-right tabular-nums" style={{ color: 'rgba(248,113,113,0.9)' }}>
                      {model.won === 0 && model.lost === 0 ? '—' : (
                        <>
                          <span className="group-hover:hidden">{model.lost}</span>
                          <span className="hidden group-hover:inline">{lostPct}%</span>
                        </>
                      )}
                    </td>
                  </tr>
                );
              })}
          </tbody>
        </table>
      </div>

      {/* Footer note */}
      <p className="mt-3 text-right text-xs" style={{ color: 'var(--bodhion-text-secondary)' }}>
        ⓘ Leaderboard is based on the Elo rating system and updates in real-time. Currently in beta.
      </p>

      <LeaderboardModal model={selected} onClose={() => setSelected(null)} />
    </>
  );
}

export default Leaderboard;
