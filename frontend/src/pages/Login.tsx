import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Lock, Mail, Phone, ArrowLeft, AlertCircle, ShieldCheck } from 'lucide-react';
import { loginOperator, signupOperator, setSessionToken } from '../lib/api';
import { DecryptedText, RadarBackdrop } from '../components/reactbits';

const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_SECONDS = 30;

export const Login: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const fromPath = (location.state as { from?: { pathname?: string } } | null)?.from?.pathname;

  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [lockoutRemaining, setLockoutRemaining] = useState(0);

  useEffect(() => {
    if (lockoutRemaining <= 0) return;
    const timer = setInterval(() => {
      setLockoutRemaining((prev) => {
        if (prev <= 1) {
          setFailedAttempts(0);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [lockoutRemaining]);

  const isLockedOut = lockoutRemaining > 0;

  const switchMode = (nextMode: 'login' | 'signup') => {
    setMode(nextMode);
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLockedOut || loading) return;

    const trimmedEmail = email.trim();
    if (!trimmedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      setError('Please enter a valid email address.');
      return;
    }
    if (mode === 'signup' && phone.replace(/[^0-9]/g, '').length < 7) {
      setError('Please enter a valid phone number.');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      if (mode === 'signup') {
        const res = await signupOperator(trimmedEmail, phone.trim(), password);
        setSessionToken(res.token);
        sessionStorage.removeItem('cpr_setup_complete');
        navigate('/setup', { replace: true });
      } else {
        const res = await loginOperator(trimmedEmail, password);
        setSessionToken(res.token);
        setFailedAttempts(0);
        if (res.setupComplete) {
          sessionStorage.setItem('cpr_setup_complete', 'true');
          navigate(fromPath && fromPath !== '/login' ? fromPath : '/dashboard', { replace: true });
        } else {
          sessionStorage.removeItem('cpr_setup_complete');
          navigate('/setup', { replace: true });
        }
      }
    } catch (err: any) {
      const nextAttempts = failedAttempts + 1;
      setFailedAttempts(nextAttempts);
      setError(err?.message || 'Authentication failed.');
      if (mode === 'login' && nextAttempts >= MAX_FAILED_ATTEMPTS) {
        setLockoutRemaining(LOCKOUT_SECONDS);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative overflow-hidden min-h-dvh bg-surface-base text-text-primary flex flex-col justify-center items-center px-4 py-12 safe-area-shell">
      <RadarBackdrop className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 opacity-25" />
      <div className="relative z-10 w-full max-w-sm space-y-6">
        <div className="text-center space-y-2">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-lg bg-surface-raised border border-border-strong text-accent">
            <ShieldCheck className="w-6 h-6" aria-hidden="true" />
          </div>
          <h1 className="text-xl font-bold tracking-tight text-text-primary">
            <DecryptedText text={mode === 'login' ? 'Operator Sign In' : 'Create Operator Account'} />
          </h1>
          <p className="text-xs text-text-muted">
            {mode === 'login'
              ? 'Sign in with your email and password to access the dashboard.'
              : 'Sign up once with your email, phone number, and password.'}
          </p>
        </div>

        <div className="flat-panel p-6 space-y-5">
          {/* Sign In / Sign Up Mode Switch */}
          <div className="grid grid-cols-2 gap-1 p-1 rounded-md bg-surface-sunken border border-border-subtle">
            <button
              type="button"
              onClick={() => switchMode('login')}
              className={`min-h-[44px] rounded text-xs font-semibold transition-colors ${
                mode === 'login'
                  ? 'bg-surface-raised text-text-primary border border-border-strong'
                  : 'text-text-muted hover:text-text-primary'
              }`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => switchMode('signup')}
              className={`min-h-[44px] rounded text-xs font-semibold transition-colors ${
                mode === 'signup'
                  ? 'bg-surface-raised text-text-primary border border-border-strong'
                  : 'text-text-muted hover:text-text-primary'
              }`}
            >
              Sign Up
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            <div>
              <label htmlFor="auth-email" className="block text-xs font-medium text-text-secondary mb-1.5">
                Email Address
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-text-muted absolute left-3 top-3.5" aria-hidden="true" />
                <input
                  id="auth-email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={isLockedOut || loading}
                  placeholder="operator@venue.org"
                  className="w-full min-h-[44px] pl-9 pr-3 py-2 text-sm rounded-md bg-surface-sunken border border-border-strong text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent disabled:opacity-50"
                  autoFocus
                />
              </div>
            </div>

            {mode === 'signup' && (
              <div>
                <label htmlFor="auth-phone" className="block text-xs font-medium text-text-secondary mb-1.5">
                  Phone Number
                </label>
                <div className="relative">
                  <Phone className="w-4 h-4 text-text-muted absolute left-3 top-3.5" aria-hidden="true" />
                  <input
                    id="auth-phone"
                    type="tel"
                    autoComplete="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    disabled={loading}
                    placeholder="+91 98765 43210"
                    className="w-full min-h-[44px] pl-9 pr-3 py-2 text-sm rounded-md bg-surface-sunken border border-border-strong text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent disabled:opacity-50"
                  />
                </div>
              </div>
            )}

            <div>
              <label htmlFor="auth-password" className="block text-xs font-medium text-text-secondary mb-1.5">
                Password
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-text-muted absolute left-3 top-3.5" aria-hidden="true" />
                <input
                  id="auth-password"
                  type="password"
                  autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={isLockedOut || loading}
                  placeholder="Minimum 6 characters"
                  className="w-full min-h-[44px] pl-9 pr-3 py-2 text-sm rounded-md bg-surface-sunken border border-border-strong text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent disabled:opacity-50"
                />
              </div>
            </div>

            {error && (
              <p role="alert" className="flex items-center gap-1.5 text-xs text-status-danger-text">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                <span>{error}</span>
              </p>
            )}

            {isLockedOut && (
              <div
                role="status"
                className="p-2.5 rounded-md bg-status-building-bg border border-status-building-border text-status-building-text text-xs text-center"
              >
                Too many attempts. Try again in {lockoutRemaining}s.
              </div>
            )}

            <button
              type="submit"
              disabled={isLockedOut || loading}
              className="w-full min-h-[44px] py-2.5 px-4 rounded-md bg-accent hover:bg-accent-hover text-slate-950 font-semibold text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading
                ? mode === 'signup'
                  ? 'Creating account...'
                  : 'Signing in...'
                : isLockedOut
                ? `Locked (${lockoutRemaining}s)`
                : mode === 'signup'
                ? 'Sign Up & Continue to Setup'
                : 'Sign In'}
            </button>
          </form>
        </div>

        <div className="text-center">
          <Link
            to="/"
            className="min-h-[44px] inline-flex items-center gap-1.5 text-xs text-text-muted hover:text-accent transition-colors rounded px-3 py-2"
          >
            <ArrowLeft className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Back to home</span>
          </Link>
        </div>
      </div>
    </div>
  );
};
