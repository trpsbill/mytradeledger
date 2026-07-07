import { useState } from 'react';
import { Link } from 'react-router-dom';
import { authApi } from '../../services/api';
import { useTheme } from '../../hooks';

export function ForgotPasswordPage() {
  const { theme, toggleTheme } = useTheme();

  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  async function handleSubmit() {
    setSubmitting(true);
    try {
      await authApi.forgotPassword(email, () => setVerifying(true));
    } catch {
      // Intentionally ignore errors — always show the same generic message.
    } finally {
      setSubmitting(false);
      setVerifying(false);
      setSubmitted(true);
    }
  }

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
          <span className="text-sm text-base-content/60 mr-2">Remembered it?</span>
          <Link to="/login" className="btn btn-primary btn-sm">Log in</Link>
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center p-4">
        <div className="card bg-base-100 shadow-xl w-full max-w-md">
          <div className="card-body">
            <h1 className="text-2xl font-bold mb-6">Reset your password</h1>

            {submitted ? (
              <div className="space-y-4">
                <div className="alert alert-success">
                  <span>If that email exists, a reset link was sent.</span>
                </div>
                <Link to="/login" className="btn btn-primary w-full">Back to log in</Link>
              </div>
            ) : (
              <div className="space-y-4">
                <p className="text-sm text-base-content/70">
                  Enter your account email and we'll send you a link to reset your password.
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
                    autoFocus
                  />
                </div>

                <button
                  type="button"
                  className="btn btn-primary w-full mt-2"
                  disabled={submitting || !email}
                  onClick={handleSubmit}
                >
                  {verifying ? (
                    <>
                      <span className="loading loading-spinner loading-sm" />
                      Verifying you&rsquo;re human&hellip;
                    </>
                  ) : submitting ? (
                    <span className="loading loading-spinner loading-sm" />
                  ) : (
                    'Send reset link'
                  )}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
