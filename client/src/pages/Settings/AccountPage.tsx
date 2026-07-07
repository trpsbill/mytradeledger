import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useApi } from '../../hooks';
import { billingApi } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import { LoadingSpinner, ErrorAlert, Modal } from '../../components';
import { trackEvent, getGa4ClientId } from '../../services/analytics';
import { track } from '../../services/betterstack';

export function AccountPage() {
  const { user, keepAlive, refreshUser } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const { data: status, loading, error, refetch } = useApi(
    () => billingApi.getStatus(),
    []
  );

  const [upgradeSuccess, setUpgradeSuccess] = useState(false);
  const [upgradeLoading, setUpgradeLoading] = useState<'monthly' | 'yearly' | null>(null);
  const [upgradeError, setUpgradeError] = useState<string | null>(null);
  const [portalLoading, setPortalLoading] = useState(false);

  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelSuccess, setCancelSuccess] = useState(false);
  const [cancelPreset, setCancelPreset] = useState<string | null>(null);
  const [cancelNote, setCancelNote] = useState('');
  const [cancelLoading, setCancelLoading] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);

  const CANCEL_PRESETS = [
    'Too expensive',
    'Not using it enough',
    'Missing a feature I need',
    'Found a better alternative',
    'Just trying it out',
    'Other',
  ];

  // Handle return from Stripe Checkout
  useEffect(() => {
    if (searchParams.get('payment') !== 'success') return;
    const sessionId = searchParams.get('session_id') ?? undefined;
    const plan = sessionStorage.getItem('mtl_checkout_plan') as 'monthly' | 'yearly' | null;
    sessionStorage.removeItem('mtl_checkout_plan');
    const next = new URLSearchParams(searchParams);
    next.delete('payment');
    next.delete('session_id');
    setSearchParams(next, { replace: true });
    Promise.all([keepAlive(), refreshUser()]).catch(() => {});
    refetch();
    const value = plan === 'yearly' ? 48 : 5;
    trackEvent('purchase', {
      transaction_id: sessionId,
      value,
      currency: 'USD',
      items: [{ item_id: plan ?? 'monthly', item_name: `Pro ${plan ?? 'monthly'}`, price: value, quantity: 1 }],
    });
    track('subscribe', { userId: user?.id, plan: plan ?? 'monthly', value, currency: 'USD', sessionId });
    const show = setTimeout(() => setUpgradeSuccess(true), 0);
    return () => clearTimeout(show);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const buildCancelReason = () => {
    const note = cancelNote.trim();
    if (cancelPreset && cancelPreset !== 'Other') {
      return note ? `${cancelPreset} — ${note}` : cancelPreset;
    }
    return note || undefined;
  };

  const handleManageBilling = async () => {
    setPortalLoading(true);
    try {
      const res = await billingApi.createPortalSession();
      window.location.href = res.data.url;
    } catch {
      setPortalLoading(false);
    }
  };

  const handleUpgrade = async (plan: 'monthly' | 'yearly') => {
    setUpgradeLoading(plan);
    setUpgradeError(null);
    try {
      trackEvent('begin_checkout', { plan });
      const res = await billingApi.createCheckoutSession(plan, getGa4ClientId());
      sessionStorage.setItem('mtl_checkout_plan', plan);
      window.location.href = res.data.url;
    } catch {
      setUpgradeError('Could not start checkout. Please try again.');
      setUpgradeLoading(null);
    }
  };

  const handleCancel = async () => {
    setCancelLoading(true);
    setCancelError(null);
    try {
      const reason = buildCancelReason();
      await billingApi.cancelSubscription(reason);
      await Promise.all([keepAlive(), refreshUser()]);
      refetch();
      trackEvent('cancel_subscription', { reason: reason ?? 'unspecified' });
      setCancelSuccess(true);
    } catch {
      setCancelError('Could not cancel subscription. Please try again.');
    } finally {
      setCancelLoading(false);
    }
  };

  const closeCancelModal = () => {
    if (cancelLoading) return;
    setShowCancelModal(false);
    setCancelSuccess(false);
    setCancelPreset(null);
    setCancelNote('');
    setCancelError(null);
  };

  if (loading) return <LoadingSpinner />;
  if (error) return <ErrorAlert message={error} onRetry={refetch} />;

  const { isPaid, tradeCount, limit, hasSubscription } = status!;
  const pct = Math.min(100, Math.round((tradeCount / limit) * 100));
  const atLimit = !isPaid && tradeCount >= limit;

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Account</h1>
        <p className="text-base-content/70 mt-1">{user?.email}</p>
      </div>

      {/* Upgrade success banner */}
      {upgradeSuccess && (
        <div className="alert alert-success">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 shrink-0" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
          </svg>
          <div>
            <p className="font-semibold">Welcome to Pro!</p>
            <p className="text-sm">Your account has been upgraded. Enjoy unlimited trades and full access.</p>
          </div>
          <button className="btn btn-ghost btn-sm ml-auto" onClick={() => setUpgradeSuccess(false)}>✕</button>
        </div>
      )}

      {/* Plan status */}
      <div className="card bg-base-100 shadow">
        <div className="card-body space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="card-title text-base">Plan</h2>
            {isPaid ? (
              <span className="badge badge-success badge-lg">Pro</span>
            ) : (
              <span className="badge badge-neutral badge-lg">Free</span>
            )}
          </div>

          {isPaid ? (
            <div className="space-y-4">
              <ul className="space-y-1 text-sm text-base-content/80">
                <li className="flex items-center gap-2"><span className="text-success">✓</span> Unlimited trades</li>
                <li className="flex items-center gap-2"><span className="text-success">✓</span> Full P&amp;L tracking</li>
                <li className="flex items-center gap-2"><span className="text-success">✓</span> CSV export</li>
                <li className="flex items-center gap-2"><span className="text-success">✓</span> API access</li>
              </ul>

              <div className="pt-2 border-t border-base-200 flex flex-wrap gap-2 items-center">
                <button
                  className="btn btn-outline btn-sm"
                  onClick={handleManageBilling}
                  disabled={portalLoading}
                >
                  {portalLoading ? <span className="loading loading-spinner loading-xs" /> : null}
                  Manage billing
                </button>
                {hasSubscription && (
                  <button
                    className="btn btn-outline btn-error btn-sm"
                    onClick={() => { setCancelError(null); setCancelSuccess(false); setShowCancelModal(true); }}
                  >
                    Cancel subscription
                  </button>
                )}
              </div>
              {hasSubscription && (
                <p className="text-xs text-base-content/50">
                  Your Pro access continues until the end of the current billing period if cancelled.
                </p>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-base-content/70">Trades used</span>
                  <span className={atLimit ? 'text-error font-medium' : 'font-medium'}>
                    {tradeCount} / {limit}
                  </span>
                </div>
                <progress
                  className={`progress w-full ${atLimit ? 'progress-error' : pct >= 80 ? 'progress-warning' : 'progress-primary'}`}
                  value={tradeCount}
                  max={limit}
                />
                {atLimit && (
                  <p className="text-error text-xs mt-1">
                    You've hit the free limit — upgrade to keep adding trades.
                  </p>
                )}
              </div>

              <p className="text-sm text-base-content/70">
                Upgrade to Pro for unlimited trades, full P&amp;L history, CSV export, and API access.
              </p>

              {upgradeError && <div className="alert alert-error text-sm">{upgradeError}</div>}

              <div className="flex flex-col sm:flex-row gap-3">
                <button
                  className="btn btn-primary flex-1"
                  onClick={() => handleUpgrade('yearly')}
                  disabled={upgradeLoading !== null}
                >
                  {upgradeLoading === 'yearly' ? <span className="loading loading-spinner loading-sm" /> : null}
                  $48 / year
                  <span className="badge badge-accent badge-sm">Save 20%</span>
                </button>
                <button
                  className="btn btn-outline flex-1"
                  onClick={() => handleUpgrade('monthly')}
                  disabled={upgradeLoading !== null}
                >
                  {upgradeLoading === 'monthly' ? <span className="loading loading-spinner loading-sm" /> : null}
                  $5 / month
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Cancel subscription modal */}
      <Modal isOpen={showCancelModal} onClose={closeCancelModal} title="Cancel subscription">
        {cancelSuccess ? (
          <div className="text-center space-y-4 py-2">
            <div className="flex justify-center">
              <div className="rounded-full bg-base-200 p-4">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-base-content/60" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>
            <div>
              <p className="font-semibold text-lg">Subscription cancelled</p>
              <p className="text-sm text-base-content/70 mt-1">
                Your Pro access continues until the end of the current billing period.
                After that your account reverts to the free plan.
              </p>
              <p className="text-sm text-base-content/50 mt-2">
                A confirmation email has been sent to {user?.email}.
              </p>
            </div>
            <div className="modal-action justify-center">
              <button className="btn btn-wide" onClick={closeCancelModal}>Close</button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-base-content/80 text-sm">
              Your Pro access continues until the end of the current billing period. After that your account reverts to the free plan (25-trade limit).
            </p>

            <div className="form-control">
              <label className="label">
                <span className="label-text">Why are you canceling? <span className="text-base-content/50">(optional)</span></span>
              </label>
              <div className="flex flex-wrap gap-2">
                {CANCEL_PRESETS.map(preset => (
                  <button
                    key={preset}
                    type="button"
                    className={`btn btn-sm rounded-full ${cancelPreset === preset ? 'btn-primary' : 'btn-outline'}`}
                    onClick={() => setCancelPreset(cancelPreset === preset ? null : preset)}
                    disabled={cancelLoading}
                  >
                    {preset}
                  </button>
                ))}
              </div>
            </div>

            <div className="form-control">
              <textarea
                className="textarea textarea-bordered w-full resize-none"
                rows={3}
                placeholder={cancelPreset && cancelPreset !== 'Other' ? 'Any additional details? (optional)' : 'Tell us more... (optional)'}
                value={cancelNote}
                onChange={e => setCancelNote(e.target.value)}
                disabled={cancelLoading}
                maxLength={500}
              />
            </div>

            {cancelError && <div className="alert alert-error text-sm">{cancelError}</div>}

            <div className="modal-action">
              <button className="btn" onClick={closeCancelModal} disabled={cancelLoading}>
                Keep my subscription
              </button>
              <button className="btn btn-error" onClick={handleCancel} disabled={cancelLoading}>
                {cancelLoading ? <span className="loading loading-spinner loading-sm" /> : null}
                Cancel subscription
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
