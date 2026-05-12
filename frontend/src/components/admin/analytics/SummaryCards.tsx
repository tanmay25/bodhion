'use client';

import { MessageSquare, MessagesSquare, Users, Cpu } from 'lucide-react';
import type { AnalyticsSummary } from '@/lib/api/admin/analytics';

interface SummaryCardsProps {
  data:    AnalyticsSummary | null;
  loading: boolean;
}

interface StatCard {
  label: string;
  value: number | undefined;
  icon:  React.ReactNode;
  color: string;
}

function Skeleton() {
  return (
    <div
      className="h-5 w-16 animate-pulse rounded"
      style={{ background: 'var(--bodhion-search-bg)' }}
    />
  );
}

export function SummaryCards({ data, loading }: SummaryCardsProps) {
  const cards: StatCard[] = [
    {
      label: 'Total Messages',
      value: data?.total_messages,
      icon:  <MessageSquare className="h-5 w-5" />,
      color: 'rgba(37,215,255,0.85)',
    },
    {
      label: 'Total Chats',
      value: data?.total_chats,
      icon:  <MessagesSquare className="h-5 w-5" />,
      color: 'rgba(130,100,255,0.85)',
    },
    {
      label: 'Active Users',
      value: data?.total_users,
      icon:  <Users className="h-5 w-5" />,
      color: 'rgba(52,211,153,0.85)',
    },
    {
      label: 'Models Used',
      value: data?.total_models,
      icon:  <Cpu className="h-5 w-5" />,
      color: 'rgba(251,146,60,0.85)',
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      {cards.map((card) => (
        <div key={card.label} className="admin-card flex flex-col gap-3 rounded-xl p-4">
          <div className="flex items-center justify-between">
            <span
              className="text-xs font-medium uppercase tracking-wide"
              style={{ color: 'var(--bodhion-text-secondary)' }}
            >
              {card.label}
            </span>
            <span style={{ color: card.color }}>{card.icon}</span>
          </div>
          {loading ? (
            <Skeleton />
          ) : (
            <span
              className="text-2xl font-semibold tabular-nums"
              style={{ color: 'var(--bodhion-text-primary)' }}
            >
              {card.value?.toLocaleString() ?? '—'}
            </span>
          )}
        </div>
      ))}
    </div>
  );
}

export default SummaryCards;
