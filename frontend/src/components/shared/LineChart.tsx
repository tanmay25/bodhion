'use client';

import { useEffect, useRef } from 'react';

export interface LineChartDataset {
  label:           string;
  data:            number[];
  borderColor:     string;
  backgroundColor: string;
}

interface LineChartProps {
  labels:   string[];
  datasets: LineChartDataset[];
  height?:  number;
}

/**
 * Thin Chart.js canvas wrapper.
 * Uses a dynamic import so Chart.js never runs on the server.
 */
export function LineChart({ labels, datasets, height = 280 }: LineChartProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  // Keep a ref to the Chart instance so we can destroy it before re-creating
  const chartRef  = useRef<unknown>(null);

  useEffect(() => {
    if (!canvasRef.current) return;

    let cancelled = false;

    import('chart.js').then(
      ({
        Chart,
        LineController,
        CategoryScale,
        LinearScale,
        PointElement,
        LineElement,
        Tooltip,
        Legend,
        Filler,
      }) => {
        if (cancelled) return;

        Chart.register(
          LineController,
          CategoryScale,
          LinearScale,
          PointElement,
          LineElement,
          Tooltip,
          Legend,
          Filler
        );

        // Destroy previous instance
        if (chartRef.current) {
          (chartRef.current as { destroy(): void }).destroy();
        }

        chartRef.current = new Chart(canvasRef.current!, {
          type: 'line',
          data: { labels, datasets },
          options: {
            responsive:          true,
            maintainAspectRatio: false,
            interaction: { mode: 'index', intersect: false },
            plugins: {
              legend: {
                display:  true,
                position: 'bottom',
                labels: {
                  color:     'rgba(143,169,189,0.9)',
                  boxWidth:  12,
                  boxHeight: 2,
                  padding:   12,
                  font:      { size: 11 },
                },
              },
              tooltip: {
                backgroundColor: 'rgba(7,21,36,0.92)',
                borderColor:     'rgba(37,215,255,0.2)',
                borderWidth:     1,
                titleColor:      '#eaf6ff',
                bodyColor:       '#8fa9bd',
                padding:         10,
                cornerRadius:    8,
              },
            },
            scales: {
              x: {
                grid:   { color: 'rgba(143,169,189,0.08)' },
                ticks:  { color: 'rgba(143,169,189,0.7)', font: { size: 11 }, maxRotation: 0 },
                border: { color: 'rgba(143,169,189,0.12)' },
              },
              y: {
                beginAtZero: true,
                grid:        { color: 'rgba(143,169,189,0.08)' },
                ticks:       { color: 'rgba(143,169,189,0.7)', font: { size: 11 } },
                border:      { color: 'rgba(143,169,189,0.12)' },
              },
            },
          },
        });
      }
    );

    return () => {
      cancelled = true;
      if (chartRef.current) {
        (chartRef.current as { destroy(): void }).destroy();
        chartRef.current = null;
      }
    };
  // Stringify to detect deep changes without triggering on every render
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify({ labels, datasets })]);

  return (
    <div style={{ height, position: 'relative' }}>
      <canvas ref={canvasRef} />
    </div>
  );
}

export default LineChart;
