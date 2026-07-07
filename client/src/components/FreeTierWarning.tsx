import { useState, useEffect } from 'react';
import { useApi } from '../hooks';
import { billingApi } from '../services/api';
import { PaywallModal } from './PaywallModal';

const FREE_LIMIT = 25;
const WARN_THRESHOLD = 22;

export function FreeTierWarning() {
  const { data: status } = useApi(() => billingApi.getStatus(), []);
  const [warnDismissed, setWarnDismissed] = useState(false);
  const [paywallInfo, setPaywallInfo] = useState<{ current: number; limit: number } | null>(null);

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<{ current: number; limit: number }>).detail;
      setPaywallInfo(detail);
    };
    window.addEventListener('mtl:paywall', handler);
    return () => window.removeEventListener('mtl:paywall', handler);
  }, []);

  if (!status) return null;

  const { isPaid, hasHitFreeLimit, tradeCount, limit } = status;

  if (isPaid) return null;

  const atLimit = hasHitFreeLimit || tradeCount >= limit;
  const approaching = !atLimit && tradeCount >= WARN_THRESHOLD;

  return (
    <>
      {atLimit && (
        <div className="alert alert-error mb-6">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 shrink-0" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
          </svg>
          <div>
            <span className="font-semibold">You've reached your free trade limit.</span>
            <span className="ml-1 text-sm">Upgrade to Pro to continue adding trades — your existing data stays exactly as is.</span>
          </div>
          <button
            className="btn btn-sm btn-error ml-auto"
            onClick={() => setPaywallInfo({ current: tradeCount, limit })}
          >
            Upgrade
          </button>
        </div>
      )}

      {approaching && !warnDismissed && (
        <div className="alert alert-warning mb-6">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 shrink-0" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
          <div>
            <span className="font-semibold">You've used {tradeCount} of {FREE_LIMIT} free trades.</span>
            <span className="ml-1 text-sm">Only {FREE_LIMIT - tradeCount} remaining — upgrade to Pro for unlimited access.</span>
          </div>
          <div className="flex gap-2 ml-auto">
            <button
              className="btn btn-sm btn-warning"
              onClick={() => setPaywallInfo({ current: tradeCount, limit })}
            >
              Upgrade
            </button>
            <button className="btn btn-ghost btn-sm" onClick={() => setWarnDismissed(true)}>✕</button>
          </div>
        </div>
      )}

      <PaywallModal
        isOpen={paywallInfo !== null}
        onClose={() => setPaywallInfo(null)}
        current={paywallInfo?.current ?? 0}
        limit={paywallInfo?.limit ?? FREE_LIMIT}
      />
    </>
  );
}
