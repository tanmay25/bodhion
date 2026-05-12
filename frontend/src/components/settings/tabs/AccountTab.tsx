'use client';

import { useEffect, useRef, useState } from 'react';
import {
  Copy, Check, Eye, EyeOff, Upload,
  ChevronDown, ChevronUp, RefreshCw, ShieldCheck,
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuthStore } from '@/store/authStore';
import { getToken } from '@/lib/auth/session';
import { updateUserProfile, updateUserPassword, getSessionUser } from '@/lib/api/auth';
import { getAPIKey, createAPIKey } from '@/lib/api/auth';

// ── Image resize helper ───────────────────────────────────────────────────────

function resizeToWebP(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      const SIZE = 250;
      const canvas = document.createElement('canvas');
      canvas.width = SIZE; canvas.height = SIZE;
      const ctx = canvas.getContext('2d');
      if (!ctx) { reject(new Error('canvas')); return; }
      const ar = img.width / img.height;
      let sx = 0, sy = 0, sw = img.width, sh = img.height;
      if (ar > 1) { sx = (img.width - img.height) / 2; sw = img.height; }
      else        { sy = (img.height - img.width) / 2; sh = img.width;  }
      ctx.drawImage(img, sx, sy, sw, sh, 0, 0, SIZE, SIZE);
      resolve(canvas.toDataURL('image/webp'));
    };
    img.onerror = reject;
    img.src = url;
  });
}

// ── Reusable field wrapper ────────────────────────────────────────────────────

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="acct-field">
      <label className="acct-label">{label}</label>
      {children}
    </div>
  );
}

// ── Password input with per-field eye toggle ──────────────────────────────────

