import { FunctionList } from '@/components/admin/functions/FunctionList';

export default function AdminFunctionsPage() {
  return (
    <div className="flex flex-col gap-4 p-6">
      <div>
        <h1 className="text-xl font-semibold" style={{ color: 'var(--bodhion-text-primary)' }}>
          Functions
        </h1>
        <p className="mt-0.5 text-sm" style={{ color: 'var(--bodhion-text-secondary)' }}>
          Manage global functions available to all users.
        </p>
      </div>
      <FunctionList />
    </div>
  );
}
