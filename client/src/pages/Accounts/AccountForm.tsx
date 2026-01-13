import { useState } from 'react';
import type { Account, CreateAccountRequest } from '../../types';

interface AccountFormProps {
  account?: Account;
  onSubmit: (data: CreateAccountRequest) => Promise<void>;
  onCancel: () => void;
}

export function AccountForm({ account, onSubmit, onCancel }: AccountFormProps) {
  const [name, setName] = useState(account?.name ?? '');
  const [baseCurrency, setBaseCurrency] = useState(account?.baseCurrency ?? 'USD');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      await onSubmit({ name, baseCurrency });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save account');
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      {error && (
        <div className="alert alert-error mb-4">
          <span>{error}</span>
        </div>
      )}

      <div className="form-control w-full">
        <label className="label">
          <span className="label-text">Account Name</span>
        </label>
        <input
          type="text"
          placeholder="e.g., Coinbase, Binance, Long-Term"
          className="input input-bordered w-full"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
      </div>

      <div className="form-control w-full mt-4">
        <label className="label">
          <span className="label-text">Base Currency</span>
        </label>
        <select
          className="select select-bordered w-full"
          value={baseCurrency}
          onChange={(e) => setBaseCurrency(e.target.value)}
        >
          <option value="USD">USD</option>
          <option value="EUR">EUR</option>
          <option value="GBP">GBP</option>
          <option value="USDT">USDT</option>
          <option value="USDC">USDC</option>
        </select>
        <label className="label">
          <span className="label-text-alt">Used for P&L calculations</span>
        </label>
      </div>

      <div className="modal-action">
        <button type="button" className="btn" onClick={onCancel} disabled={loading}>
          Cancel
        </button>
        <button type="submit" className="btn btn-primary" disabled={loading}>
          {loading ? <span className="loading loading-spinner loading-sm"></span> : null}
          {account ? 'Update' : 'Create'} Account
        </button>
      </div>
    </form>
  );
}
