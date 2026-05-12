const features = [
  {
    label: 'MODELS',
    text: 'Multi-LLM orchestration',
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" width={15} height={15}>
        <path d="M4 6h16M4 12h10M4 18h6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    label: 'AGENTS',
    text: 'Automated workflows',
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" width={15} height={15}>
        <path d="M12 3a4 4 0 0 0-4 4v1a4 4 0 0 0 8 0V7a4 4 0 0 0-4-4Z" stroke="currentColor" strokeWidth="2" />
        <path d="M4 21a8 8 0 0 1 16 0" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    label: 'SECURITY',
    text: 'Private and controlled data',
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" width={15} height={15}>
        <path d="M12 2 4 6v6c0 5 3.5 9.5 8 10 4.5-.5 8-5 8-10V6l-8-4Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    label: 'KNOWLEDGE',
    text: 'Context-aware retrieval',
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" width={15} height={15}>
        <path d="M9 3h6v6H9zM3 15h6v6H3zM15 15h6v6h-6z" stroke="currentColor" strokeWidth="2" />
      </svg>
    ),
  },
];

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="auth-shell">
      {/* ── Login stage card ──────────────────────────────────────────── */}
      <div className="login-stage">

        {/* ── LEFT: Showcase panel ──────────────────────────────────── */}
        <section className="showcase-panel">
          <div className="showcase-overlay" aria-hidden="true" />
          <div className="showcase-pattern" aria-hidden="true" />

          <div className="showcase-content">
            {/* Pill badge */}
            <div className="workspace-pill">
              <span className="pill-dot" aria-hidden="true" />
              <span>Enterprise GenAI Workspace</span>
            </div>

            {/* Hero copy */}
            <div className="hero-copy">
              <h2>Build, search, and automate knowledge with Bodhion</h2>
              <p>
                One secure space for copilots, assistants, and team intelligence.
                Your data boundary, fully in your control.
              </p>
            </div>

            {/* 2×2 feature grid */}
            <div className="feature-grid">
              {features.map((f) => (
                <div key={f.label} className="feature-card">
                  <div className="feature-icon" aria-hidden="true">
                    {f.icon}
                  </div>
                  <div className="feature-label">{f.label}</div>
                  <div className="feature-text">{f.text}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── RIGHT: Form panel ─────────────────────────────────────── */}
        <section className="login-panel">
          {/* Brand row */}
          <div className="brand-row">
            <div className="brand">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/static/bodhion_login.png"
                alt="Bodhion"
                className="brand-logo"
              />
              <span className="brand-text">Bodhion</span>
            </div>
            <span className="secure-label">Secure Access</span>
          </div>

          {/* Form injected here */}
          <div className="panel-form-wrap">
            {children}
          </div>

          {/* Secure footer */}
          <div className="secure-note">
            <span className="secure-icon" aria-hidden="true">✓</span>
            <span>Secure access to your enterprise workspace</span>
          </div>
        </section>
      </div>

      <style>{`
        /* ── Page shell ─────────────────────────────────────────────── */
        .auth-shell {
          min-height: 100vh;
          width: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 32px 16px;
          background:
            radial-gradient(circle at 10% 18%, rgba(34,211,238,0.26), transparent 34%),
            radial-gradient(circle at 88% 16%, rgba(16,185,129,0.20), transparent 38%),
            radial-gradient(circle at 84% 84%, rgba(56,189,248,0.16), transparent 40%),
            linear-gradient(145deg, #0c4a6e, #0f3d5c 52%, #1e3a5f);
        }

        /* ── Two-panel card ─────────────────────────────────────────── */
        .login-stage {
          width: min(1260px, 100%);
          display: grid;
          grid-template-columns: 1.08fr 0.92fr;
          border-radius: 32px;
          overflow: hidden;
          border: 1px solid rgba(255,255,255,0.18);
          box-shadow: 0 28px 80px rgba(2,6,23,0.45);
          max-height: min(900px, calc(100vh - 64px));
        }

        /* ── LEFT panel ─────────────────────────────────────────────── */
        .login-panel {
          padding: 40px 38px 48px;
          background:
            radial-gradient(circle at 8% 12%, rgba(34,211,238,0.28), transparent 36%),
            radial-gradient(circle at 85% 88%, rgba(16,185,129,0.20), transparent 40%),
            linear-gradient(180deg, #e8f4f8, #ddeef5);
          color: #0f172a;
          overflow-y: auto;
          display: flex;
          flex-direction: column;
        }

        .brand-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 28px;
          flex-shrink: 0;
        }

        .brand {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .brand-logo {
          height: 28px !important;
          width: auto !important;
          object-fit: contain;
          border-radius: 6px;
          background: transparent;
          padding: 0;
        }

        .brand-text {
          font-size: 22px;
          font-weight: 700;
          color: #0f172a;
        }

        .secure-label {
          font-size: 12px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.06em;
          color: #1d3557;
        }

        .panel-form-wrap {
          flex: 1;
          min-height: 0;
          overflow-y: auto;
        }

        .secure-note {
          margin-top: 16px;
          flex-shrink: 0;
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 14px;
          color: #546a80;
        }

        .secure-icon {
          width: 20px;
          height: 20px;
          border-radius: 999px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          font-size: 11px;
          font-weight: 400;
          background: #dcfce7;
          color: #15803d;
          flex-shrink: 0;
        }

        /* ── RIGHT panel ────────────────────────────────────────────── */
        .showcase-panel {
          position: relative;
          padding: 40px 36px 32px;
          color: #f8fafc;
          background:
            radial-gradient(circle at 16% 10%, rgba(191,242,255,0.62), transparent 24%),
            radial-gradient(circle at 70% 22%, rgba(34,211,238,0.20), transparent 28%),
            radial-gradient(circle at 92% 8%,  rgba(56,189,248,0.18), transparent 24%),
            linear-gradient(145deg, #0b3f53 0%, #0a3a52 30%, #0d3554 62%, #123a5c 100%);
          overflow-y: auto;
        }

        .showcase-overlay {
          position: absolute;
          inset: 0;
          background: linear-gradient(315deg, rgba(16,185,129,0.08), transparent 30%);
          pointer-events: none;
        }

        .showcase-pattern {
          position: absolute;
          inset: 0;
          background:
            radial-gradient(circle at 78% 23%, rgba(34,211,238,0.85), rgba(34,211,238,0) 1.8%),
            radial-gradient(circle at 84% 34%, rgba(34,211,238,0.78), rgba(34,211,238,0) 1.4%);
          opacity: 0.85;
          pointer-events: none;
        }

        .showcase-content {
          position: relative;
          z-index: 2;
          display: flex;
          flex-direction: column;
          gap: 0;
        }

        .top-brand {
          display: inline-flex;
          align-items: center;
          margin-bottom: 4px;
        }

        .workspace-pill {
          margin-top: 16px;
          display: inline-flex;
          align-items: center;
          gap: 10px;
          padding: 7px 14px;
          border-radius: 999px;
          font-size: 13px;
          font-weight: 500;
          border: 1px solid rgba(85,215,255,0.32);
          background: rgba(255,255,255,0.07);
          width: fit-content;
        }

        .pill-dot {
          width: 8px;
          height: 8px;
          border-radius: 999px;
          background: #67e8f9;
          flex-shrink: 0;
        }

        .hero-copy {
          margin-top: 20px;
        }

        .hero-copy h2 {
          margin: 0;
          font-size: clamp(24px, 3.6vh, 38px);
          line-height: 1.06;
          letter-spacing: -0.035em;
          font-weight: 800;
          color: #f0f9ff;
        }

        .hero-copy p {
          margin-top: 12px;
          font-size: clamp(14px, 1.9vh, 17px);
          line-height: 1.6;
          color: rgba(226,232,240,0.85);
          max-width: 480px;
        }

        /* ── Feature grid ───────────────────────────────────────────── */
        .feature-grid {
          margin-top: 24px;
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 14px;
        }

        .feature-card {
          padding: 16px 14px 14px;
          border-radius: 16px;
          background: rgba(255,255,255,0.10);
          border: 1px solid rgba(103,232,249,0.30);
          min-height: 100px;
          transition: background 0.2s ease, border-color 0.2s ease;
        }

        .feature-card:hover {
          background: rgba(255,255,255,0.09);
          border-color: rgba(103,232,249,0.32);
        }

        .feature-icon {
          width: 32px;
          height: 32px;
          border-radius: 999px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          background: rgba(103,232,249,0.12);
          color: #89f3ff;
          margin-bottom: 10px;
        }

        .feature-label {
          font-size: 11px;
          font-weight: 600;
          letter-spacing: 0.1em;
          color: rgba(226,232,240,0.96);
          margin-bottom: 5px;
          text-transform: uppercase;
        }

        .feature-text {
          font-size: 13.5px;
          line-height: 1.35;
          color: rgba(248,250,252,0.88);
        }

        /* ── Responsive ─────────────────────────────────────────────── */
        @media (max-height: 820px) {
          .showcase-panel { padding: 28px 28px 22px; }
          .login-panel    { padding: 28px 28px 22px; }
          .feature-card   { min-height: 80px; padding: 12px; }
          .hero-copy h2   { font-size: 28px; }
          .hero-copy p    { font-size: 13px; }
        }

        @media (max-width: 1180px) {
          .login-stage {
            grid-template-columns: 1fr;
            max-height: none;
          }
        }

        @media (max-width: 720px) {
          .login-panel,
          .showcase-panel { padding: 24px 18px; }
          .hero-copy h2   { font-size: 26px; }
          .feature-grid   { grid-template-columns: 1fr; }
          .auth-shell     { padding: 0; }
          .login-stage    { border-radius: 0; }
        }
      `}</style>
    </div>
  );
}
