import { useState } from 'react';
import { billingApi } from '../services/api';
import { trackEvent, getGa4ClientId } from '../services/analytics';

interface PaywallModalProps {
  isOpen: boolean;
  onClose: () => void;
  current: number;
  limit: number;
}

export function PaywallModal({ isOpen, onClose, current, limit }: PaywallModalProps) {
  const [loading, setLoading] = useState<'monthly' | 'yearly' | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleUpgrade = async (plan: 'monthly' | 'yearly') => {
    setLoading(plan);
    setError(null);
    try {
      trackEvent('begin_checkout', { plan });
      const res = await billingApi.createCheckoutSession(plan, getGa4ClientId());
      window.location.href = res.data.url;
    } catch {
      setError('Could not start checkout. Please try again.');
      setLoading(null);
    }
  };

  return (
    <div className="modal modal-open">
      <div className="modal-box max-w-md">
        <h3 className="font-bold text-xl mb-2">You've hit the free limit</h3>
        <p className="text-base-content/70 mb-6">
          You've added <strong>{current} of {limit} free trades</strong>. Upgrade to continue
          tracking — your existing data stays exactly as is.
        </p>

        <div className="bg-base-200 rounded-xl p-4 mb-6 space-y-2 text-sm">
          <div className="flex items-center gap-2">
            <span className="text-success">✓</span>
            <span>All your trades so far are saved</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-success">✓</span>
            <span>Unlimited trades after upgrading</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-success">✓</span>
            <span>Full P&amp;L tracking and CSV export</span>
          </div>
        </div>

        {error && (
          <p className="text-error text-sm mb-4">{error}</p>
        )}

        <div className="modal-action flex-col gap-2">
          <button
            className="btn btn-primary w-full"
            onClick={() => handleUpgrade('yearly')}
            disabled={loading !== null}
          >
            {loading === 'yearly' ? <span className="loading loading-spinner loading-sm" /> : null}
            Upgrade yearly — $48/yr
            <span className="badge badge-accent badge-sm ml-1">Save 20%</span>
          </button>
          <button
            className="btn btn-outline w-full"
            onClick={() => handleUpgrade('monthly')}
            disabled={loading !== null}
          >
            {loading === 'monthly' ? <span className="loading loading-spinner loading-sm" /> : null}
            Upgrade monthly — $5/mo
          </button>
          <button className="btn btn-ghost btn-sm w-full" onClick={onClose} disabled={loading !== null}>
            Maybe later
          </button>
        </div>
      </div>
      <div className="modal-backdrop" onClick={onClose} />
    </div>
  );
}
