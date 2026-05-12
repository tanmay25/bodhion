import { FunctionList } from '@/components/admin/functions/FunctionList';

export default function WorkspaceFunctionsPage() {
  return (
    <div className="flex flex-col gap-4 p-6">
      <FunctionList routePrefix="/workspace/functions" />
    </div>
  );
}
