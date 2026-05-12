'use client';

import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { parseMarkdownTable, numericColumnIndices, toNumber } from '@/lib/utils/tableParser';

// ── Types ─────────────────────────────────────────────────────────────────────

type ChartType = 'bar' | 'line' | 'pie';
type ViewMode  = 'table' | 'chart';

interface LegendItem {
  /** Display label (dataset name for bar/line; slice label for pie) */
  text:        string;
  fillColor:   string;
  strokeColor: string;
  /** Whether the series / slice is currently visible on the chart */
  visible:     boolean;
  /** Dataset index (bar/line) or data-point index (pie) passed to Chart.js API */
  index:       number;
}

// ── Chart colour palette (matches existing LineChart.tsx theme) ───────────────

const PALETTE = [
  { border: 'rgba(37,215,255,0.85)',   bg: 'rgba(37,215,255,0.18)' },
  { border: 'rgba(129,140,248,0.85)',  bg: 'rgba(129,140,248,0.18)' },
  { border: 'rgba(52,211,153,0.85)',   bg: 'rgba(52,211,153,0.18)' },
  { border: 'rgba(251,146,60,0.85)',   bg: 'rgba(251,146,60,0.18)' },
  { border: 'rgba(248,113,113,0.85)',  bg: 'rgba(248,113,113,0.18)' },
];

const MAX_DATASETS = 5;

// ── Minimal Chart.js instance interface (only what we call) ───────────────────

interface ChartInstance {
  destroy(): void;
  update(): void;
  /** Bar / Line: show or hide an entire dataset */
  setDatasetVisibility(datasetIndex: number, visible: boolean): void;
  isDatasetVisible(datasetIndex: number): boolean;
  /** Pie / Doughnut: toggle a single data-point's visibility */
  toggleDataVisibility(index: number): void;
  getDataVisibility(index: number): boolean;
}

// ── Canvas chart ──────────────────────────────────────────────────────────────

interface CanvasChartProps {
  labels:   string[];
  datasets: Array<{ label: string; data: number[]; borderColor: string; backgroundColor: string }>;
  chartType: ChartType;
}

