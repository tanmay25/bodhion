import { AnalyticsDashboard } from '@/components/admin/analytics/Dashboard';

export default function AdminAnalyticsPage() {
  return (
    <div className="aa-page flex min-h-full flex-col gap-3 p-4">

      {/* ── Sticky page header ─────────────────────────────────────────── */}
      <div className="bodhion-page-header sticky top-0 z-20 overflow-hidden rounded-[1.6rem] border border-white/10 flex-shrink-0">
        <div className="bodhion-page-header-glow" />
        <div className="relative px-5 py-4 space-y-2">
          <div className="bodhion-eyebrow-badge">BODHION ADMIN</div>
          <div>
            <h1 className="bodhion-page-title">Analytics</h1>
            <p className="bodhion-page-desc mt-1">
              Platform usage statistics, model metrics, and activity trends.
            </p>
          </div>
        </div>
      </div>

      {/* ── Dashboard content ──────────────────────────────────────────── */}
      <div className="bodhion-scroll min-h-0 flex-1">
        <AnalyticsDashboard />
      </div>

      <style>{`
        .aa-page { color: var(--bodhion-text-primary); }

        /* ── Page header ── */
        .bodhion-page-header {
          background: var(--bodhion-shell-bg);
          backdrop-filter: blur(22px);
          box-shadow: 0 24px 70px rgba(0,0,0,0.3);
        }
        .bodhion-page-header-glow {
          position: absolute; inset: 0;
          background:
            linear-gradient(120deg, rgba(0,104,201,0.13), transparent 34%),
            linear-gradient(120deg, transparent 45%, rgba(37,215,255,0.11), transparent 72%);
          pointer-events: none;
        }
        .bodhion-eyebrow-badge {
          display: inline-flex; align-items: center;
          border: 1px solid var(--bodhion-eyebrow-border, rgba(199,242,58,0.24));
          background: var(--bodhion-eyebrow-bg, rgba(118,209,26,0.08));
          padding: 0.28rem 0.65rem; border-radius: 999px;
          color: var(--bodhion-eyebrow-text, #c7f23a);
          font-size: 0.66rem; font-weight: 700;
          letter-spacing: 0.14em; text-transform: uppercase; width: fit-content;
        }
        .bodhion-page-title {
          font-size: clamp(1.2rem, 1rem + 0.5vw, 1.85rem);
          font-weight: 800; line-height: 1.05;
          letter-spacing: -0.02em; color: var(--bodhion-text-primary);
        }
        .bodhion-page-desc {
          font-size: 0.86rem; line-height: 1.55;
          color: var(--bodhion-text-secondary); max-width: 60rem;
        }

        /* ── Content scrollbar ── */
        .bodhion-scroll { scrollbar-width: thin; scrollbar-color: rgba(37,215,255,0.45) rgba(255,255,255,0.04); }
        .bodhion-scroll::-webkit-scrollbar { width: 6px; }
        .bodhion-scroll::-webkit-scrollbar-track { background: rgba(255,255,255,0.03); border-radius: 999px; }
        .bodhion-scroll::-webkit-scrollbar-thumb {
          background: linear-gradient(180deg, rgba(0,104,201,0.85), rgba(37,215,255,0.75));
          border-radius: 999px;
        }
      `}</style>
    </div>
  );
}
