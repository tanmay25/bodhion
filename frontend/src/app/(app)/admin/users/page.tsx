import { redirect } from 'next/navigation';

export default function AdminUsersIndexPage() {
  redirect('/admin/users/overview');
}
