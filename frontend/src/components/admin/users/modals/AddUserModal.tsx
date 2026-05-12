'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { getToken } from '@/lib/auth/session';
import { adminCreateUser } from '@/lib/api/admin/users';
import type { AdminUser } from '@/types/api';

interface AddUserModalProps {
  open:      boolean;
  onClose:   () => void;
  onCreated: (user: AdminUser) => void;
}

const FIELD_CLS = 'admin-input h-9 w-full rounded-md px-3 text-sm';

export function AddUserModal({ open, onClose, onCreated }: AddUserModalProps) {
  const [name,     setName]     = useState('');
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [role,     setRole]     = useState('user');
  const [saving,   setSaving]   = useState(false);
  const [errors,   setErrors]   = useState<Record<string, string>>({});

  const reset = () => {
    setName(''); setEmail(''); setPassword(''); setRole('user'); setErrors({});
  };

  const validate = () => {
    const e: Record<string, string> = {};
    if (!name.trim())     e.name     = 'Name is required';
    if (!email.trim())    e.email    = 'Email is required';
    if (!password.trim()) e.password = 'Password is required';
    else if (password.length < 8) e.password = 'Minimum 8 characters';
    return e;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length) { setErrors(errs); return; }
    setSaving(true);
    try {
      const token = getToken();
      if (!token) throw new Error('No token');
      const user = await adminCreateUser(token, { name: name.trim(), email: email.trim(), password, role });
      onCreated(user);
      reset();
    } catch (err: unknown) {
      const detail = (err as { detail?: string })?.detail;
      toast.error(detail ?? 'Failed to create user');
    } finally {
      setSaving(false);
    }
  };

  const handleClose = () => { reset(); onClose(); };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent className="admin-dialog sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add new user</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {/* Name */}
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium">Full name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Jane Doe"
              className={FIELD_CLS}
              autoFocus
            />
            {errors.name && <p className="text-xs text-destructive">{errors.name}</p>}
          </div>

          {/* Email */}
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium">Email address</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="jane@example.com"
              className={FIELD_CLS}
            />
            {errors.email && <p className="text-xs text-destructive">{errors.email}</p>}
          </div>

          {/* Password */}
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Min. 8 characters"
              className={FIELD_CLS}
            />
            {errors.password && <p className="text-xs text-destructive">{errors.password}</p>}
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

          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={handleClose} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? 'Creating…' : 'Create user'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default AddUserModal;
