import { Badge } from '@/components/ui/Badge';
import type { UserRole } from '@/types/auth';

const roleVariant: Record<UserRole, 'default' | 'secondary' | 'outline' | 'destructive'> = {
  admin: 'default',
  user: 'secondary',
  pending: 'outline',
};

const roleLabel: Record<UserRole, string> = {
  admin: 'Admin',
  user: 'User',
  pending: 'Pending',
};

interface RoleTagProps {
  role: UserRole;
}

export function RoleTag({ role }: RoleTagProps) {
  return <Badge variant={roleVariant[role] ?? 'outline'}>{roleLabel[role] ?? role}</Badge>;
}

export default RoleTag;
