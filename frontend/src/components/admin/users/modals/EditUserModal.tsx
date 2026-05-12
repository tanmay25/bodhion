'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/Avatar';
import { cn }     from '@/lib/utils/cn';
import { getToken } from '@/lib/auth/session';
import { adminUpdateUser } from '@/lib/api/admin/users';
import type { AdminUser } from '@/types/api';

interface EditUserModalProps {
  user:    AdminUser | null;
  open:    boolean;
  onClose: () => void;
  onSaved: (user: AdminUser) => void;
}

const FIELD_CLS = 'admin-input h-9 w-full rounded-md px-3 text-sm';

function userInitials(name: string) {
  return name.split(' ').slice(0, 2).map((w) => w[0]).join('').toUpperCase();
}

export function EditUserModal({ user, open, onClose, onSaved }: EditUserModalProps) {
  const [name,        setName]        = useState('');
  const [profileUrl,  setProfileUrl]  = useState('');
  const [role,        setRole]        = useState('user');
  const [newPassword, setNewPassword] = useState('');
  const [saving,      setSaving]      = useState(false);

  // Sync form when user changes
  useEffect(() => {
    if (user) {
      setName(user.name);
      setProfileUrl(user.profile_image_url ?? '');
      setRole(user.role);
      setNewPassword('');
    }
  }, [user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSaving(true);
    try {
      const token = getToken();
      if (!token) throw new Error('No token');
      const body: Partial<AdminUser> & { password?: string } = {
        name:              name.trim(),
        profile_image_url: profileUrl.trim() || undefined,
        role,
      };
      if (newPassword.trim()) body.password = newPassword.trim();
      const updated = await adminUpdateUser(token, user.id, body);
      onSaved({ ...user, ...updated });
    } catch (err: unknown) {
      const detail = (err as { detail?: string })?.detail;
      toast.error(detail ?? 'Failed to update user');
    } finally {
      setSaving(false);
    }
  };

  if (!user) return null;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="admin-dialog sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit user</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {/* Avatar preview */}
          <div className="flex items-center gap-3">
            <Avatar className="h-12 w-12">
              <AvatarImage src={profileUrl || undefined} alt={name} />
              <AvatarFallback>{userInitials(name || user.name)}</AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <label className="mb-1 block text-xs font-medium" style={{ color: 'var(--bodhion-text-secondary)' }}>
                Profile image URL
              </label>
              <input
                type="url"
                value={profileUrl}
                onChange={(e) => setProfileUrl(e.target.value)}
                placeholder="https://…"
                className={FIELD_CLS}
              />
            </div>
          </div>

          {/* Name */}
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium">Full name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={FIELD_CLS}
              required
              autoFocus
            />
          </div>

          {/* Email – read-only */}
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium" style={{ color: 'var(--bodhion-text-secondary)' }}>Email (read-only)</label>
            <input
              type="email"
              value={user.email}
              disabled
              className={cn(FIELD_CLS, 'opacity-60 cursor-not-allowed')}
            />
          </div>

          {/* Role */}
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium">Role</label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className="admin-select h-9 w-full rounded-md px-3 text-sm cursor-pointer"
            >
              <option value="user">User</option>
              <option value="admin">Admin</option>
              <option value="pending">Pending</option>
            </select>
          </div>

          {/* New password (optional) */}
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium">
              New password{' '}
              <span className="font-normal" style={{ color: 'var(--bodhion-text-secondary)' }}>(leave blank to keep current)</span>
            </label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Enter new password…"
              className={FIELD_CLS}
              minLength={8}
            />
          </div>

          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={onClose} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? 'Saving…' : 'Save changes'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default EditUserModal;
