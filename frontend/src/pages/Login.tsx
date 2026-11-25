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
        navigate(res.setupComplete ? '/remote' : '/setup', { replace: true });
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

  // Countdown timer for client-side lockout
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
      navigate(res.setupComplete ? '/remote' : '/setup', { replace: true });
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
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-center items-center px-4 py-12">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center space-y-2">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
            <ShieldCheck className="w-6 h-6" aria-hidden="true" />
          </div>
          <h1 className="text-xl font-bold tracking-tight text-white">Operator Login</h1>
          <p className="text-xs text-slate-400">
            Enter your operator PIN or access key to manage setup, sandbox, and gate controls.
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="rounded-xl border border-slate-800 bg-slate-900/70 p-6 space-y-4 shadow-xl"
        >
          <div>
            <label htmlFor="operator-credential" className="block text-xs font-medium text-slate-300 mb-1.5">
              PIN or Access Key
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-500 absolute left-3 top-3" aria-hidden="true" />
              <input
                id="operator-credential"
                type="password"
                autoComplete="off"
                value={credential}
                onChange={(e) => setCredential(e.target.value)}
                disabled={isLockedOut || loading}
                placeholder="Enter PIN or access key"
                className="w-full pl-9 pr-3 py-2.5 text-sm rounded-lg bg-slate-950 border border-slate-700 text-white placeholder:text-slate-600 focus:outline-none focus:border-emerald-500 disabled:opacity-50"
                autoFocus
              />
            </div>
          </div>

          {error && (
            <div
              role="alert"
              className="flex items-center gap-2 p-2.5 rounded-lg bg-rose-950/60 border border-rose-800 text-rose-300 text-xs"
            >
              <AlertCircle className="w-4 h-4 shrink-0" aria-hidden="true" />
              <span>{error}</span>
            </div>
          )}

          {isLockedOut && (
            <div
              role="status"
              className="p-2.5 rounded-lg bg-amber-950/60 border border-amber-800 text-amber-300 text-xs font-mono text-center"
            >
              Too many attempts. Try again in {lockoutRemaining}s.
            </div>
          )}

          <button
            type="submit"
            disabled={isLockedOut || loading || !credential.trim()}
            className="w-full py-2.5 px-4 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-semibold text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300"
          >
            {loading ? 'Verifying...' : isLockedOut ? `Locked (${lockoutRemaining}s)` : 'Sign in'}
          </button>
        </form>

        <div className="text-center">
          <Link
            to="/dashboard"
            className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-emerald-400 transition-colors rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 px-2 py-1"
          >
            <ArrowLeft className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Back to dashboard</span>
          </Link>
        </div>
      </div>
    </div>
  );
};
