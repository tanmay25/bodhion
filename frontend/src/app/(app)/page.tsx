'use client';

import { useEffect, useState } from 'react';
import { DashboardShell } from '@/components/dashboard/DashboardShell';
import { ServiceGrid } from '@/components/dashboard/ServiceGrid';
import { dashboardServices } from '@/components/dashboard/services';
import { getServices } from '@/lib/api/configs';
import { getToken } from '@/lib/auth/session';
import type { DashboardService } from '@/components/dashboard/services';
import type { Service } from '@/types/api';

function coerceIcon(icon: string): DashboardService['icon'] {
  if (icon === 'chat' || icon === 'resume' || icon === 'it' || icon === 'sparkles') return icon;
  return 'sparkles';
}

function coerceStatus(status: string): DashboardService['status'] {
  if (status === 'active' || status === 'coming-soon') return status;
  return 'active';
}

export default function DashboardPage() {
  const [services, setServices] = useState<DashboardService[]>([...dashboardServices]);

  useEffect(() => {
    const token = getToken();
    if (!token) return;

    getServices(token)
      .then((res: Service[]) => {
        if (Array.isArray(res)) {
          setServices(
            res.map((s) => ({
              id: s.id,
              title: s.name,
              description: s.description,
              route: s.route,
              cta: s.cta ?? 'Open Service',
              status: coerceStatus(s.status ?? 'active'),
              icon: coerceIcon(s.icon ?? 'sparkles'),
              isAccessible: Boolean(s.is_accessible ?? true),
            }))
          );
        }
      })
      .catch(() => {
        /* keep static fallback */
      });
  }, []);

  return (
    <DashboardShell>
      <div className="relative mx-auto flex h-full max-w-7xl flex-col">

        {/* Subtle decorative glow — purely visual, stays behind everything */}
        <div aria-hidden className="dash-bg-glow pointer-events-none absolute inset-0" />

        {/* Hero header */}
        <header className="dash-hero relative shrink-0 rounded-[1.2rem] border p-4">
          <div className="dash-eyebrow">Bodhion Hub</div>
          <h1 className="dash-title mt-1.5 font-bold leading-[1.06] tracking-[-0.02em]"
            style={{ fontSize: 'clamp(1.85rem, 1.45rem + 0.9vw, 2.45rem)' }}
          >
            Welcome to Bodhion
          </h1>
          <p className="dash-desc mt-1.5 max-w-2xl text-[0.96rem] font-medium leading-[1.55]">
            Use the service cards below to launch chat and upcoming AI workflows from one place.
          </p>
        </header>

        {/* Service grid container */}
        <div className="dash-grid relative mt-3 min-h-0 flex-1 overflow-y-auto rounded-[1.15rem] border p-3 sm:p-4">
          <ServiceGrid services={services} />
        </div>
      </div>

      <style>{`
        .dash-bg-glow {
          background:
            radial-gradient(circle at top left, rgba(37,215,255,0.07), transparent 28%),
            radial-gradient(circle at bottom right, rgba(118,209,26,0.05), transparent 24%);
        }
        .dash-hero {
          background: var(--bodhion-card-bg);
          border-color: var(--bodhion-card-border);
          box-shadow: var(--bodhion-shell-shadow);
        }
        .dash-eyebrow {
          font-size: 0.74rem;
          font-weight: 700;
          letter-spacing: 0.14em;
          text-transform: uppercase;
          color: var(--bodhion-eyebrow-text);
        }
        .dash-title { color: var(--bodhion-text-primary); }
        .dash-desc  { color: var(--bodhion-text-secondary); }
        .dash-grid {
          background: var(--bodhion-card-bg);
          border-color: var(--bodhion-card-border);
          box-shadow: var(--bodhion-shell-shadow);
        }
      `}</style>
    </DashboardShell>
  );
}
