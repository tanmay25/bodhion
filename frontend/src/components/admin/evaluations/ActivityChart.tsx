'use client';

import { useEffect, useRef } from 'react';
import type { ModelHistoryItem } from '@/lib/api/admin/evaluations';

interface ActivityChartProps {
  history:         ModelHistoryItem[];
  loading:         boolean;
  aggregateWeekly: boolean;
}

/** Aggregate daily rows into ISO-week buckets (Monday key). */
function toWeekly(daily: ModelHistoryItem[]): ModelHistoryItem[] {
  const map: Record<string, ModelHistoryItem> = {};
  daily.forEach(({ date, won, lost }) => {
    const d   = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    const mon  = new Date(d);
    mon.setDate(diff);
    const key = mon.toISOString().split('T')[0];
    if (!map[key]) map[key] = { date: key, won: 0, lost: 0 };
    map[key].won  += won;
    map[key].lost += lost;
  });
  return Object.values(map).sort((a, b) => a.date.localeCompare(b.date));
}

export function ActivityChart({ history, loading, aggregateWeekly }: ActivityChartProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chartRef  = useRef<unknown>(null);

  useEffect(() => {
    if (!canvasRef.current || !history.length || loading) return;

    let cancelled = false;

    import('chart.js').then(({
      Chart,
      BarController,
      BarElement,
      CategoryScale,
      LinearScale,
      Tooltip,
    }) => {
      if (cancelled || !canvasRef.current) return;

      Chart.register(BarController, BarElement, CategoryScale, LinearScale, Tooltip);

      if (chartRef.current) (chartRef.current as { destroy(): void }).destroy();

      const rows = (aggregateWeekly && history.length > 7) ? toWeekly(history) : history;

      const labels  = rows.map(({ date }) =>
        new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
      );
      const wonData  = rows.map((r) => r.won);
      const lostData = rows.map((r) => -r.lost);   // negative → below zero

      const barPct = aggregateWeekly ? 0.95 : 0.9;
      const catPct = aggregateWeekly ? 1.0  : 0.95;

      chartRef.current = new Chart(canvasRef.current, {
        type: 'bar',
        data: {
          labels,
          datasets: [
            {
              label:           'Won',
              data:            wonData,
              backgroundColor: 'rgba(52,211,153,0.75)',
              borderRadius:    2,
              barPercentage:   barPct,
              categoryPercentage: catPct,
            },
            {
              label:           'Lost',
              data:            lostData,
              backgroundColor: 'rgba(248,113,113,0.75)',
              borderRadius:    2,
              barPercentage:   barPct,
              categoryPercentage: catPct,
            },
          ],
        },
        options: {
          responsive:          true,
          maintainAspectRatio: false,
          interaction: { intersect: false, mode: 'index' },
          plugins: {
            legend: { display: false },
            tooltip: {
              backgroundColor: 'rgba(7,21,36,0.92)',
              borderColor:     'rgba(37,215,255,0.2)',
              borderWidth:     1,
              titleColor:      '#eaf6ff',
              bodyColor:       '#8fa9bd',
              padding:         8,
              cornerRadius:    8,
              callbacks: {
                label: (ctx) => `${ctx.dataset.label}: ${Math.abs(ctx.raw as number)}`,
              },
            },
          },
          scales: {
            x: {
              stacked: true,
              grid:    { display: false },
              ticks:   { display: false },
              border:  { display: false },
            },
            y: {
              stacked: true,
              grid:    { color: 'rgba(143,169,189,0.08)', drawTicks: false },
              ticks: {
                color:     'rgba(143,169,189,0.7)',
                font:      { size: 10 },
                padding:   8,
                stepSize:  1,
                precision: 0,
                callback:  (v) => Math.abs(v as number),
              },
              border: { display: false },
            },
          },
          animation: { duration: 300, easing: 'easeOutQuart' },
        },
      });
    });

    return () => {
      cancelled = true;
      if (chartRef.current) {
        (chartRef.current as { destroy(): void }).destroy();
        chartRef.current = null;
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify({ history, aggregateWeekly }), loading]);

  if (loading) {
    return (
      <div
        className="flex h-40 items-center justify-center rounded-lg"
        style={{ background: 'var(--bodhion-search-bg)' }}
      >
        <span className="text-sm animate-pulse" style={{ color: 'var(--bodhion-text-secondary)' }}>
          Loading…
        </span>
      </div>
    );
  }

  const empty = !history.length || history.every((h) => h.won === 0 && h.lost === 0);
  if (empty) {
    return (
      <div
        className="flex h-40 items-center justify-center rounded-lg text-sm"
        style={{ color: 'var(--bodhion-text-secondary)', background: 'var(--bodhion-search-bg)' }}
      >
        No activity data.
      </div>
    );
  }

  return (
    <div style={{ height: 160, position: 'relative' }}>
      <canvas ref={canvasRef} />
    </div>
  );
}

export default ActivityChart;
