import { useState } from 'react';
import { Modal } from './Modal';
import { accountsApi } from '../services/api';

interface DemoAccountModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLoaded: () => void;
}

export function DemoAccountModal({ isOpen, onClose, onLoaded }: DemoAccountModalProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleConfirm = async () => {
    setLoading(true);
    setError(null);
    try {
      await accountsApi.seedDemo();
      onLoaded();
      onClose();
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (loading) return;
    setError(null);
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Load Demo Account">
      <p className="text-base-content/80">
        This will create a <span className="font-medium">Demo Portfolio</span> account
        pre-loaded with realistic sample trades so you can explore MyTradeLedger right away.
      </p>

      <div className="mt-4 space-y-1">
        <p className="text-sm font-medium text-base-content/60 uppercase tracking-wide">What's included</p>
        <ul className="mt-1 space-y-1 text-sm text-base-content/80">
          <li className="flex gap-2"><span className="text-base-content/40">•</span>5 trades across BTC/USD and ETH/USD</li>
          <li className="flex gap-2"><span className="text-base-content/40">•</span>A mix of buys and sells spanning early 2024</li>
          <li className="flex gap-2"><span className="text-base-content/40">•</span>Realized P&amp;L computed automatically</li>
        </ul>
      </div>

      <div className="mt-4 p-3 rounded-lg bg-base-200 text-sm text-base-content/70 space-y-1">
        <p>Demo trades <span className="font-medium">don't count</span> toward your free tier limit.</p>
        <p>You can delete the Demo Portfolio account at any time.</p>
      </div>

      {error && (
        <p className="mt-3 text-sm text-error">{error}</p>
      )}

      <div className="modal-action">
        <button className="btn" onClick={handleClose} disabled={loading}>
          Cancel
        </button>
        <button className="btn btn-primary" onClick={handleConfirm} disabled={loading}>
          {loading && <span className="loading loading-spinner loading-sm" />}
          {loading ? 'Loading…' : 'Load Demo Account'}
        </button>
      </div>
    </Modal>
  );
}
