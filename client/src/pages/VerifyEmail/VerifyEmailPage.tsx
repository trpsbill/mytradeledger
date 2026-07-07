import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { authApi } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../hooks';

type Status = 'verifying' | 'success' | 'error';

export function VerifyEmailPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') || '';
  const { theme, toggleTheme } = useTheme();
  const { user, refreshUser } = useAuth();

  const [status, setStatus] = useState<Status>('verifying');
  // Guard against React 18 StrictMode double-invoking the effect in dev.
  const startedRef = useRef(false);

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;

    if (!token) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setStatus('error');
      return;
    }

    authApi
      .verifyEmail(token)
      .then(() => {
        setStatus('success');
        // Refresh the cached user so any "unverified" banner clears immediately.
        refreshUser().catch(() => {});
      })
      .catch(() => setStatus('error'));
  }, [token, refreshUser]);

  return (
    <div className="min-h-screen bg-base-200 flex flex-col">
      <div className="navbar bg-base-100 shadow-sm">
        <div className="flex-1">
          <Link to="/" className="btn btn-ghost text-lg gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" className="h-6 w-6">
              <rect width="100" height="100" rx="10" fill="#570df8"/>
              <text x="50" y="68" fontFamily="Arial, sans-serif" fontSize="50" fontWeight="bold" fill="white" textAnchor="middle">TL</text>
            </svg>
            MyTradeLedger
          </Link>
        </div>
        <div className="flex-none gap-1">
          <button className="btn btn-ghost btn-circle" onClick={toggleTheme} aria-label="Toggle theme">
            {theme === 'light' ? (
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
              </svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
            )}
          </button>
          <Link to={user ? '/app' : '/login'} className="btn btn-primary btn-sm">
            {user ? 'Go to app' : 'Log in'}
          </Link>
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center p-4">
        <div className="card bg-base-100 shadow-xl w-full max-w-md">
          <div className="card-body">
            <h1 className="text-2xl font-bold mb-6">Email verification</h1>

            {status === 'verifying' && (
              <div className="flex items-center gap-3 text-base-content/70">
                <span className="loading loading-spinner loading-md" />
                <span>Verifying your email address…</span>
              </div>
            )}

            {status === 'success' && (
              <div className="space-y-4">
                <div className="alert alert-success">
                  <span>Your email address has been verified. Thank you!</span>
                </div>
                <Link to={user ? '/app' : '/login'} className="btn btn-primary w-full">
                  {user ? 'Go to dashboard' : 'Log in'}
                </Link>
              </div>
            )}

            {status === 'error' && <VerifyError />}
          </div>
        </div>
      </div>
    </div>
  );
}

function VerifyError() {
  const { user } = useAuth();
  const [email, setEmail] = useState(user?.email ?? '');
  const [submitting, setSubmitting] = useState(false);
  const [resent, setResent] = useState(false);

  async function handleResend() {
    setSubmitting(true);
    try {
      await authApi.resendVerification(email);
    } catch {
      // Intentionally ignore errors — always show the same generic message.
    } finally {
      setSubmitting(false);
      setResent(true);
    }
  }

  if (resent) {
    return (
      <div className="space-y-4">
        <div className="alert alert-success">
          <span>If that account needs verifying, a new link is on its way.</span>
        </div>
        <Link to={user ? '/app' : '/login'} className="btn btn-primary w-full">
          {user ? 'Back to app' : 'Back to log in'}
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="alert alert-error">
        <span>This verification link is invalid or has expired.</span>
      </div>
      <p className="text-sm text-base-content/70">
        Enter your account email and we'll send you a fresh verification link.
      </p>
      <div className="form-control">
        <label className="label" htmlFor="email">
          <span className="label-text font-medium">Email address</span>
        </label>
        <input
          id="email"
          type="email"
          className="input input-bordered w-full"
          placeholder="you@example.com"
          value={email}
          onChange={e => setEmail(e.target.value)}
          autoComplete="email"
        />
      </div>
      <button
        type="button"
        className="btn btn-primary w-full mt-2"
        disabled={submitting || !email}
        onClick={handleResend}
      >
        {submitting ? <span className="loading loading-spinner loading-sm" /> : 'Send a new link'}
      </button>
    </div>
  );
}
