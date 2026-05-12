import { notFound } from 'next/navigation';
import { Leaderboard }   from '@/components/admin/evaluations/Leaderboard';
import { FeedbackList }  from '@/components/admin/evaluations/FeedbackList';

const TABS = ['leaderboard', 'feedback'] as const;
type Tab = (typeof TABS)[number];

interface Props {
  params: Promise<{ tab: string }>;
}

export default async function AdminEvaluationsTabPage({ params }: Props) {
  const { tab } = await params;
  if (!TABS.includes(tab as Tab)) notFound();

  return (
    <div className="flex flex-col gap-4 p-6">
      {/* Sub-tab nav */}
      <nav className="flex gap-0 border-b" style={{ borderColor: 'var(--bodhion-card-border)' }}>
        {TABS.map((t) => (
          <a
            key={t}
            href={`/admin/evaluations/${t}`}
            className="px-4 py-2 text-sm font-medium capitalize transition-colors"
            style={
              tab === t
                ? {
                    color:       'rgba(37,215,255,0.9)',
                    borderBottom: '2px solid rgba(37,215,255,0.9)',
                    marginBottom: '-1px',
                  }
                : { color: 'var(--bodhion-text-secondary)' }
            }
          >
            {t === 'leaderboard' ? 'Leaderboard' : 'Feedback'}
          </a>
        ))}
      </nav>

      {tab === 'leaderboard' && <Leaderboard />}
      {tab === 'feedback'    && <FeedbackList />}
    </div>
  );
}
