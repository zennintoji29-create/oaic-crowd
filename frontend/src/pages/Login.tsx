import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Lock, ArrowLeft, AlertCircle, ShieldCheck } from 'lucide-react';
import { authenticateMaster, setSessionToken } from '../lib/api';

const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_SECONDS = 30;

export const Login: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [credential, setCredential] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [lockoutRemaining, setLockoutRemaining] = useState(0);

  // Allow ?auth= query-string login ONLY in local development
  useEffect(() => {
    if (!(import.meta as any).env?.DEV) return;
    const devAuth = searchParams.get('auth');
    if (!devAuth) return;

    let active = true;
    setLoading(true);
    authenticateMaster(devAuth)
      .then((res) => {
        if (!active) return;
        setSessionToken(res.token);
        const isSetupDone = res.setupComplete || sessionStorage.getItem('cpr_setup_complete') === 'true';
        navigate(isSetupDone ? '/dashboard' : '/setup', { replace: true });
      })
      .catch(() => {
        if (active) setError('Invalid credentials');
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [searchParams, navigate]);

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLockedOut || loading || !credential.trim()) return;

    setLoading(true);
    setError(null);

    try {
      const res = await authenticateMaster(credential);
      setSessionToken(res.token);
      setFailedAttempts(0);
      const isSetupDone = res.setupComplete || sessionStorage.getItem('cpr_setup_complete') === 'true';
      navigate(isSetupDone ? '/dashboard' : '/setup', { replace: true });
    } catch {
      const nextAttempts = failedAttempts + 1;
      setFailedAttempts(nextAttempts);
      setError('Invalid credentials');
      setCredential('');

      if (nextAttempts >= MAX_FAILED_ATTEMPTS) {
        setLockoutRemaining(LOCKOUT_SECONDS);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-dvh bg-surface-base text-text-primary flex flex-col justify-center items-center px-4 py-12 safe-area-shell">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center space-y-2">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-lg bg-surface-raised border border-border-strong text-accent">
            <ShieldCheck className="w-6 h-6" aria-hidden="true" />
          </div>
          <h1 className="text-xl font-bold tracking-tight text-text-primary">Authorized Access</h1>
          <p className="text-xs text-text-muted">
            Sign in with your security credential to continue.
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="flat-panel p-6 space-y-4"
        >
          <div>
            <label htmlFor="access-credential" className="block text-xs font-medium text-text-secondary mb-1.5">
              Access Credential
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-text-muted absolute left-3 top-3.5" aria-hidden="true" />
              <input
                id="access-credential"
                type="password"
                autoComplete="off"
                value={credential}
                onChange={(e) => setCredential(e.target.value)}
                disabled={isLockedOut || loading}
                className="w-full min-h-[44px] pl-9 pr-3 py-2 text-sm rounded-md bg-surface-sunken border border-border-strong text-text-primary focus:outline-none focus:border-accent disabled:opacity-50"
                autoFocus
              />
            </div>
            {error && (
              <p role="alert" className="mt-1.5 flex items-center gap-1.5 text-xs text-status-danger-text">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                <span>{error}</span>
              </p>
            )}
          </div>

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
            disabled={isLockedOut || loading || !credential.trim()}
            className="w-full min-h-[44px] py-2.5 px-4 rounded-md bg-accent hover:bg-accent-hover text-slate-950 font-semibold text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Verifying...' : isLockedOut ? `Locked (${lockoutRemaining}s)` : 'Continue'}
          </button>
        </form>

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
