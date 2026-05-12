import { Shell } from '@/components/layout/Shell';

interface DashboardShellProps {
  children: React.ReactNode;
}

export function DashboardShell({ children }: DashboardShellProps) {
  return (
    <Shell>
      <div className="flex h-full flex-col overflow-hidden p-4 sm:p-6">{children}</div>
    </Shell>
  );
}

export default DashboardShell;
