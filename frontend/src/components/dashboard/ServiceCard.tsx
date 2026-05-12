import Link from 'next/link';
import { MessageSquare, FileText, Wrench, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import type { DashboardService } from './services';

const iconMap = {
  chat:     MessageSquare,
  resume:   FileText,
  it:       Wrench,
  sparkles: Sparkles,
} as const;

// Per-service icon tints — semi-transparent so they adapt to all theme backgrounds
const iconTint: Record<string, { bg: string; color: string }> = {
  'chat-engine':         { bg: 'rgba(34,211,238,0.15)',  color: '#22d3ee' },
  'resume-analyzer':     { bg: 'rgba(118,209,26,0.16)',  color: '#5aad10' },
  'it-help-desk':        { bg: 'rgba(251,191,36,0.18)',  color: '#d97706' },
  'knowledge-assistant': { bg: 'rgba(139,92,246,0.16)',  color: '#8b5cf6' },
  'workflow-automation': { bg: 'rgba(236,72,153,0.14)',  color: '#db2777' },
};

const defaultIconTint = {
  bg: 'rgba(148,163,184,0.16)',
  color: 'var(--bodhion-text-secondary)',
};

interface ServiceCardProps {
  service: DashboardService;
}

export function ServiceCard({ service }: ServiceCardProps) {
  const Icon = iconMap[service.icon] ?? Sparkles;
  const isEnabled = service.status === 'active' && service.isAccessible && Boolean(service.route);
  const isComingSoon = service.status !== 'active';
  const tint = iconTint[service.id] ?? defaultIconTint;

  const inner = (
    <article
      className={cn(
        'sc-card group relative flex flex-col rounded-2xl border p-5 transition-all duration-200',
        isEnabled && 'cursor-pointer hover:-translate-y-1',
        isComingSoon && 'opacity-60',
      )}
    >
      {isComingSoon && (
        <div className="sc-coming-soon-bar absolute inset-x-0 top-0 h-[3px] rounded-t-2xl" />
      )}

      <div className="flex items-start justify-between gap-3">
        <div
          className={cn(
            'flex h-11 w-11 items-center justify-center rounded-xl transition-transform duration-200',
            isEnabled && 'group-hover:scale-110',
          )}
          style={{ background: tint.bg, color: tint.color }}
        >
          <Icon className="h-5 w-5" />
        </div>
        <StatusChip service={service} />
      </div>

      <h3 className="sc-title mt-4 text-base font-semibold">
        {service.title}
      </h3>
      <p className="sc-desc mt-1.5 line-clamp-2 text-sm leading-relaxed">
        {service.description}
      </p>

      <div className="mt-5">
        {isEnabled ? (
          <div className="sc-cta-btn group-hover:brightness-110">
            {service.cta}
          </div>
        ) : (
          <div className="sc-cta-btn sc-cta-btn--disabled">
            {service.status !== 'active' ? 'Coming Soon' : service.isAccessible ? service.cta : 'No Access'}
          </div>
        )}
      </div>
    </article>
  );

  return (
    <>
      {isEnabled ? (
        <Link href={service.route!} className="block">{inner}</Link>
      ) : (
        inner
      )}

      <style>{`
        .sc-card {
          background: var(--bodhion-card-bg);
          border-color: var(--bodhion-card-border);
          box-shadow: var(--bodhion-shell-shadow);
        }
        .sc-card:hover {
          border-color: var(--bodhion-shell-border-strong);
        }
        .sc-coming-soon-bar {
          background: var(--bodhion-shell-border);
        }
        .sc-title  { color: var(--bodhion-text-primary); }
        .sc-desc   { color: var(--bodhion-text-secondary); }
        .sc-cta-btn {
          width: 100%; border-radius: 0.5rem;
          padding: 0.625rem 0.75rem;
          text-align: center; font-size: 0.875rem; font-weight: 600;
          transition: all 0.2s;
          background: var(--bodhion-primary-button);
          color: var(--bodhion-text-primary);
          border: 1px solid var(--bodhion-shell-border-strong);
          box-shadow: var(--bodhion-primary-button-shadow);
        }
        .sc-cta-btn--disabled {
          cursor: not-allowed;
          background: var(--bodhion-muted-button-bg);
          color: var(--bodhion-text-secondary);
          border-color: var(--bodhion-shell-border);
          box-shadow: none;
        }
      `}</style>
    </>
  );
}

function StatusChip({ service }: { service: DashboardService }) {
  if (service.status !== 'active') {
    return (
      <span
        className="rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider"
        style={{
          background: 'var(--bodhion-muted-button-bg)',
          color: 'var(--bodhion-text-secondary)',
          border: '1px solid var(--bodhion-shell-border)',
        }}
      >
        Planned
      </span>
    );
  }
  if (!service.isAccessible) {
    return (
      <span
        className="rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider"
        style={{
          background: 'rgba(251,191,36,0.18)',
          color: '#d97706',
          border: '1px solid rgba(251,191,36,0.28)',
        }}
      >
        Locked
      </span>
    );
  }
  return (
    <span
      className="rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider"
      style={{
        background: 'rgba(118,209,26,0.16)',
        color: '#5aad10',
        border: '1px solid rgba(118,209,26,0.24)',
      }}
    >
      Live
    </span>
  );
}

export default ServiceCard;
