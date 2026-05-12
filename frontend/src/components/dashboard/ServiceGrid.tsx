import { ServiceCard } from './ServiceCard';
import type { DashboardService } from './services';

interface ServiceGridProps {
  services: DashboardService[];
}

export function ServiceGrid({ services }: ServiceGridProps) {
  return (
    <section className="space-y-4">
      <div>
        <h2
          className="sg-title font-bold leading-[1.12] tracking-[-0.015em]"
          style={{ fontSize: 'clamp(1.45rem, 1.2rem + 0.5vw, 1.9rem)' }}
        >
          AI Services
        </h2>
        <p className="sg-desc mt-1 text-[0.95rem] font-medium leading-[1.5]">
          Choose a service to start working with Bodhion.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {services.map((service) => (
          <ServiceCard key={service.id} service={service} />
        ))}
      </div>

      <style>{`
        .sg-title { color: var(--bodhion-text-primary); }
        .sg-desc  { color: var(--bodhion-text-secondary); }
      `}</style>
    </section>
  );
}

export default ServiceGrid;