function PasswordInput({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  const [show, setShow] = useState(false);
  return (
    <div className="acct-input-wrap">
      <input
        className="acct-input"
        type={show ? 'text' : 'password'}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete="off"
      />
      <button
        type="button"
        className="acct-eye-btn"
        onClick={() => setShow((v) => !v)}
        tabIndex={-1}
        aria-label={show ? 'Hide password' : 'Show password'}
      >
        {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
    </div>
  );
}

// ── Copy button ───────────────────────────────────────────────────────────────

function CopyBtn({ value, label }: { value: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    await navigator.clipboard.writeText(value).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button
      type="button"
      className="acct-icon-btn"
      onClick={() => void copy()}
      title={label ?? 'Copy'}
    >
      {copied
        ? <Check className="h-3.5 w-3.5 acct-copy-check" />
        : <Copy className="h-3.5 w-3.5" />}
    </button>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

interface Props { onRegisterSave: (fn: () => Promise<void>) => void; }

export function AccountTab({ onRegisterSave }: Props) {
  const user      = useAuthStore((s) => s.user);
  const config    = useAuthStore((s) => s.config);
  const setUser   = useAuthStore((s) => s.setUser);
  const imgRef    = useRef<HTMLInputElement>(null);

  // Profile state
  const [profileImageUrl, setProfileImageUrl] = useState(user?.profile_image_url ?? '');
  const [name,        setName]        = useState(user?.name ?? '');
  const [bio,         setBio]         = useState('');
  const [gender,      setGender]      = useState('');
  const [customGender,setCustomGender]= useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');

  // Password state
  const [showPassSection,  setShowPassSection]  = useState(false);
  const [currentPassword,  setCurrentPassword]  = useState('');
  const [newPassword,      setNewPassword]      = useState('');
  const [confirmPassword,  setConfirmPassword]  = useState('');

  // API key state
  const [showAPISection, setShowAPISection] = useState(false);
  const [apiKey,         setApiKey]         = useState('');

  const canUseAPIKeys: boolean =
    (config?.features?.enable_api_keys ?? true) &&
    (user?.role === 'admin' ||
      Boolean((user?.permissions?.features as Record<string, unknown> | undefined)?.api_keys));

  const showPasswordSection: boolean = config?.features?.enable_login_form ?? true;

  // Latest-ref pattern
  const latestRef = useRef({ name, profileImageUrl, bio, gender, customGender, dateOfBirth, setUser });
  latestRef.current = { name, profileImageUrl, bio, gender, customGender, dateOfBirth, setUser };

  // Load profile + API key on mount
  useEffect(() => {
    const load = async () => {
      const token = getToken();
      if (!token) return;
      try {
        const su = await getSessionUser(token);
        if (su) {
          setName(su.name ?? '');
          setProfileImageUrl(su.profile_image_url ?? '');
          const u = su as unknown as Record<string, unknown>;
          setBio(typeof u.bio === 'string' ? u.bio : '');
          setGender(typeof u.gender === 'string' ? u.gender : '');
          setDateOfBirth(typeof u.date_of_birth === 'string' ? u.date_of_birth : '');
        }
        if (canUseAPIKeys) {
          setApiKey((await getAPIKey(token).catch(() => '')) ?? '');
        }
      } catch { /* silent */ }
    };
    void load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canUseAPIKeys]);

  // Register save
  useEffect(() => {
    onRegisterSave(async () => {
      const { name: n, profileImageUrl: img, bio: b, gender: g, customGender: cg, dateOfBirth: dob, setUser: su } = latestRef.current;
      const token = getToken();
      if (!token) return;
      const finalGender = g === 'custom' ? cg : g;
      const updated = await updateUserProfile(token, {
        name: n,
        profile_image_url: img,
        bio: b || null,
        gender: finalGender || null,
        date_of_birth: dob || null,
      } as Parameters<typeof updateUserProfile>[1]).catch((e) => {
        toast.error(String(e?.detail ?? 'Failed to save profile'));
        return null;
      });
      if (updated) {
        const sessionUser = await getSessionUser(token).catch(() => null);
        if (sessionUser) su(sessionUser);
        toast.success('Profile saved');
      }
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onRegisterSave]);

  const handlePasswordSave = async () => {
    if (!newPassword || newPassword !== confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }
    const token = getToken();
    if (!token) return;
    await updateUserPassword(token, { password: currentPassword, new_password: newPassword })
      .then(() => {
        toast.success('Password updated');
        setCurrentPassword(''); setNewPassword(''); setConfirmPassword('');
        setShowPassSection(false);
      })
      .catch((e) => toast.error(String(e?.detail ?? 'Failed to update password')));
  };

  const handleGenerateAPIKey = async () => {
    const token = getToken();
    if (!token) return;
    const key = await createAPIKey(token).catch(() => null);
    if (key) { setApiKey(key); toast.success('New API key generated'); }
    else toast.error('Failed to generate API key');
  };

  const handleAvatarFile = async (file: File) => {
    try {
      setProfileImageUrl(await resizeToWebP(file));
    } catch {
      const r = new FileReader();
      r.onload = () => typeof r.result === 'string' && setProfileImageUrl(r.result);
      r.readAsDataURL(file);
    }
  };

  const isAdmin = user?.role === 'admin';

  return (
    <div className="settings-tab-content">

      {/* ── Profile ─────────────────────────────────────────────────────── */}
      <div className="settings-section">
        <div className="settings-section-title">Profile</div>

        {/* Avatar + identity strip */}
        <div className="acct-identity">
          {/* Avatar */}
          <div className="acct-avatar-wrap">
            <input
              ref={imgRef}
              type="file"
              accept="image/*"
              hidden
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) { e.target.value = ''; void handleAvatarFile(f); }
              }}
            />
            <button
              type="button"
              className="acct-avatar"
              onClick={() => imgRef.current?.click()}
              aria-label="Change profile photo"
            >
              {profileImageUrl
                ? <img src={profileImageUrl} alt={name} className="acct-avatar__img" />
                : <span className="acct-avatar__initials">{name.charAt(0).toUpperCase() || 'U'}</span>}
              <span className="acct-avatar__overlay">
                <Upload className="h-4 w-4" />
              </span>
            </button>
            <span className="acct-avatar__hint">Click to change</span>
          </div>

          {/* Email + role */}
          <div className="acct-identity-info">
            <span className="acct-email">{user?.email ?? ''}</span>
            <span className={`acct-role-badge ${isAdmin ? 'acct-role-badge--admin' : ''}`}>
              {isAdmin && <ShieldCheck className="h-3 w-3" />}
              {isAdmin ? 'Admin' : 'User'}
            </span>
          </div>
        </div>

        {/* Form fields */}
        <div className="acct-fields">
          <Field label="Display Name">
            <input
              className="acct-input"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter your name"
            />
          </Field>

          <Field label="Bio">
            <textarea
              className="acct-input acct-textarea"
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="Share your background and interests…"
              rows={3}
            />
          </Field>

          <div className="acct-row-2col">
            <Field label="Gender">
              <select
                className="acct-input acct-select"
                value={gender}
                onChange={(e) => setGender(e.target.value)}
              >
                <option value="">Prefer not to say</option>
                <option value="male">Male</option>
                <option value="female">Female</option>
                <option value="non-binary">Non-binary</option>
                <option value="custom">Custom…</option>
              </select>
              {gender === 'custom' && (
                <input
                  className="acct-input"
                  style={{ marginTop: '0.4rem' }}
                  type="text"
                  value={customGender}
                  onChange={(e) => setCustomGender(e.target.value)}
                  placeholder="Describe your gender"
                />
              )}
            </Field>

            <Field label="Date of Birth">
              <input
                className="acct-input acct-date"
                type="date"
                value={dateOfBirth}
                onChange={(e) => setDateOfBirth(e.target.value)}
              />
            </Field>
          </div>
        </div>
      </div>

      {/* ── Password ────────────────────────────────────────────────────── */}
      {showPasswordSection && (
        <div className="settings-section">
          <button
            type="button"
            className="acct-section-toggle"
            onClick={() => setShowPassSection((v) => !v)}
            aria-expanded={showPassSection}
          >
            <span className="settings-section-title" style={{ marginBottom: 0 }}>Password</span>
            {showPassSection
              ? <ChevronUp  className="h-4 w-4 acct-toggle-chevron" />
              : <ChevronDown className="h-4 w-4 acct-toggle-chevron" />}
          </button>

          {showPassSection && (
            <div className="acct-fields" style={{ marginTop: '1rem' }}>
              <Field label="Current Password">
                <PasswordInput
                  value={currentPassword}
                  onChange={setCurrentPassword}
                  placeholder="Enter current password"
                />
              </Field>
              <Field label="New Password">
                <PasswordInput
                  value={newPassword}
                  onChange={setNewPassword}
                  placeholder="Enter new password"
                />
              </Field>
              <Field label="Confirm New Password">
                <PasswordInput
                  value={confirmPassword}
                  onChange={setConfirmPassword}
                  placeholder="Re-enter new password"
                />
              </Field>
              <button
                type="button"
                className="acct-submit-btn"
                onClick={() => void handlePasswordSave()}
                disabled={!currentPassword || !newPassword || newPassword !== confirmPassword}
              >
                Update Password
              </button>
              {newPassword && confirmPassword && newPassword !== confirmPassword && (
                <p className="acct-error-hint">Passwords do not match</p>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── API Keys ─────────────────────────────────────────────────────── */}
      {canUseAPIKeys && (
        <div className="settings-section">
          <button
            type="button"
            className="acct-section-toggle"
            onClick={() => setShowAPISection((v) => !v)}
            aria-expanded={showAPISection}
          >
            <span className="settings-section-title" style={{ marginBottom: 0 }}>API Keys</span>
            {showAPISection
              ? <ChevronUp  className="h-4 w-4 acct-toggle-chevron" />
              : <ChevronDown className="h-4 w-4 acct-toggle-chevron" />}
          </button>

          {showAPISection && (
            <div className="acct-fields" style={{ marginTop: '1rem' }}>
              {/* JWT Token — admin only */}
              {isAdmin && (
                <Field label="JWT Token">
                  <div className="acct-secret-row">
                    <input
                      className="acct-input acct-mono"
                      type="password"
                      value={getToken() ?? ''}
                      readOnly
                    />
                    <CopyBtn value={getToken() ?? ''} label="Copy JWT token" />
                  </div>
                  <p className="acct-field-hint">
                    Your session token. Keep this private.
                  </p>
                </Field>
              )}

              {/* API Key */}
              <Field label="API Key">
                <div className="acct-secret-row">
                  <input
                    className="acct-input acct-mono"
                    type="password"
                    value={apiKey}
                    readOnly
                    placeholder="No API key yet — generate one below"
                  />
                  {apiKey && <CopyBtn value={apiKey} label="Copy API key" />}
                  <button
                    type="button"
                    className="acct-generate-btn"
                    onClick={() => void handleGenerateAPIKey()}
                    title="Generate a new API key (replaces current)"
                  >
                    <RefreshCw className="h-3.5 w-3.5" />
                    Generate New
                  </button>
                </div>
                {apiKey && (
                  <p className="acct-field-hint">
                    Generating a new key will invalidate the current one.
                  </p>
                )}
              </Field>
            </div>
          )}
        </div>
      )}

    </div>
  );
}
