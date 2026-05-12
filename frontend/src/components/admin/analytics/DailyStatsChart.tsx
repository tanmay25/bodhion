'use client';

import { useMemo } from 'react';
import { LineChart } from '@/components/shared/LineChart';
import type { DailyStatsItem } from '@/lib/api/admin/analytics';

interface DailyStatsChartProps {
  data:        DailyStatsItem[];
  loading:     boolean;
  granularity?: 'hourly' | 'daily';
}

// Consistent palette for up to 10 models
const PALETTE = [
  { border: 'rgba(37,215,255,0.9)',   bg: 'rgba(37,215,255,0.12)'  },
  { border: 'rgba(130,100,255,0.9)',  bg: 'rgba(130,100,255,0.12)' },
  { border: 'rgba(52,211,153,0.9)',   bg: 'rgba(52,211,153,0.12)'  },
  { border: 'rgba(251,146,60,0.9)',   bg: 'rgba(251,146,60,0.12)'  },
  { border: 'rgba(248,113,113,0.9)',  bg: 'rgba(248,113,113,0.12)' },
  { border: 'rgba(250,204,21,0.9)',   bg: 'rgba(250,204,21,0.12)'  },
  { border: 'rgba(192,132,252,0.9)',  bg: 'rgba(192,132,252,0.12)' },
  { border: 'rgba(34,211,238,0.9)',   bg: 'rgba(34,211,238,0.12)'  },
  { border: 'rgba(163,230,53,0.9)',   bg: 'rgba(163,230,53,0.12)'  },
  { border: 'rgba(249,168,212,0.9)',  bg: 'rgba(249,168,212,0.12)' },
];

function Skeleton({ height }: { height: number }) {
  return (
    <div
      className="w-full animate-pulse rounded-lg"
      style={{ height, background: 'var(--bodhion-search-bg)' }}
    />
  );
}

export function DailyStatsChart({ data, loading, granularity = 'daily' }: DailyStatsChartProps) {
  const { labels, datasets } = useMemo(() => {
    if (!data.length) return { labels: [], datasets: [] };

    // Collect all model IDs across all days
    const modelSet = new Set<string>();
    data.forEach((d) => Object.keys(d.models).forEach((m) => modelSet.add(m)));
    const models = Array.from(modelSet);

    const labels = data.map((d) => d.date);

    const datasets = models.map((modelId, i) => {
      const color = PALETTE[i % PALETTE.length];
      return {
        label:           modelId,
        data:            data.map((d) => d.models[modelId] ?? 0),
        borderColor:     color.border,
        backgroundColor: color.bg,
      };
    });

    return { labels, datasets };
  }, [data]);

  const title = granularity === 'hourly' ? 'Messages per Hour' : 'Messages per Day';
  const hasData = datasets.length > 0;

  return (
    <div className="admin-card flex flex-col gap-4 rounded-xl p-4">
      <h3
        className="text-sm font-semibold"
        style={{ color: 'var(--bodhion-text-primary)' }}
      >
        {title}
      </h3>
      {loading ? (
        <Skeleton height={280} />
      ) : !hasData ? (
        <div
          className="flex h-[280px] items-center justify-center text-sm"
          style={{ color: 'var(--bodhion-text-secondary)' }}
        >
          No data for this period.
        </div>
      ) : (
        <LineChart labels={labels} datasets={datasets} height={280} />
      )}
    </div>
  );
}

export default DailyStatsChart;
