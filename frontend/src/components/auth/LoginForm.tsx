'use client';

import { useState, FormEvent } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import { Spinner } from '@/components/ui/Spinner';
import { userSignIn, userSignUp, ldapUserSignIn, getBackendConfig } from '@/lib/api/auth';
import { setToken } from '@/lib/auth/session';
import { useAuthStore } from '@/store/authStore';
import type { BackendConfig } from '@/types/config';
import type { SessionUser } from '@/types/auth';

type Mode = 'signin' | 'signup' | 'ldap';

interface LoginFormProps {
  config: BackendConfig | null;
  onSuccess: () => void;
  isOnboarding?: boolean;
}

/* ── Eye icons (inline SVG — no extra dep) ─────────────────────────────── */
function EyeIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={18} height={18} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function EyeOffIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={18} height={18} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  );
}

export function LoginForm({ config, onSuccess, isOnboarding = false }: LoginFormProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { setConfig, setUser } = useAuthStore();

  const initialMode: Mode = isOnboarding
    ? (config?.features?.enable_ldap ? 'ldap' : 'signup')
    : (config?.features?.enable_ldap ? 'ldap' : 'signin');
  const [mode, setMode]               = useState<Mode>(initialMode);
  const [loading, setLoading]         = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe]   = useState(false);

  // Shared
  const [email, setEmail]             = useState('');
  const [password, setPassword]       = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  // Sign-up only
  const [name, setName]               = useState('');
  // LDAP only
  const [ldapUsername, setLdapUsername] = useState('');

  function handleSuccess(session: SessionUser) {
    // 1. Persist token
    setToken(session.token!);
    // 2. Sync user into Zustand BEFORE navigating so (app)/layout.tsx
    //    immediately sees an authenticated user and never bounces back to /login.
    setUser(session);
    // 3. Navigate immediately — no awaiting any further async work.
    //    getBackendConfig runs in the background after the page has already changed.
    const redirect = searchParams.get('redirect') ?? '/';
    onSuccess();
    router.push(redirect);
    // Background: refresh config without blocking navigation.
    // During onboarding this confirms onboarding:false so the splash won't re-appear.
    getBackendConfig().then((cfg) => { if (cfg) setConfig(cfg); }).catch(() => {});
  }

  async function handleSignIn(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const session = await userSignIn({ email, password });
      if (session?.token) {
        toast.success("You're now logged in.");
        handleSuccess(session);  // not awaited — navigates synchronously
      } else {
        setLoading(false);
      }
    } catch (err) {
      toast.error(String(err));
      setLoading(false);
    }
  }

  async function handleSignUp(e: FormEvent) {
    e.preventDefault();
    if (config?.features?.enable_signup_password_confirmation && password !== confirmPassword) {
      toast.error('Passwords do not match.');
      return;
    }
    setLoading(true);
    try {
      const session = await userSignUp({ name, email, password, profile_image_url: '' });
      if (session?.token) {
        toast.success("You're now logged in.");
        handleSuccess(session);  // not awaited — navigates synchronously
      } else {
        setLoading(false);
      }
    } catch (err) {
      toast.error(String(err));
      setLoading(false);
    }
  }

  async function handleLdap(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const session = await ldapUserSignIn({ user: ldapUsername, password });
      if (session?.token) {
        toast.success("You're now logged in.");
        handleSuccess(session);  // not awaited — navigates synchronously
      } else {
        setLoading(false);
      }
    } catch (err) {
      toast.error(String(err));
      setLoading(false);
    }
  }

  const submitHandler =
    mode === 'ldap' ? handleLdap : mode === 'signup' ? handleSignUp : handleSignIn;

  return (
    <>
      {/* ── Heading ──────────────────────────────────────────────────── */}
      <div className="login-copy">
        <h1>
          {isOnboarding
            ? 'Set up your workspace'
            : mode === 'signup'
            ? 'Sign up to Bodhion'
            : mode === 'ldap'
            ? 'Sign in with LDAP'
            : 'Sign in to Bodhion'}
        </h1>
        {isOnboarding ? (
          <p>
            Create the first admin account. Bodhion runs fully on your
            infrastructure — your data never leaves your network.
          </p>
        ) : (
          <p>Access your Bodhion GenAI workspace.</p>
        )}
      </div>

      {/* ── Form ─────────────────────────────────────────────────────── */}
      <form className="login-form" onSubmit={submitHandler}>

        {/* Name (signup only) */}
        {mode === 'signup' && (
          <div className="field-group">
            <label htmlFor="name">Name</label>
            <div className="input-shell">
              <input
                id="name"
                type="text"
                placeholder="Enter Your Full Name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                autoComplete="name"
              />
            </div>
          </div>
        )}

        {/* Email or LDAP username */}
        {mode === 'ldap' ? (
          <div className="field-group">
            <label htmlFor="ldap-user">LDAP Username</label>
            <div className="input-shell">
              <input
                id="ldap-user"
                type="text"
                placeholder="Enter Your Username"
                value={ldapUsername}
                onChange={(e) => setLdapUsername(e.target.value)}
                required
                autoComplete="username"
              />
            </div>
          </div>
        ) : (
          <div className="field-group">
            <label htmlFor="email">Email</label>
            <div className="input-shell">
              <input
                id="email"
                type="email"
                placeholder="Enter Your Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
              />
            </div>
          </div>
        )}

        {/* Password */}
        <div className="field-group">
          <label htmlFor="password">Password</label>
          <div className="input-shell">
            <input
              id="password"
              type={showPassword ? 'text' : 'password'}
              placeholder="Enter Your Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
            />
            <button
              type="button"
              className="eye-btn"
              onClick={() => setShowPassword((v) => !v)}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? <EyeOffIcon /> : <EyeIcon />}
            </button>
          </div>
        </div>

        {/* Confirm password (signup + config flag) */}
        {mode === 'signup' && config?.features?.enable_signup_password_confirmation && (
          <div className="field-group">
            <label htmlFor="confirm-password">Confirm Password</label>
            <div className="input-shell">
              <input
                id="confirm-password"
                type={showPassword ? 'text' : 'password'}
                placeholder="Confirm Your Password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                autoComplete="new-password"
              />
            </div>
          </div>
        )}

        {/* Remember me + Forgot password (signin/ldap only) */}
        {mode !== 'signup' && (
          <div className="form-row">
            <label className="checkbox-wrap">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
              />
              <span className="checkmark" />
              <span>Remember me</span>
            </label>
            <button type="button" className="text-link">
              Forgot password?
            </button>
          </div>
        )}

        {/* Submit */}
        <div style={{ marginTop: '16px' }}>
          <button type="submit" className="signin-btn" disabled={loading}>
            {loading && <Spinner size="sm" className="mr-2" />}
            {isOnboarding
              ? 'Create Admin Account'
              : mode === 'signup'
              ? 'Create Account'
              : mode === 'ldap'
              ? 'Authenticate'
              : 'Sign in'}
          </button>
        </div>

        {/* Mode switchers — hidden during onboarding (no escaping to sign-in) */}
        {!isOnboarding && (
          <div className="admin-note">
            {mode !== 'signup' && config?.features?.enable_signup && (
              <>
                Don&apos;t have an account?{' '}
                <button type="button" className="text-link" onClick={() => setMode('signup')}>
                  Sign up
                </button>
              </>
            )}
            {mode === 'signup' && (
              <>
                Already have an account?{' '}
                <button type="button" className="text-link" onClick={() => setMode('signin')}>
                  Sign in
                </button>
              </>
            )}
          </div>
        )}

        {/* LDAP toggle */}
        {config?.features?.enable_ldap && config?.features?.enable_login_form && (
          <div className="ldap-toggle-row">
            <button
              type="button"
              className="text-link"
              onClick={() =>
                setMode((m) => (m === 'ldap' ? 'signin' : 'ldap'))
              }
            >
              {mode === 'ldap' ? 'Continue with Email' : 'Continue with LDAP'}
            </button>
          </div>
        )}
      </form>

      {/* ── Scoped styles ──────────────────────────────────────────────── */}
      <style>{`
        .login-copy h1 {
          margin: 0;
          font-size: clamp(22px, 3.2vh, 32px);
          line-height: 1.06;
          letter-spacing: -0.035em;
          font-weight: 700;
          color: #0f172a;
        }

        .login-copy p {
          margin: 8px 0 0;
          color: #425466;
          font-size: clamp(14px, 1.9vh, 17px);
          line-height: 1.5;
        }

        .login-form {
          margin-top: 24px;
        }

        .field-group {
          margin-bottom: 16px;
        }

        .field-group label {
          display: block;
          margin-bottom: 8px;
          font-size: 15px;
          font-weight: 500;
          color: #111827;
        }

        .input-shell {
          height: 56px;
          border: 1px solid #a8bdd0;
          border-radius: 14px;
          background: rgba(255,255,255,0.92);
          padding: 0 14px;
          display: flex;
          align-items: center;
          gap: 8px;
          transition: border-color 0.18s ease, box-shadow 0.18s ease;
        }

        .input-shell:focus-within {
          border-color: #22d3ee;
          box-shadow: 0 0 0 3px rgba(34,211,238,0.15);
        }

        .input-shell input {
          flex: 1;
          border: none;
          outline: none;
          background: transparent;
          font-size: 16px;
          color: #0f172a;
          min-width: 0;
        }

        .input-shell input::placeholder {
          color: #8a98aa;
        }

        .eye-btn {
          flex-shrink: 0;
          background: none;
          border: none;
          padding: 4px;
          cursor: pointer;
          color: #8a98aa;
          display: flex;
          align-items: center;
          line-height: 1;
          border-radius: 6px;
          transition: color 0.15s;
        }

        .eye-btn:hover { color: #334155; }

        .form-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          font-size: 15px;
          color: #475467;
          margin-bottom: 8px;
        }

        .checkbox-wrap {
          display: inline-flex;
          align-items: center;
          gap: 10px;
          cursor: pointer;
          position: relative;
          user-select: none;
        }

        .checkbox-wrap input[type="checkbox"] {
          position: absolute;
          opacity: 0;
          width: 0;
          height: 0;
        }

        .checkmark {
          width: 18px;
          height: 18px;
          border-radius: 6px;
          border: 1.5px solid #cbd5e1;
          background: white;
          flex-shrink: 0;
          transition: background 0.15s, border-color 0.15s;
        }

        .checkbox-wrap input[type="checkbox"]:checked + .checkmark {
          background: linear-gradient(135deg, #0f766e, #22d3ee);
          border-color: transparent;
        }

        .text-link {
          color: #155eef;
          font-weight: 600;
          background: transparent;
          border: none;
          padding: 0;
          cursor: pointer;
          font-size: inherit;
          line-height: inherit;
        }

        .text-link:hover { text-decoration: underline; }

        .signin-btn {
          width: 100%;
          height: 58px;
          border: none;
          border-radius: 14px;
          font-size: 17px;
          font-weight: 700;
          color: white;
          background: linear-gradient(135deg, #0f766e 0%, #0891b2 55%, #22d3ee 100%);
          box-shadow: 0 4px 16px rgba(8,145,178,0.35);
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: opacity 0.2s ease, transform 0.1s ease;
        }

        .signin-btn:hover:not(:disabled) { opacity: 0.88; }
        .signin-btn:active:not(:disabled) { transform: scale(0.99); }
        .signin-btn:disabled { opacity: 0.6; cursor: not-allowed; }

        .admin-note {
          margin-top: 12px;
          font-size: 14px;
          color: #546a80;
        }

        .ldap-toggle-row {
          margin-top: 10px;
          font-size: 14px;
        }
      `}</style>
    </>
  );
}

export default LoginForm;
