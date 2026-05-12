// Shared branded loading splash for admin tab content areas.
// Logo centred inside a spinning gradient arc ring — mirrors the global
// SplashScreen pattern but scoped to the tab content area.

interface AdminLoadingSplashProps {
  title?: string;
  subtitle?: string;
  minHeight?: string;
}

export function AdminLoadingSplash({
  title = 'Loading…',
  subtitle = 'Fetching configuration',
  minHeight = '340px',
}: AdminLoadingSplashProps) {
  return (
    <>
      <div className="als-wrap" style={{ minHeight }}>
        <div className="als-inner">

          {/* Arc ring with logo centred inside */}
          <div className="als-ring-wrap" aria-hidden>
            {/* Spinning gradient arc */}
            <svg className="als-ring" viewBox="0 0 96 96" fill="none">
              {/* Track */}
              <circle cx="48" cy="48" r="42" stroke="rgba(37,215,255,0.1)" strokeWidth="3" />
              {/* Spinning arc */}
              <circle
                cx="48" cy="48" r="42"
                stroke="url(#als-grad)"
                strokeWidth="3"
                strokeLinecap="round"
                strokeDasharray="66 198"
              />
              <defs>
                <linearGradient id="als-grad" x1="0" y1="0" x2="96" y2="96" gradientUnits="userSpaceOnUse">
                  <stop offset="0%" stopColor="#0068c9" />
                  <stop offset="100%" stopColor="#25d7ff" />
                </linearGradient>
              </defs>
            </svg>

            {/* Bodhion logo — dark variant for dark admin bg, light variant for light themes */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/static/logo-bodhion-dark.jpeg"
              alt=""
              className="als-logo als-logo--dark"
            />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/static/logo-bodhion-light.png"
              alt=""
              className="als-logo als-logo--light"
            />
          </div>

          <p className="als-title">{title}</p>
          <p className="als-sub">{subtitle}</p>
        </div>
      </div>

      <style>{`
        /* ── Outer card ── */
        .als-wrap {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 100%;
          border-radius: 0.75rem;
          border: 1px solid var(--bodhion-card-border);
          background: var(--bodhion-card-bg, rgba(255,255,255,0.02));
          animation: als-fade-in 0.25s ease both;
        }
        @keyframes als-fade-in {
          from { opacity: 0; transform: translateY(6px); }
          to   { opacity: 1; transform: none; }
        }

        .als-inner {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 1rem;
        }

        /* ── Ring wrapper — logo sits centred, SVG arc spins around it ── */
        .als-ring-wrap {
          position: relative;
          width: 6rem;   /* 96px — matches SVG viewBox */
          height: 6rem;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        /* SVG fills the wrapper and rotates */
        .als-ring {
          position: absolute;
          inset: 0;
          width: 100%;
          height: 100%;
          animation: als-spin 1.4s linear infinite;
        }
        @keyframes als-spin { to { transform: rotate(360deg); } }

        /* Logo sits above the SVG, centred, with pulse */
        .als-logo {
          position: relative;
          z-index: 1;
          width: 3.5rem;    /* 56px — slightly larger, still 12px gap inside the 96px ring */
          height: auto;
          object-fit: contain;
          animation: als-pulse 2s ease-in-out infinite;
        }
        @keyframes als-pulse {
          0%, 100% { opacity: 1; }
          50%       { opacity: 0.55; }
        }

        /* Theme-aware logo swap — same pattern as AdminShell nav logos */
        .als-logo--light { display: none; }
        .als-logo--dark  { display: block; }
        html.light .als-logo--dark,
        html.bodhion-light .als-logo--dark  { display: none; }
        html.light .als-logo--light,
        html.bodhion-light .als-logo--light { display: block; }

        /* ── Text ── */
        .als-title {
          margin: 0;
          font-size: 0.9rem;
          font-weight: 600;
          color: var(--bodhion-text-primary, #e8eaf0);
        }
        .als-sub {
          margin: 0;
          margin-top: -0.5rem;
          font-size: 0.76rem;
          color: var(--bodhion-text-secondary, #8b95a6);
        }
      `}</style>
    </>
  );
}

export default AdminLoadingSplash;
