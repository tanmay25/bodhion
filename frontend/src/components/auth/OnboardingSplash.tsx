'use client';

import { useEffect, useRef, useState } from 'react';

interface OnboardingSplashProps {
  onGetStarted: () => void;
}

const PHRASES = [
  'Multi-LLM orchestration',
  'Context-aware knowledge retrieval',
  'Private, on-premise enterprise AI',
  'Automated AI workflows',
  'Your data boundary, in control',
];

export function OnboardingSplash({ onGetStarted }: OnboardingSplashProps) {
  const [phraseIdx, setPhraseIdx]   = useState(0);
  const [phraseAnim, setPhraseAnim] = useState<'in' | 'out'>('in');
  const [exiting, setExiting]       = useState(false);
  const btnRef                      = useRef<HTMLButtonElement>(null);

  // Auto-focus the CTA on mount for keyboard users
  useEffect(() => { btnRef.current?.focus(); }, []);

  // Rotate phrases every 4 s with fade-out → swap → fade-in
  useEffect(() => {
    const tick = setInterval(() => {
      setPhraseAnim('out');
      setTimeout(() => {
        setPhraseIdx((i) => (i + 1) % PHRASES.length);
        setPhraseAnim('in');
      }, 420);
    }, 4000);
    return () => clearInterval(tick);
  }, []);

  function handleGetStarted() {
    setExiting(true);
    setTimeout(onGetStarted, 380);
  }

  return (
    <div
      className={`onb-root${exiting ? ' onb-exit' : ''}`}
      role="main"
      aria-label="Welcome to Bodhion — first-time setup"
    >
      {/* ── Animated background glow pulse ───────────────────────── */}
      <div className="onb-glow-pulse" aria-hidden="true" />

      {/* ── Cyan dot-pattern overlay (matches showcase-panel) ────── */}
      <div className="onb-dot-pattern" aria-hidden="true" />

      {/* ── Top bar: Bodhion brand ───────────────────────────────── */}
      <header className="onb-topbar">
        <div className="onb-brand-right">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/static/bodhion_login.png"
            alt="Bodhion"
            className="onb-logo-bodhion"
          />
          <span className="onb-brand-text">Bodhion</span>
        </div>
      </header>

      {/* ── Centre content ───────────────────────────────────────── */}
      <div className="onb-center">

        {/* Eyebrow pill — reuses workspace-eyebrow token set */}
        <div className="workspace-eyebrow onb-eyebrow">
          <span className="onb-pill-dot" aria-hidden="true" />
          Enterprise GenAI Workspace
        </div>

        {/* Main headline */}
        <h1 className="onb-headline">
          Welcome to<br />Bodhion
        </h1>

        {/* Rotating feature phrase */}
        <div className="onb-phrase-wrap" aria-live="polite">
          <span
            key={phraseIdx}
            className={`onb-phrase onb-phrase--${phraseAnim}`}
          >
            {PHRASES[phraseIdx]}
          </span>
        </div>

        {/* Subtext */}
        <p className="onb-subtext">
          Your enterprise AI workspace is ready to be configured.
          <br />
          Start by creating the first admin account.
        </p>

        {/* CTA */}
        <button
          ref={btnRef}
          className="onb-cta"
          onClick={handleGetStarted}
          type="button"
        >
          <span>Get started</span>
          {/* Inline arrow — no extra dep */}
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width={18}
            height={18}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2.5}
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M5 12h14M12 5l7 7-7 7" />
          </svg>
        </button>
      </div>

      {/* ── Scoped styles (use CSS tokens from globals.css) ──────── */}
      <style>{`
        /* Root shell — var(--bodhion-shell-bg) adapts to all 3 themes */
        .onb-root {
          position: fixed;
          inset: 0;
          z-index: 500;
          display: flex;
          flex-direction: column;
          background: var(--bodhion-shell-bg);
          overflow: hidden;
          opacity: 1;
          transform: translateY(0);
          transition: opacity 0.38s ease, transform 0.38s ease;
        }

        .onb-exit {
          opacity: 0;
          transform: translateY(-10px);
          pointer-events: none;
        }

        /* Breathing glow — top-right cyan radial, 8 s loop */
        .onb-glow-pulse {
          position: absolute;
          inset: 0;
          background:
            radial-gradient(circle at 80% 8%, rgba(37,215,255,0.22), transparent 38%),
            radial-gradient(circle at 8% 85%, rgba(118,209,26,0.14), transparent 30%);
          pointer-events: none;
          animation: onb-glow 8s ease-in-out infinite;
        }

        @keyframes onb-glow {
          0%, 100% { opacity: 0.7; }
          50%       { opacity: 1;   }
        }

        /* Cyan dot-pattern — mirrors showcase-pattern from (auth)/layout.tsx */
        .onb-dot-pattern {
          position: absolute;
          inset: 0;
          background:
            radial-gradient(circle at 76% 22%, rgba(34,211,238,0.82), rgba(34,211,238,0) 1.6%),
            radial-gradient(circle at 82% 33%, rgba(34,211,238,0.75), rgba(34,211,238,0) 1.3%);
          pointer-events: none;
          opacity: 0.9;
        }

        /* Top bar */
        .onb-topbar {
          position: relative;
          z-index: 2;
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 28px 36px 0;
        }

        .onb-brand-right {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .onb-logo-bodhion {
          height: 26px !important;
          width: auto !important;
          object-fit: contain;
          border-radius: 6px;
        }

        .onb-brand-text {
          font-size: 20px;
          font-weight: 700;
          color: var(--bodhion-text-primary, #eaf6ff);
          letter-spacing: -0.02em;
        }

        /* Centre block */
        .onb-center {
          position: relative;
          z-index: 2;
          flex: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          text-align: center;
          padding: 0 24px 64px;
          gap: 0;
        }

        /* Eyebrow pill — workspace-eyebrow class already sets most styles */
        .onb-eyebrow {
          margin-bottom: 22px;
          gap: 8px;
        }

        .onb-pill-dot {
          width: 7px;
          height: 7px;
          border-radius: 999px;
          background: var(--bodhion-eyebrow-text, #c7f23a);
          flex-shrink: 0;
        }

        /* Headline */
        .onb-headline {
          margin: 0 0 28px;
          font-size: clamp(40px, 7vw, 80px);
          line-height: 1.04;
          letter-spacing: -0.04em;
          font-weight: 800;
          color: var(--bodhion-text-primary, #eaf6ff);
        }

        /* Rotating phrase */
        .onb-phrase-wrap {
          height: 2.4em;
          display: flex;
          align-items: center;
          justify-content: center;
          overflow: hidden;
          margin-bottom: 20px;
        }

        .onb-phrase {
          font-size: clamp(18px, 2.6vw, 26px);
          font-weight: 600;
          color: var(--bodhion-accent, #25d7ff);
          letter-spacing: -0.01em;
          display: block;
        }

        .onb-phrase--in {
          animation: onb-phrase-in 0.42s ease forwards;
        }

        .onb-phrase--out {
          animation: onb-phrase-out 0.42s ease forwards;
        }

        @keyframes onb-phrase-in {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0);   }
        }

        @keyframes onb-phrase-out {
          from { opacity: 1; transform: translateY(0);    }
          to   { opacity: 0; transform: translateY(-8px); }
        }

        /* Subtext */
        .onb-subtext {
          margin: 0 0 36px;
          font-size: clamp(14px, 1.8vw, 17px);
          line-height: 1.65;
          color: var(--bodhion-text-secondary, #8fa9bd);
          max-width: 440px;
        }

        /* CTA button — mirrors workspace-models-button--primary */
        .onb-cta {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          padding: 16px 36px;
          border-radius: 14px;
          border: 1px solid var(--bodhion-shell-border-strong, rgba(37,215,255,0.24));
          background: var(--bodhion-primary-button,
            linear-gradient(135deg, rgba(0,104,201,0.94), rgba(37,215,255,0.72)));
          box-shadow: var(--bodhion-primary-button-shadow,
            0 10px 30px rgba(0,104,201,0.26));
          color: var(--bodhion-nav-active-color, #f5fbff);
          font-size: 17px;
          font-weight: 700;
          letter-spacing: -0.01em;
          cursor: pointer;
          transition: transform 0.16s ease, filter 0.16s ease, box-shadow 0.16s ease;
          outline-offset: 3px;
        }

        .onb-cta:hover {
          transform: translateY(-2px);
          filter: brightness(1.08);
        }

        .onb-cta:active {
          transform: scale(0.98);
        }

        .onb-cta:focus-visible {
          outline: 2px solid var(--bodhion-accent, #25d7ff);
        }

        /* Responsive */
        @media (max-width: 600px) {
          .onb-topbar  { padding: 20px 20px 0; }
          .onb-center  { padding: 0 16px 48px; }
          .onb-headline{ font-size: clamp(32px, 10vw, 48px); }
          .onb-cta     { width: 100%; max-width: 320px; }
        }

      `}</style>
    </div>
  );
}

export default OnboardingSplash;
