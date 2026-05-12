'use client';

import { useEffect, useState } from 'react';
import { getToken } from '@/lib/auth/session';
import { adminGetServices, type ServiceModel } from '@/lib/api/admin/services';
import { ServiceList } from '@/components/admin/services/ServiceList';
import { ServiceEditor } from '@/components/admin/services/ServiceEditor';

export default function AdminServicesPage() {
  const [services, setServices]       = useState<ServiceModel[]>([]);
  const [selectedId, setSelectedId]   = useState<string | null>(null);
  const [isCreating, setIsCreating]   = useState(false);
  const [loading, setLoading]         = useState(true);

  const selectedService = services.find((s) => s.id === selectedId) ?? null;

  useEffect(() => {
    const token = getToken();
    if (!token) return;
    adminGetServices(token, true)
      .then(setServices)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleSelect = (svc: ServiceModel) => {
    setIsCreating(false);
    setSelectedId(svc.id);
  };

  const handleAdd = () => {
    setSelectedId(null);
    setIsCreating(true);
  };

  const handleSaved = (saved: ServiceModel) => {
    setServices((prev) => {
      const exists = prev.findIndex((s) => s.id === saved.id);
      if (exists >= 0) {
        const next = [...prev];
        next[exists] = saved;
        return next;
      }
      return [...prev, saved];
    });
    setSelectedId(saved.id);
    setIsCreating(false);
  };

  const handleDeactivated = (_id: string) => {
    // Refresh the service from the server to get updated is_active
    const token = getToken();
    if (!token) return;
    adminGetServices(token, true).then(setServices).catch(() => {});
  };

  return (
    <div className="svc-page flex min-h-full flex-col gap-3 p-4">

      {/* ── Page header ─────────────────────────────────────────────────────── */}
      <div className="svc-page-header sticky top-0 z-20 overflow-hidden rounded-[1.6rem] border border-white/10 flex-shrink-0">
        <div className="svc-page-header-glow" />
        <div className="relative px-5 py-4 space-y-2">
          <div className="svc-eyebrow-badge">BODHION ADMIN</div>
          <div>
            <h1 className="svc-page-title">Services</h1>
            <p className="svc-page-desc mt-1">
              Create and manage platform services. Configure each service&apos;s settings, control access, and set display properties.
            </p>
          </div>
        </div>
      </div>

      {/* ── Main two-panel layout ────────────────────────────────────────────── */}
      {loading ? (
        <div className="svc-loading-grid">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="svc-skeleton" />
          ))}
        </div>
      ) : (
        <div className="svc-two-panel">
          {/* Left: service list */}
          <div className="svc-panel-left">
            <div className="svc-panel-left-inner">
              <ServiceList
                services={services}
                selectedId={isCreating ? null : selectedId}
                onSelect={handleSelect}
                onAdd={handleAdd}
              />
            </div>
          </div>

          {/* Right: editor */}
          <div className="svc-panel-right">
            <div className="svc-panel-right-inner">
              <ServiceEditor
                service={selectedService}
                isCreating={isCreating}
                onSaved={handleSaved}
                onDeactivated={handleDeactivated}
              />
            </div>
          </div>
        </div>
      )}

      <style>{`
        .svc-page {
          color: var(--bodhion-text-primary);
        }

        /* ── Page header ── */
        .svc-page-header {
          background: var(--bodhion-shell-bg);
          backdrop-filter: blur(22px);
          -webkit-backdrop-filter: blur(22px);
          box-shadow: 0 24px 70px rgba(0,0,0,0.3);
        }
        .svc-page-header-glow {
          position: absolute;
          inset: 0;
          background:
            linear-gradient(120deg, rgba(0,104,201,0.13), transparent 34%),
            linear-gradient(120deg, transparent 45%, rgba(37,215,255,0.11), transparent 72%);
          pointer-events: none;
        }
        .svc-eyebrow-badge {
          display: inline-flex;
          align-items: center;
          border: 1px solid var(--bodhion-eyebrow-border, rgba(199,242,58,0.24));
          background: var(--bodhion-eyebrow-bg, rgba(118,209,26,0.08));
          padding: 0.28rem 0.65rem;
          border-radius: 999px;
          color: var(--bodhion-eyebrow-text, #c7f23a);
          font-size: 0.66rem;
          font-weight: 700;
          letter-spacing: 0.14em;
          text-transform: uppercase;
          width: fit-content;
        }
        .svc-page-title {
          font-size: clamp(1.2rem, 1rem + 0.5vw, 1.85rem);
          font-weight: 800;
          line-height: 1.05;
          letter-spacing: -0.02em;
          color: var(--bodhion-text-primary);
        }
        .svc-page-desc {
          font-size: 0.86rem;
          line-height: 1.55;
          color: var(--bodhion-text-secondary);
          max-width: 60rem;
        }

        /* ── Loading skeleton ── */
        .svc-loading-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(16rem, 1fr));
          gap: 0.75rem;
        }
        .svc-skeleton {
          height: 5rem;
          border-radius: 1rem;
          background: var(--bodhion-card-bg);
          border: 1px solid var(--bodhion-card-border);
          animation: pulse 1.6s ease-in-out infinite;
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.45; }
        }

        /* ── Two-panel layout ── */
        .svc-two-panel {
          display: grid;
          grid-template-columns: 18rem 1fr;
          gap: 0.75rem;
          align-items: start;
          min-height: 0;
        }

        @media (max-width: 768px) {
          .svc-two-panel {
            grid-template-columns: 1fr;
          }
        }

        /* Left panel */
        .svc-panel-left-inner {
          position: sticky;
          top: 5.5rem;
          padding: 1rem;
          border-radius: 1.4rem;
          border: 1px solid var(--bodhion-shell-border);
          background: var(--bodhion-shell-bg);
          backdrop-filter: blur(22px);
          -webkit-backdrop-filter: blur(22px);
          max-height: calc(100vh - 10rem);
          overflow-y: auto;
          scrollbar-width: thin;
          scrollbar-color: rgba(37,215,255,0.35) rgba(255,255,255,0.03);
        }
        .svc-panel-left-inner::-webkit-scrollbar { width: 5px; }
        .svc-panel-left-inner::-webkit-scrollbar-track { background: rgba(255,255,255,0.02); border-radius: 999px; }
        .svc-panel-left-inner::-webkit-scrollbar-thumb { background: rgba(37,215,255,0.4); border-radius: 999px; }

        /* Right panel */
        .svc-panel-right-inner {
          padding: 1rem;
          border-radius: 1.4rem;
          border: 1px solid var(--bodhion-shell-border);
          background: var(--bodhion-shell-bg);
          backdrop-filter: blur(22px);
          -webkit-backdrop-filter: blur(22px);
        }
      `}</style>
    </div>
  );
}