function CanvasChart({ labels, datasets, chartType }: CanvasChartProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chartRef  = useRef<ChartInstance | null>(null);
  const depKey    = JSON.stringify({ labels, datasets, chartType });

  const [legendItems, setLegendItems] = useState<LegendItem[]>([]);

  // ── Build / rebuild chart on data or type change ──────────────────────────

  useEffect(() => {
    if (!canvasRef.current) return;
    let cancelled = false;

    import('chart.js').then(({
      Chart,
      BarController, LineController, PieController,
      CategoryScale, LinearScale,
      BarElement, PointElement, LineElement, ArcElement,
      Tooltip,
      // Legend plugin still registered so Chart.js internals stay happy,
      // but we set display:false — our HTML legend replaces it.
      Legend,
    }) => {
      if (cancelled || !canvasRef.current) return;

      Chart.register(
        BarController, LineController, PieController,
        CategoryScale, LinearScale,
        BarElement, PointElement, LineElement, ArcElement,
        Tooltip, Legend,
      );

      if (chartRef.current) {
        chartRef.current.destroy();
        chartRef.current = null;
      }

      const isPie     = chartType === 'pie';
      const pieColors = labels.map((_, i) => PALETTE[i % PALETTE.length].border);
      const pieBg     = labels.map((_, i) => PALETTE[i % PALETTE.length].bg);

      const chartDatasets = isPie
        ? [{ data: datasets[0]?.data ?? [], backgroundColor: pieBg, borderColor: pieColors, borderWidth: 1 }]
        : datasets.map((ds) => ({
            ...ds,
            borderWidth:  2,
            tension:      0.35,
            fill:         chartType === 'line',
            pointRadius:  chartType === 'line' ? 3 : 0,
            borderRadius: chartType === 'bar'  ? 4 : 0,
          }));

      chartRef.current = new Chart(canvasRef.current!, {
        type: chartType,
        data: { labels, datasets: chartDatasets as never },
        options: {
          responsive:          true,
          maintainAspectRatio: false,
          // Built-in legend disabled — our React HTML legend replaces it.
          plugins: {
            legend: { display: false },
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
          ...(isPie ? {} : {
            scales: {
              x: {
                grid:   { color: 'rgba(143,169,189,0.08)' },
                ticks:  { color: 'rgba(143,169,189,0.7)', font: { size: 11 }, maxRotation: 0, maxTicksLimit: 12 },
                border: { color: 'rgba(143,169,189,0.12)' },
              },
              y: {
                beginAtZero: true,
                grid:        { color: 'rgba(143,169,189,0.08)' },
                ticks:       { color: 'rgba(143,169,189,0.7)', font: { size: 11 } },
                border:      { color: 'rgba(143,169,189,0.12)' },
              },
            },
          }),
        },
      }) as unknown as ChartInstance;

      // Build HTML legend items after chart is created.
      // All items start visible — reset when chart type / data changes.
      const items: LegendItem[] = isPie
        ? labels.map((label, i) => ({
            text:        String(label),
            fillColor:   pieBg[i]     ?? PALETTE[i % PALETTE.length].bg,
            strokeColor: pieColors[i] ?? PALETTE[i % PALETTE.length].border,
            visible:     true,
            index:       i,
          }))
        : datasets.map((ds, i) => ({
            text:        ds.label,
            fillColor:   ds.backgroundColor,
            strokeColor: ds.borderColor,
            visible:     true,
            index:       i,
          }));

      setLegendItems(items);
    });

    return () => {
      cancelled = true;
      if (chartRef.current) {
        chartRef.current.destroy();
        chartRef.current = null;
      }
      setLegendItems([]);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [depKey]);

  // ── Toggle a legend item ──────────────────────────────────────────────────

  const toggleItem = useCallback((index: number) => {
    const chart = chartRef.current;
    if (!chart) return;

    if (chartType === 'pie') {
      // toggleDataVisibility flips a single arc segment on/off
      chart.toggleDataVisibility(index);
    } else {
      const nowVisible = chart.isDatasetVisible(index);
      chart.setDatasetVisibility(index, !nowVisible);
    }
    chart.update();

    setLegendItems((prev) =>
      prev.map((li) => (li.index === index ? { ...li, visible: !li.visible } : li)),
    );
  }, [chartType]);

  // ── Render ────────────────────────────────────────────────────────────────

  // Show legend only when there are 2+ items (1 item adds no information).
  const showLegend = legendItems.length > 1;

  return (
    <div className="cft-chart-area">
      <div className="cft-canvas-wrap">
        <canvas ref={canvasRef} />
      </div>

      {showLegend && (
        <div className="cft-legend" role="group" aria-label="Chart legend">
          {legendItems.map((item) => (
            <button
              key={item.index}
              type="button"
              className={`cft-legend-item${item.visible ? '' : ' cft-legend-item--hidden'}`}
              onClick={() => toggleItem(item.index)}
              title={item.visible ? `Hide ${item.text}` : `Show ${item.text}`}
              aria-pressed={item.visible}
            >
              <span
                className="cft-legend-swatch"
                style={{
                  background:   item.fillColor,
                  borderColor:  item.strokeColor,
                }}
              />
              <span className="cft-legend-label">{item.text}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Download helper ───────────────────────────────────────────────────────────

function downloadCsv(headers: string[], rows: string[][], filename = 'table.csv') {
  const escape = (v: string) => `"${v.replace(/"/g, '""')}"`;
  const lines = [headers.map(escape).join(','), ...rows.map((r) => r.map(escape).join(','))];
  const blob  = new Blob([lines.join('\n')], { type: 'text/csv' });
  const url   = URL.createObjectURL(blob);
  const a     = document.createElement('a');
  a.href      = url;
  a.download  = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// ── Main component ────────────────────────────────────────────────────────────

interface ChartFromTableProps {
  raw: string;
}

export function ChartFromTable({ raw }: ChartFromTableProps) {
  const [view,      setView]      = useState<ViewMode>('table');
  const [chartType, setChartType] = useState<ChartType>('bar');

  const parsed = useMemo(() => parseMarkdownTable(raw), [raw]);

  const numericCols = useMemo(
    () => (parsed ? numericColumnIndices(parsed) : []),
    [parsed],
  );

  const labelColIdx = useMemo(() => {
    if (!parsed) return 0;
    const otherNumeric = numericCols.filter((i) => i !== 0);
    return otherNumeric.length > 0 ? 0 : -1;
  }, [parsed, numericCols]);

  const labels = useMemo(() => {
    if (!parsed) return [];
    if (labelColIdx >= 0) return parsed.rows.map((r) => r[labelColIdx] ?? '');
    return parsed.rows.map((_, i) => String(i + 1));
  }, [parsed, labelColIdx]);

  const datasets = useMemo(() => {
    if (!parsed) return [];
    const cols = numericCols.filter((ci) => ci !== labelColIdx).slice(0, MAX_DATASETS);
    return cols.map((ci, pi) => ({
      label:           parsed.headers[ci] ?? `Col ${ci + 1}`,
      data:            parsed.rows.map((r) => toNumber(r[ci] ?? '') ?? 0),
      borderColor:     PALETTE[pi % PALETTE.length].border,
      backgroundColor: PALETTE[pi % PALETTE.length].bg,
    }));
  }, [parsed, numericCols, labelColIdx]);

  const canShowChart = datasets.length > 0;

  const handleViewToggle   = useCallback((v: ViewMode)   => setView(v),       []);
  const handleDownloadCsv  = useCallback(() => {
    if (parsed) downloadCsv(parsed.headers, parsed.rows);
  }, [parsed]);

  if (!parsed) return <pre className="cft-fallback">{raw}</pre>;

  return (
    <div className="cft-wrap">

      {/* ── Toolbar ─────────────────────────────────────────────────────── */}
      <div className="cft-toolbar">

        <div className="cft-toggle-group" role="group" aria-label="View mode">
          <button
            type="button"
            className={`cft-toggle-btn${view === 'table' ? ' cft-toggle-btn--active' : ''}`}
            onClick={() => handleViewToggle('table')}
          >
            Table
          </button>
          {canShowChart && (
            <button
              type="button"
              className={`cft-toggle-btn${view === 'chart' ? ' cft-toggle-btn--active' : ''}`}
              onClick={() => handleViewToggle('chart')}
            >
              Chart
            </button>
          )}
        </div>

        {view === 'chart' && canShowChart && (
          <div className="cft-type-group" role="group" aria-label="Chart type">
            {(['bar', 'line', 'pie'] as ChartType[]).map((t) => (
              <button
                key={t}
                type="button"
                className={`cft-type-btn${chartType === t ? ' cft-type-btn--active' : ''}`}
                onClick={() => setChartType(t)}
              >
                {t.charAt(0).toUpperCase() + t.slice(1)}
              </button>
            ))}
          </div>
        )}

        <button
          type="button"
          className="cft-csv-btn"
          onClick={handleDownloadCsv}
          title="Download as CSV"
        >
          ↓ CSV
        </button>
      </div>

      {/* ── Table view ──────────────────────────────────────────────────── */}
      {view === 'table' && (
        <div className="cft-table-wrap">
          <table className="cft-table">
            <thead>
              <tr>{parsed.headers.map((h, i) => <th key={i}>{h}</th>)}</tr>
            </thead>
            <tbody>
              {parsed.rows.map((row, ri) => (
                <tr key={ri}>
                  {parsed.headers.map((_, ci) => <td key={ci}>{row[ci] ?? ''}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Chart view ──────────────────────────────────────────────────── */}
      {view === 'chart' && canShowChart && (
        <CanvasChart labels={labels} datasets={datasets} chartType={chartType} />
      )}

      {view === 'chart' && !canShowChart && (
        <p className="cft-no-chart">
          No numeric columns detected — chart unavailable for this table.
        </p>
      )}
    </div>
  );
}

export default ChartFromTable;
