import { useState } from 'react';
import { authApi } from '../services/api';
import { useAuth } from '../contexts/AuthContext';

/**
 * Shown across the authenticated app while the signed-in user's email address
 * is still unverified. Offers a one-click way to resend the verification link.
 */
export function EmailVerificationBanner() {
  const { user } = useAuth();
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);

  if (!user || user.emailVerified) {
    return null;
  }

  async function handleResend() {
    setSubmitting(true);
    try {
      await authApi.resendVerification(user!.email);
    } catch {
      // Ignore — the endpoint is intentionally generic.
    } finally {
      setSubmitting(false);
      setSent(true);
    }
  }

  return (
    <div className="alert alert-warning rounded-none justify-center text-sm">
      <span>
        Please verify your email address ({user.email}) to secure your account.
      </span>
      {sent ? (
        <span className="font-medium">Verification email sent — check your inbox.</span>
      ) : (
        <button
          type="button"
          className="btn btn-sm btn-ghost"
          disabled={submitting}
          onClick={handleResend}
        >
          {submitting ? <span className="loading loading-spinner loading-xs" /> : 'Resend link'}
        </button>
      )}
    </div>
  );
}
