import { Shell } from '@/components/layout/Shell';
import {
  LifeBuoy,
  Mail,
  MessageSquare,
  BookOpen,
  Clock,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react';

const CONTACT_CHANNELS = [
  {
    icon: Mail,
    label: 'Email Support',
    value: 't.mondal25@gmail.com',
    detail: 'Response within 1 business day',
    tint: { bg: 'rgba(34,211,238,0.13)', color: '#22d3ee' },
  },
  {
    icon: MessageSquare,
    label: 'IT Help Desk',
    value: 't.mondal25@gmail.com',
    detail: 'For internal IT issues and requests',
    tint: { bg: 'rgba(251,191,36,0.15)', color: '#d97706' },
  },
  {
    icon: BookOpen,
    label: 'Documentation',
    value: 'github.com/tanmay-mondal/bodhion',
    detail: 'Guides, FAQs, and release notes',
    tint: { bg: 'rgba(118,209,26,0.14)', color: '#5aad10' },
  },
];

const FAQS = [
  {
    q: 'How do I reset my Bodhion password?',
    a: 'Contact your IT administrator or use the "Forgot password" link on the login screen.',
  },
  {
    q: 'Which AI models are available to me?',
    a: 'Available models are configured by your admin. Open the Chat Engine and click the model selector to see your options.',
  },
  {
    q: 'Can I upload documents for analysis?',
    a: 'Yes. In the Chat Engine you can drag-and-drop or paste files directly into the input area.',
  },
  {
    q: 'Who do I contact for access to a new service?',
    a: 'Reach out to your IT Help Desk or system administrator to request access grants for additional services.',
  },
  {
    q: 'Is my conversation data stored?',
    a: 'Chat history is stored in your account and visible only to you and your organization admins. Contact your admin for the data retention policy.',
  },
];

const STATUS_ITEMS = [
  { label: 'Chat Engine', status: 'operational' },
  { label: 'AI Model API', status: 'operational' },
  { label: 'Authentication', status: 'operational' },
  { label: 'Resume Analyzer', status: 'coming-soon' },
  { label: 'IT Help Desk AI', status: 'coming-soon' },
];

export default function SupportPage() {
  return (
    <Shell>
      <div className="sup-root flex h-full flex-col overflow-y-auto">
        <div className="mx-auto w-full max-w-4xl flex-1 px-4 py-6 sm:px-6 sm:py-8">

          {/* ── Hero ─────────────────────────────────────────────────── */}
          <header className="sup-hero relative mb-6 overflow-hidden rounded-2xl border p-6 sm:p-8">
            <div aria-hidden className="sup-hero-glow pointer-events-none absolute inset-0" />
            <div className="relative flex items-center gap-4">
              <div
                className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl"
                style={{ background: 'rgba(34,211,238,0.13)', color: '#22d3ee' }}
              >
                <LifeBuoy className="h-6 w-6" />
              </div>
              <div>
                <div className="sup-eyebrow mb-1 text-[0.72rem] font-bold uppercase tracking-widest">
                  Bodhion Hub
                </div>
                <h1 className="sup-title text-2xl font-bold leading-tight tracking-tight sm:text-3xl">
                  Support Center
                </h1>
                <p className="sup-desc mt-1 text-sm leading-relaxed">
                  Get help, find answers, and reach the right team.
                </p>
              </div>
            </div>
          </header>

          {/* ── Grid: Contact + Status ────────────────────────────────── */}
          <div className="mb-6 grid gap-4 sm:grid-cols-2">

            {/* Contact channels */}
            <section className="sup-card rounded-2xl border p-5">
              <h2 className="sup-section-title mb-4 text-sm font-semibold uppercase tracking-wider">
                Contact Us
              </h2>
              <div className="flex flex-col gap-3">
                {CONTACT_CHANNELS.map(({ icon: Icon, label, value, detail, tint }) => (
                  <div key={label} className="flex items-start gap-3">
                    <div
                      className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
                      style={{ background: tint.bg, color: tint.color }}
                    >
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="min-w-0">
                      <div className="sup-label text-xs font-semibold uppercase tracking-wider">
                        {label}
                      </div>
                      <div className="sup-value truncate text-sm font-medium">{value}</div>
                      <div className="sup-detail text-xs">{detail}</div>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* Service status */}
            <section className="sup-card rounded-2xl border p-5">
              <h2 className="sup-section-title mb-4 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider">
                <Clock className="h-3.5 w-3.5" />
                Service Status
              </h2>
              <div className="flex flex-col gap-2.5">
                {STATUS_ITEMS.map(({ label, status }) => (
                  <div key={label} className="flex items-center justify-between gap-2">
                    <span className="sup-value text-sm">{label}</span>
                    {status === 'operational' ? (
                      <span className="sup-status-ok flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold">
                        <CheckCircle2 className="h-3 w-3" />
                        Operational
                      </span>
                    ) : (
                      <span className="sup-status-soon flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold">
                        <AlertCircle className="h-3 w-3" />
                        Coming Soon
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </section>
          </div>

          {/* ── Support Hours ─────────────────────────────────────────── */}
          <section className="sup-card mb-6 rounded-2xl border p-5">
            <h2 className="sup-section-title mb-4 text-sm font-semibold uppercase tracking-wider">
              Support Hours
            </h2>
            <div className="grid gap-3 sm:grid-cols-3">
              {[
                { day: 'Monday – Friday', time: '9:00 AM – 6:00 PM IST', note: 'Full support' },
                { day: 'Saturday', time: '10:00 AM – 2:00 PM IST', note: 'Limited support' },
                { day: 'Sunday & Holidays', time: 'Closed', note: 'Email only' },
              ].map(({ day, time, note }) => (
                <div key={day} className="sup-hours-card rounded-xl border p-3">
                  <div className="sup-value text-sm font-semibold">{day}</div>
                  <div className="sup-desc mt-0.5 text-sm">{time}</div>
                  <div className="sup-detail mt-1 text-xs">{note}</div>
                </div>
              ))}
            </div>
          </section>

          {/* ── FAQ ───────────────────────────────────────────────────── */}
          <section className="sup-card rounded-2xl border p-5">
            <h2 className="sup-section-title mb-4 text-sm font-semibold uppercase tracking-wider">
              Frequently Asked Questions
            </h2>
            <div className="flex flex-col divide-y sup-divider">
              {FAQS.map(({ q, a }) => (
                <div key={q} className="py-3.5 first:pt-0 last:pb-0">
                  <div className="sup-value mb-1 text-sm font-semibold">{q}</div>
                  <div className="sup-desc text-sm leading-relaxed">{a}</div>
                </div>
              ))}
            </div>
          </section>

        </div>
      </div>

      <style>{`
        .sup-root { background: var(--background); }

        /* Hero */
        .sup-hero {
          background: var(--bodhion-card-bg);
          border-color: var(--bodhion-card-border);
          box-shadow: var(--bodhion-shell-shadow);
        }
        .sup-hero-glow {
          background:
            radial-gradient(circle at top left, rgba(34,211,238,0.07), transparent 40%),
            radial-gradient(circle at bottom right, rgba(118,209,26,0.05), transparent 35%);
        }
        .sup-eyebrow  { color: var(--bodhion-eyebrow-text); }
        .sup-title    { color: var(--bodhion-text-primary); }
        .sup-desc     { color: var(--bodhion-text-secondary); }

        /* Cards */
        .sup-card {
          background: var(--bodhion-card-bg);
          border-color: var(--bodhion-card-border);
          box-shadow: var(--bodhion-shell-shadow);
        }
        .sup-hours-card {
          background: var(--bodhion-muted-button-bg);
          border-color: var(--bodhion-shell-border);
        }
        .sup-section-title { color: var(--bodhion-eyebrow-text); }
        .sup-label   { color: var(--bodhion-text-secondary); }
        .sup-value   { color: var(--bodhion-text-primary); }
        .sup-detail  { color: var(--bodhion-text-secondary); }
        .sup-divider > * { border-color: var(--bodhion-shell-border); }

        /* Status chips */
        .sup-status-ok {
          background: rgba(118,209,26,0.14);
          color: #5aad10;
          border: 1px solid rgba(118,209,26,0.24);
        }
        .sup-status-soon {
          background: var(--bodhion-muted-button-bg);
          color: var(--bodhion-text-secondary);
          border: 1px solid var(--bodhion-shell-border);
        }
      `}</style>
    </Shell>
  );
}
