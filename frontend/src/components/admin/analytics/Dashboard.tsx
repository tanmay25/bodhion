'use client';

import { useEffect, useState, useCallback } from 'react';
import { getToken } from '@/lib/auth/session';
import {
  getAnalyticsSummary,
  getModelAnalytics,
  getUserAnalytics,
  getDailyStats,
  getTokenUsage,
  periodToParams,
  type AnalyticsSummary,
  type ModelAnalyticsItem,
  type UserAnalyticsItem,
  type DailyStatsItem,
  type AnalyticsPeriod,
} from '@/lib/api/admin/analytics';
import { SummaryCards }        from './SummaryCards';
import { DailyStatsChart }     from './DailyStatsChart';
import { ModelUsageTable }     from './ModelUsageTable';
import { UserUsageTable }      from './UserUsageTable';
import { ModelAnalyticsModal } from './modals/ModelAnalyticsModal';

const PERIODS: { label: string; value: AnalyticsPeriod }[] = [
  { label: 'Last 24 h', value: '24h' },
  { label: 'Last 7 d',  value: '7d'  },
  { label: 'Last 30 d', value: '30d' },
  { label: 'Last 90 d', value: '90d' },
  { label: 'All time',  value: 'all' },
];

export function AnalyticsDashboard() {
  const [period,    setPeriod]    = useState<AnalyticsPeriod>('30d');
  const [summary,   setSummary]   = useState<AnalyticsSummary | null>(null);
  const [models,    setModels]    = useState<ModelAnalyticsItem[]>([]);
  const [users,     setUsers]     = useState<UserAnalyticsItem[]>([]);
  const [daily,     setDaily]     = useState<DailyStatsItem[]>([]);
  const [tokenMap,    setTokenMap]    = useState<Record<string, number>>({});
  const [totalTokens, setTotalTokens] = useState({ input: 0, output: 0, total: 0 });
  const [granularity, setGranularity] = useState<'hourly' | 'daily'>('daily');
  const [loading,     setLoading]     = useState(false);
  const [selectedModel, setSelectedModel] = useState<string | null>(null);

  const fetchAll = useCallback(async () => {
    const token = getToken();
    if (!token) return;

    setLoading(true);
    const { startDate, endDate, granularity: gran } = periodToParams(period);
    const params = { startDate, endDate };
    setGranularity(gran);

    try {
      const [summaryRes, modelsRes, usersRes, dailyRes, tokensRes] = await Promise.allSettled([
        getAnalyticsSummary(token, params),
        getModelAnalytics(token, params),
        getUserAnalytics(token, { ...params, limit: 50 }),
        getDailyStats(token, { ...params, granularity: gran }),
        getTokenUsage(token, params),
      ]);

      if (summaryRes.status === 'fulfilled') setSummary(summaryRes.value);
      if (modelsRes.status  === 'fulfilled') setModels(modelsRes.value.models ?? []);
      if (usersRes.status   === 'fulfilled') setUsers(usersRes.value.users ?? []);
      if (dailyRes.status   === 'fulfilled') setDaily(dailyRes.value.data ?? []);
      if (tokensRes.status  === 'fulfilled') {
        const map: Record<string, number> = {};
        for (const m of tokensRes.value.models ?? []) {
          map[m.model_id] = m.total_tokens;
        }
        setTokenMap(map);
        setTotalTokens({
          input:  tokensRes.value.total_input_tokens,
          output: tokensRes.value.total_output_tokens,
          total:  tokensRes.value.total_tokens,
        });
      }
    } finally {
      setLoading(false);
    }
  }, [period]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  return (
    <div className="flex flex-col gap-6">
      {/* Period picker */}
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold" style={{ color: 'var(--bodhion-text-primary)' }}>
          Overview
        </h2>
        <div className="flex items-center gap-1 rounded-lg p-1" style={{ background: 'var(--bodhion-search-bg)', border: '1px solid var(--bodhion-search-border)' }}>
          {PERIODS.map((p) => (
            <button
              key={p.value}
              onClick={() => setPeriod(p.value)}
              className="rounded-md px-3 py-1 text-xs font-medium transition-colors"
              style={
                period === p.value
                  ? { background: 'rgba(37,215,255,0.15)', color: 'rgba(37,215,255,0.9)' }
                  : { color: 'var(--bodhion-text-secondary)' }
              }
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* Token summary banner */}
      {!loading && totalTokens.total > 0 && (
        <div
          className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-lg px-4 py-2 text-xs"
          style={{ background: 'var(--bodhion-search-bg)', border: '1px solid var(--bodhion-search-border)', color: 'var(--bodhion-text-secondary)' }}
        >
          <span>
            <span className="font-semibold tabular-nums" style={{ color: 'var(--bodhion-text-primary)' }}>
              {totalTokens.total.toLocaleString()}
            </span>{' '}total tokens
          </span>
          <span style={{ color: 'var(--bodhion-search-border)' }}>·</span>
          <span>
            <span className="font-semibold tabular-nums" style={{ color: 'var(--bodhion-text-primary)' }}>
              {totalTokens.input.toLocaleString()}
            </span>{' '}input
          </span>
          <span style={{ color: 'var(--bodhion-search-border)' }}>·</span>
          <span>
            <span className="font-semibold tabular-nums" style={{ color: 'var(--bodhion-text-primary)' }}>
              {totalTokens.output.toLocaleString()}
            </span>{' '}output
          </span>
          <span
            className="ml-auto hidden sm:inline"
            title="Token counts are estimates and may not reflect actual API billing"
            style={{ cursor: 'help' }}
          >
            ⓘ estimates
          </span>
        </div>
      )}

      {/* KPI cards */}
      <SummaryCards data={summary} loading={loading} />

      {/* Daily chart (full width) */}
      <DailyStatsChart data={daily} granularity={granularity} loading={loading} />

      {/* Tables side-by-side on lg+ */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <ModelUsageTable
          data={models}
          tokenMap={tokenMap}
          loading={loading}
          onSelect={setSelectedModel}
        />
        <UserUsageTable data={users} loading={loading} />
      </div>

      {/* Model drill-down modal */}
      <ModelAnalyticsModal
        modelId={selectedModel}
        onClose={() => setSelectedModel(null)}
      />
    </div>
  );
}

export default AnalyticsDashboard;
