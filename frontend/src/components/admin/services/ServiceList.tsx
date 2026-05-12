'use client';

import { useState } from 'react';
import { Plus, LayoutGrid, EyeOff, Eye } from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import type { ServiceModel } from '@/lib/api/admin/services';

/** Returns true only when `icon` is a URL-like string safe to use as <img src> */
function isIconUrl(icon: string | null | undefined): boolean {
  if (!icon) return false;
  return (
    icon.startsWith('http://') ||
    icon.startsWith('https://') ||
    icon.startsWith('/') ||
    icon.startsWith('data:')
  );
}

interface ServiceListProps {
  services: ServiceModel[];
  selectedId: string | null;
  onSelect: (service: ServiceModel) => void;
  onAdd: () => void;
}

export function ServiceList({ services, selectedId, onSelect, onAdd }: ServiceListProps) {
  const [showInactive, setShowInactive] = useState(false);

  const activeServices   = services.filter((s) => s.is_active === true);
  const inactiveServices = services.filter((s) => s.is_active === false);
  const visible          = showInactive ? services : activeServices;

  return (
    <div className="svc-list-panel">

      {/* ── Header ──────────────────────────────────────────────────── */}
      <div className="svc-list-header">
        <div className="svc-list-header__left">
          <span className="svc-list-title">Services</span>
          <span className="svc-list-count">{activeServices.length}</span>
        </div>
        <button type="button" className="svc-add-btn" onClick={onAdd}>
          <Plus style={{ width: '0.8rem', height: '0.8rem' }} />
          Add Service
        </button>
      </div>

      {/* ── Show-inactive toggle ─────────────────────────────────────── */}
      {inactiveServices.length > 0 && (
        <button
          type="button"
          className="svc-inactive-toggle"
          style={showInactive ? {
            borderColor: 'var(--bodhion-accent)',
            color: 'var(--bodhion-accent)',
            background: 'rgba(37,215,255,0.08)',
          } : undefined}
          onClick={() => setShowInactive((v) => !v)}
        >
          {showInactive
            ? <EyeOff style={{ width: '0.72rem', height: '0.72rem' }} />
            : <Eye style={{ width: '0.72rem', height: '0.72rem' }} />}
          {showInactive
            ? `Hide inactive (${inactiveServices.length})`
            : `Show inactive (${inactiveServices.length})`}
        </button>
      )}

      {/* ── Divider ─────────────────────────────────────────────────── */}
      <div className="svc-list-divider" />

      {/* ── Service cards ───────────────────────────────────────────── */}
      <div className="svc-list-body">
        {visible.length === 0 ? (
          <div className="svc-empty-list">
            No services yet.{' '}
            <button type="button" className="svc-empty-add-link" onClick={onAdd}>
              Add one
            </button>{' '}
            to get started.
          </div>
        ) : (
          visible.map((svc) => (
            <button
              key={svc.id}
              type="button"
              className={cn(
                'svc-card',
                selectedId === svc.id && 'svc-card--active',
                !svc.is_active && 'svc-card--inactive',
              )}
              onClick={() => onSelect(svc)}
            >
              {/* Left accent bar */}
              <div
                className="svc-card-bar"
                style={selectedId === svc.id ? { background: 'var(--bodhion-accent)' } : undefined}
              />

              {/* Icon */}
              <div className="svc-card-icon">
                {isIconUrl(svc.icon) ? (
                  <img src={svc.icon!} alt="" className="h-full w-full object-contain" />
                ) : (
                  <LayoutGrid style={{ width: '0.95rem', height: '0.95rem', color: 'var(--bodhion-text-secondary)' }} />
                )}
              </div>

              {/* Info */}
              <div className="svc-card-info">
                <span className="svc-card-name">{svc.name}</span>
                <div className="svc-card-meta">
                  <span className="svc-badge svc-badge--type">{svc.type}</span>
                  <span className={cn('svc-badge', svc.status === 'active' ? 'svc-badge--active' : 'svc-badge--soon')}>
                    {svc.status}
                  </span>
                  {!svc.is_active && (
                    <span className="svc-badge svc-badge--off">inactive</span>
                  )}
                </div>
              </div>
            </button>
          ))
        )}
      </div>

      <style>{`
        .svc-list-panel {
          display: flex;
          flex-direction: column;
          gap: 0;
          width: 100%;
        }

        /* ── Header ── */
        .svc-list-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 0.5rem;
          padding-bottom: 0.75rem;
        }
        .svc-list-header__left {
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }
        .svc-list-title {
          font-size: 0.72rem;
          font-weight: 700;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          color: var(--bodhion-text-secondary);
        }
        .svc-list-count {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-width: 1.3rem;
          height: 1.3rem;
          padding: 0 0.35rem;
          border-radius: 999px;
          background: rgba(37,215,255,0.12);
          border: 1px solid rgba(37,215,255,0.22);
          color: var(--bodhion-accent);
          font-size: 0.68rem;
          font-weight: 700;
          line-height: 1;
        }
        .svc-add-btn {
          display: inline-flex;
          align-items: center;
          gap: 0.3rem;
          padding: 0.32rem 0.7rem;
          border-radius: 999px;
          border: none;
          background: var(--bodhion-primary-button);
          box-shadow: var(--bodhion-primary-button-shadow);
          color: #fff;
          font-size: 0.74rem;
          font-weight: 600;
          cursor: pointer;
          white-space: nowrap;
          transition: opacity 0.15s;
        }
        .svc-add-btn:hover { opacity: 0.86; }

        /* ── Inactive toggle ── */
        .svc-inactive-toggle {
          display: inline-flex;
          align-items: center;
          gap: 0.35rem;
          align-self: flex-start;
          padding: 0.22rem 0.6rem;
          margin-bottom: 0.5rem;
          border-radius: 999px;
          border: 1px solid var(--bodhion-shell-border);
          background: transparent;
          color: var(--bodhion-text-secondary);
          font-size: 0.7rem;
          font-weight: 500;
          cursor: pointer;
          transition: border-color 0.15s, color 0.15s, background 0.15s;
        }
        .svc-inactive-toggle:hover {
          border-color: var(--bodhion-shell-border-strong);
          color: var(--bodhion-text-primary);
        }

        /* ── Divider ── */
        .svc-list-divider {
          height: 1px;
          background: var(--bodhion-shell-border);
          margin-bottom: 0.65rem;
          border-radius: 999px;
        }

        /* ── Body ── */
        .svc-list-body {
          display: flex;
          flex-direction: column;
          gap: 0.35rem;
        }

        /* ── Empty state ── */
        .svc-empty-list {
          font-size: 0.8rem;
          color: var(--bodhion-text-secondary);
          text-align: center;
          padding: 1.5rem 0.5rem;
          line-height: 1.55;
        }
        .svc-empty-add-link {
          background: none;
          border: none;
          color: var(--bodhion-accent);
          font-size: inherit;
          font-weight: 600;
          cursor: pointer;
          padding: 0;
          text-decoration: underline;
          text-underline-offset: 2px;
        }

        /* ── Card ── */
        .svc-card {
          position: relative;
          display: flex;
          align-items: center;
          gap: 0.65rem;
          width: 100%;
          text-align: left;
          padding: 0.6rem 0.75rem 0.6rem 0.9rem;
          border-radius: 0.9rem;
          border: 1px solid var(--bodhion-card-border);
          background: var(--bodhion-card-bg);
          cursor: pointer;
          overflow: hidden;
          transition: border-color 0.15s, background 0.15s;
        }
        .svc-card:hover {
          border-color: var(--bodhion-shell-border-strong);
          background: rgba(37,215,255,0.03);
        }
        .svc-card--active {
          border-color: var(--bodhion-accent);
          background: var(--bodhion-nav-active-bg);
        }
        .svc-card--inactive {
          opacity: 0.5;
        }

        /* Left accent bar */
        .svc-card-bar {
          position: absolute;
          left: 0;
          top: 0.35rem;
          bottom: 0.35rem;
          width: 2.5px;
          border-radius: 0 999px 999px 0;
          background: transparent;
          transition: background 0.15s;
        }

        /* Icon box */
        .svc-card-icon {
          width: 1.9rem;
          height: 1.9rem;
          flex-shrink: 0;
          border-radius: 0.45rem;
          border: 1px solid var(--bodhion-shell-border);
          background: rgba(255,255,255,0.04);
          display: flex;
          align-items: center;
          justify-content: center;
          overflow: hidden;
        }

        /* Card text */
        .svc-card-info {
          display: flex;
          flex-direction: column;
          gap: 0.25rem;
          min-width: 0;
          flex: 1;
        }
        .svc-card-name {
          font-size: 0.84rem;
          font-weight: 600;
          color: var(--bodhion-text-primary);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          line-height: 1.2;
        }
        .svc-card-meta {
          display: flex;
          align-items: center;
          gap: 0.3rem;
          flex-wrap: wrap;
        }

        /* ── Badges ── */
        .svc-badge {
          font-size: 0.6rem;
          font-weight: 700;
          letter-spacing: 0.06em;
          text-transform: uppercase;
          padding: 0.1rem 0.4rem;
          border-radius: 999px;
          border: 1px solid transparent;
          line-height: 1.4;
        }
        .svc-badge--type {
          border-color: rgba(37,215,255,0.22);
          background: rgba(37,215,255,0.07);
          color: var(--bodhion-accent);
        }
        .svc-badge--active {
          border-color: rgba(74,222,128,0.28);
          background: rgba(74,222,128,0.07);
          color: #4ade80;
        }
        .svc-badge--soon {
          border-color: rgba(251,191,36,0.28);
          background: rgba(251,191,36,0.07);
          color: #fbbf24;
        }
        .svc-badge--off {
          border-color: rgba(156,163,175,0.25);
          background: rgba(156,163,175,0.05);
          color: #9ca3af;
        }
      `}</style>
    </div>
  );
}
