'use client';

// Slide-in controls panel — System Prompt + Advanced Params.
// Mirrors open-webui's ChatControls.svelte / Controls.svelte.
// Opened by the Knobs/Sliders button in the chat header.

import { useEffect, useRef, useState } from 'react';
import { X, ChevronDown, ChevronUp, RotateCcw } from 'lucide-react';
import { useChatStore, type AdvancedParams } from '@/store/chatStore';

// ── Collapsible section ───────────────────────────────────────────────────────

function Section({
  label,
  storageKey,
  children,
}: {
  label: string;
  storageKey: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState<boolean>(() => {
    if (typeof window === 'undefined') return true;
    return localStorage.getItem(`chatControls.${storageKey}`) !== 'false';
  });

  const toggle = () => {
    const next = !open;
    setOpen(next);
    localStorage.setItem(`chatControls.${storageKey}`, String(next));
  };

  return (
    <div className="ccp-section">
      <button type="button" className="ccp-section-header" onClick={toggle}>
        <span className="ccp-section-label">{label}</span>
        {open
          ? <ChevronUp className="h-3.5 w-3.5" />
          : <ChevronDown className="h-3.5 w-3.5" />}
      </button>
      {open && <div className="ccp-section-body">{children}</div>}
    </div>
  );
}

// ── Param row ─────────────────────────────────────────────────────────────────

function ParamRow({
  label,
  hint,
  paramKey,
  min,
  max,
  step,
}: {
  label: string;
  hint: string;
  paramKey: keyof AdvancedParams;
  min: number;
  max: number;
  step: number;
}) {
  const value = useChatStore((s) => s.advancedParams[paramKey]);
  const setAdvancedParam = useChatStore((s) => s.setAdvancedParam);
  const active = value !== null;

  return (
    <div className="ccp-param-row">
      <div className="ccp-param-header">
        <label className="ccp-param-label" title={hint}>{label}</label>
        <div className="ccp-param-controls">
          {active && (
            <span className="ccp-param-value">{value}</span>
          )}
          <button
            type="button"
            className={`ccp-param-toggle${active ? ' ccp-param-toggle--on' : ''}`}
            onClick={() => setAdvancedParam(paramKey, active ? null : (min + max) / 2)}
            title={active ? 'Disable' : 'Enable'}
          >
            {active ? 'On' : 'Off'}
          </button>
        </div>
      </div>
      {active && (
        <input
          type="range"
          className="ccp-slider"
          min={min}
          max={max}
          step={step}
          value={value ?? (min + max) / 2}
          onChange={(e) => setAdvancedParam(paramKey, Number(e.target.value))}
        />
      )}
    </div>
  );
}

// ── Panel ─────────────────────────────────────────────────────────────────────

export function ChatControlsPanel() {
  const showControls    = useChatStore((s) => s.showControls);
  const setShowControls = useChatStore((s) => s.setShowControls);
  const systemPrompt    = useChatStore((s) => s.systemPrompt);
  const setSystemPrompt = useChatStore((s) => s.setSystemPrompt);
  const resetParams     = useChatStore((s) => s.resetAdvancedParams);
  const panelRef        = useRef<HTMLDivElement>(null);

  // Escape to close
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && showControls) setShowControls(false);
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [showControls, setShowControls]);

  if (!showControls) return null;

  return (
    <>
      {/* Backdrop */}
      <div className="ccp-backdrop" aria-hidden onClick={() => setShowControls(false)} />

      {/* Panel */}
      <div ref={panelRef} className="ccp-panel" role="dialog" aria-label="Chat controls">
        {/* Header */}
        <div className="ccp-header">
          <span className="ccp-eyebrow">Controls</span>
          <div className="ccp-header-actions">
            <button
              type="button"
              className="ccp-icon-btn"
              onClick={resetParams}
              title="Reset all params to default"
            >
              <RotateCcw className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              className="ccp-icon-btn"
              onClick={() => setShowControls(false)}
              aria-label="Close controls"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="ccp-body">
          {/* System Prompt */}
          <Section label="System Prompt" storageKey="systemPrompt">
            <textarea
              className="ccp-textarea"
              placeholder="Enter a system prompt to guide the model's behaviour…"
              value={systemPrompt}
              onChange={(e) => setSystemPrompt(e.target.value)}
              rows={5}
            />
          </Section>

          {/* Advanced Params */}
          <Section label="Advanced Parameters" storageKey="advancedParams">
            <ParamRow
              label="Temperature"
              hint="Controls randomness — lower is more deterministic"
              paramKey="temperature"
              min={0} max={2} step={0.05}
            />
            <ParamRow
              label="Top P"
              hint="Nucleus sampling threshold"
              paramKey="top_p"
              min={0} max={1} step={0.05}
            />
            <ParamRow
              label="Frequency Penalty"
              hint="Reduces repetition of token sequences"
              paramKey="frequency_penalty"
              min={-2} max={2} step={0.05}
            />
            <ParamRow
              label="Max Tokens"
              hint="Maximum number of tokens in the response"
              paramKey="max_tokens"
              min={64} max={32768} step={64}
            />
            <ParamRow
              label="Seed"
              hint="Fixed seed for reproducible outputs"
              paramKey="seed"
              min={0} max={2147483647} step={1}
            />
          </Section>
        </div>
      </div>

      <style>{`
        /* Backdrop */
        .ccp-backdrop {
          position: fixed; inset: 0; z-index: 190;
          background: rgba(0,0,0,0.35);
          backdrop-filter: blur(1px);
          animation: ccp-fade 0.15s ease;
        }
        @keyframes ccp-fade { from { opacity: 0; } to { opacity: 1; } }

        /* Panel */
        .ccp-panel {
          position: fixed; top: 0; right: 0; bottom: 0;
          z-index: 191;
          width: min(360px, 100vw);
          display: flex; flex-direction: column;
          background: var(--bodhion-bg, #0d1117);
          border-left: 1px solid var(--bodhion-card-border);
          box-shadow: -8px 0 40px rgba(0,0,0,0.5);
          animation: ccp-slide 0.2s cubic-bezier(0.25,0.46,0.45,0.94);
        }
        @keyframes ccp-slide {
          from { transform: translateX(100%); }
          to   { transform: translateX(0); }
        }

        /* Panel header */
        .ccp-header {
          display: flex; align-items: center; justify-content: space-between;
          padding: 0.85rem 1rem;
          border-bottom: 1px solid var(--bodhion-card-border);
          flex-shrink: 0;
        }
        .ccp-eyebrow {
          font-size: 0.65rem; font-weight: 700; letter-spacing: 0.13em;
          text-transform: uppercase; color: var(--bodhion-accent, #25d7ff);
        }
        .ccp-header-actions { display: flex; align-items: center; gap: 0.25rem; }
        .ccp-icon-btn {
          display: flex; align-items: center; justify-content: center;
          width: 1.85rem; height: 1.85rem; border-radius: 0.4rem;
          background: none; border: none; cursor: pointer;
          color: var(--bodhion-text-secondary);
          transition: color 0.12s, background 0.12s;
        }
        .ccp-icon-btn:hover {
          color: var(--bodhion-text-primary);
          background: rgba(255,255,255,0.07);
        }

        /* Body */
        .ccp-body {
          flex: 1; overflow-y: auto; padding: 0.75rem;
          display: flex; flex-direction: column; gap: 0.5rem;
          scrollbar-width: thin;
          scrollbar-color: var(--bodhion-card-border) transparent;
        }

        /* Section */
        .ccp-section {
          border-radius: 0.75rem;
          border: 1px solid var(--bodhion-card-border);
          background: var(--bodhion-card-bg, rgba(255,255,255,0.02));
          overflow: hidden;
        }
        .ccp-section-header {
          display: flex; align-items: center; justify-content: space-between;
          width: 100%; padding: 0.65rem 0.85rem;
          background: none; border: none; cursor: pointer;
          color: var(--bodhion-text-primary);
          font-size: 0.8rem; font-weight: 600;
          transition: background 0.12s;
        }
        .ccp-section-header:hover { background: rgba(255,255,255,0.04); }
        .ccp-section-label { flex: 1; text-align: left; }
        .ccp-section-body { padding: 0 0.85rem 0.85rem; }

        /* Textarea */
        .ccp-textarea {
          width: 100%; resize: vertical; min-height: 7rem;
          padding: 0.6rem 0.75rem; border-radius: 0.6rem;
          border: 1px solid var(--bodhion-card-border);
          background: var(--bodhion-search-bg, rgba(255,255,255,0.05));
          color: var(--bodhion-text-primary);
          font-size: 0.82rem; line-height: 1.55;
          font-family: inherit; outline: none;
          transition: border-color 0.15s;
        }
        .ccp-textarea:focus { border-color: var(--bodhion-accent, #25d7ff); }
        .ccp-textarea::placeholder { color: var(--bodhion-text-secondary); }

        /* Param rows */
        .ccp-param-row {
          padding: 0.5rem 0;
          border-bottom: 1px solid rgba(255,255,255,0.05);
        }
        .ccp-param-row:last-child { border-bottom: none; }
        .ccp-param-header {
          display: flex; align-items: center; justify-content: space-between;
          margin-bottom: 0.35rem;
        }
        .ccp-param-label {
          font-size: 0.78rem; color: var(--bodhion-text-secondary); cursor: default;
        }
        .ccp-param-controls { display: flex; align-items: center; gap: 0.4rem; }
        .ccp-param-value {
          font-size: 0.75rem; font-weight: 600; font-family: monospace;
          color: var(--bodhion-accent, #25d7ff);
          min-width: 2.5rem; text-align: right;
        }
        .ccp-param-toggle {
          font-size: 0.68rem; font-weight: 700; padding: 0.15rem 0.45rem;
          border-radius: 999px; cursor: pointer;
          border: 1px solid var(--bodhion-card-border);
          background: var(--bodhion-search-bg); color: var(--bodhion-text-secondary);
          transition: all 0.12s;
        }
        .ccp-param-toggle--on {
          border-color: rgba(37,215,255,0.35);
          background: rgba(37,215,255,0.1);
          color: var(--bodhion-accent, #25d7ff);
        }

        /* Range slider */
        .ccp-slider {
          width: 100%; height: 3px; appearance: none;
          background: linear-gradient(
            to right,
            var(--bodhion-accent, #25d7ff) 0%,
            var(--bodhion-accent, #25d7ff) var(--slider-pct, 50%),
            rgba(255,255,255,0.12) var(--slider-pct, 50%)
          );
          border-radius: 999px; outline: none; cursor: pointer;
        }
        .ccp-slider::-webkit-slider-thumb {
          appearance: none; width: 14px; height: 14px; border-radius: 50%;
          background: var(--bodhion-accent, #25d7ff);
          border: 2px solid var(--bodhion-bg, #0d1117);
          box-shadow: 0 0 6px rgba(37,215,255,0.5);
        }
        .ccp-slider::-moz-range-thumb {
          width: 14px; height: 14px; border-radius: 50%;
          background: var(--bodhion-accent, #25d7ff);
          border: 2px solid var(--bodhion-bg, #0d1117);
        }
      `}</style>
    </>
  );
}

export default ChatControlsPanel;
