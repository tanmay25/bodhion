'use client';

import { useState, useEffect, useRef } from 'react';
import { cn } from '@/lib/utils/cn';
import type { PipelineStep } from '@/types/chat';

interface ThinkingPanelProps {
  steps: PipelineStep[];
  isStreaming: boolean;
  className?: string;
}

// ── Icons (inline SVG, no external dependency) ────────────────────────────────

function SpinnerIcon() {
  return (
    <svg className="tp-step-spinner" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
      <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="20 6 9 17 4 12"/>
    </svg>
  );
}

function ErrorIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
      <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
    </svg>
  );
}

function BrainIcon({ className }: { className?: string }) {
  return (
    <svg className={className} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96-.46 2.5 2.5 0 0 1-2.96-3.08 3 3 0 0 1-.34-5.58 2.5 2.5 0 0 1 1.32-4.24 2.5 2.5 0 0 1 1.98-3A2.5 2.5 0 0 1 9.5 2Z"/>
      <path d="M14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 4.96-.46 2.5 2.5 0 0 0 2.96-3.08 3 3 0 0 0 .34-5.58 2.5 2.5 0 0 0-1.32-4.24 2.5 2.5 0 0 0-1.98-3A2.5 2.5 0 0 0 14.5 2Z"/>
    </svg>
  );
}

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      className={cn('tp-chevron', open && 'tp-chevron--open')}
      width="12" height="12" viewBox="0 0 24 24"
      fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
      aria-hidden="true"
    >
      <polyline points="6 9 12 15 18 9"/>
    </svg>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────

export function ThinkingPanel({ steps, isStreaming, className }: ThinkingPanelProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [elapsed, setElapsed]     = useState(0);
  const startTimeRef              = useRef<number | null>(null);
  const timerRef                  = useRef<ReturnType<typeof setInterval> | null>(null);

  // Start timer on stream open, stop + auto-collapse on stream close
  useEffect(() => {
    if (isStreaming) {
      startTimeRef.current = Date.now();
      setElapsed(0);
      setCollapsed(false);
      timerRef.current = setInterval(() => {
        setElapsed(Math.floor((Date.now() - startTimeRef.current!) / 1000));
      }, 1000);
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      if (startTimeRef.current) {
        setElapsed(Math.floor((Date.now() - startTimeRef.current) / 1000));
      }
      if (steps.length > 0) setCollapsed(true);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isStreaming]);

  if (steps.length === 0) return null;

  const activeStep = [...steps].reverse().find((s) => s.status === 'started');
  const headerLabel = isStreaming
    ? (activeStep?.description ?? 'Thinking…')
    : `Thought for ${elapsed}s`;

  return (
    <div className={cn('tp-panel', isStreaming && 'tp-panel--active', className)}>
      {/* ── Header (always visible) ── */}
      <button
        type="button"
        className="tp-header"
        onClick={() => setCollapsed((c) => !c)}
        aria-expanded={!collapsed}
      >
        <BrainIcon className="tp-brain-icon" />
        <span className="tp-header-label">{headerLabel}</span>
        <ChevronIcon open={!collapsed} />
      </button>

      {/* ── Steps list (collapsed/expanded) ── */}
      {!collapsed && (
        <div className="tp-body">
          {steps.map((step, idx) => {
            // The last step with status "started" is the active one.
            // If streaming has ended and the last step is still "started",
            // render it as done (generating_response has no explicit "done" event).
            const isLastStep = idx === steps.length - 1;
            const effectiveDone =
              step.status === 'done' || (!isStreaming && isLastStep && step.status === 'started');
            const isActive = !effectiveDone && step.status === 'started';
            const isError  = step.status === 'error';

            return (
              <div
                key={step.id}
                className={cn(
                  'tp-step',
                  isActive    && 'tp-step--active',
                  effectiveDone && 'tp-step--done',
                  isError     && 'tp-step--error',
                )}
                style={{ animationDelay: `${idx * 30}ms` }}
              >
                <span className="tp-step-icon">
                  {isActive     && <SpinnerIcon />}
                  {effectiveDone && <CheckIcon />}
                  {isError      && <ErrorIcon />}
                </span>
                <span className="tp-step-label">{step.description}</span>
                {step.metadata?.file_count !== undefined && (
                  <span className="tp-step-meta">
                    {String(step.metadata.file_count)}&nbsp;file{Number(step.metadata.file_count) !== 1 ? 's' : ''}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
