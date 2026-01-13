import { useState } from 'react';
import type { LedgerEntry, CreateLedgerEntryRequest, EntryType } from '../../types';

interface LedgerEntryFormProps {
  entry?: LedgerEntry;
  onSubmit: (data: CreateLedgerEntryRequest) => Promise<void>;
  onCancel: () => void;
}

export function LedgerEntryForm({ entry, onSubmit, onCancel }: LedgerEntryFormProps) {
  const [symbol, setSymbol] = useState(entry?.symbol ?? '');
  const [entryType, setEntryType] = useState<EntryType>(entry?.entryType ?? 'BUY');
  const [quantity, setQuantity] = useState(entry ? Math.abs(parseFloat(entry.quantity)).toString() : '');
  const [price, setPrice] = useState(entry?.price ?? '');
  const [fee, setFee] = useState(entry?.fee ?? '');
  const [timestamp, setTimestamp] = useState(
    entry ? new Date(entry.timestamp).toISOString().slice(0, 16) : new Date().toISOString().slice(0, 16)
  );
  const [notes, setNotes] = useState(entry?.notes ?? '');
  const [showNotes, setShowNotes] = useState(!!entry?.notes);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      await onSubmit({
        symbol: symbol.trim(),
        entryType,
        quantity,
        price,
        fee: fee || undefined,
        timestamp: new Date(timestamp).toISOString(),
        notes: notes || undefined,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save entry');
      setLoading(false);
    }
  };

  // Calculate total value for display
  const qty = parseFloat(quantity) || 0;
  const prc = parseFloat(price) || 0;
  const totalValue = qty * prc;
  const feeAmount = parseFloat(fee) || 0;

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="alert alert-error text-sm py-2">
          <span>{error}</span>
        </div>
      )}

      {/* Main row - horizontal layout */}
      <div className="flex flex-wrap gap-3 items-end">
        {/* Symbol */}
        <div className="form-control flex-1 min-w-[120px]">
          <label className="label py-1">
            <span className="label-text text-xs">Symbol</span>
          </label>
          <input
            type="text"
            className="input input-bordered input-sm"
            placeholder="BTC/USD"
            value={symbol}
            onChange={(e) => setSymbol(e.target.value)}
            required
          />
        </div>

        {/* Buy/Sell Toggle */}
        <div className="form-control">
          <label className="label py-1">
            <span className="label-text text-xs">Side</span>
          </label>
          <div className="join">
            <button
              type="button"
              className={`btn btn-sm join-item ${entryType === 'BUY' ? 'btn-success' : 'btn-outline'}`}
              onClick={() => setEntryType('BUY')}
            >
              Buy
            </button>
            <button
              type="button"
              className={`btn btn-sm join-item ${entryType === 'SELL' ? 'btn-error' : 'btn-outline'}`}
              onClick={() => setEntryType('SELL')}
            >
              Sell
            </button>
          </div>
        </div>

        {/* Quantity */}
        <div className="form-control w-28">
          <label className="label py-1">
            <span className="label-text text-xs">Quantity</span>
          </label>
          <input
            type="text"
            className="input input-bordered input-sm font-mono"
            placeholder="0.00"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            required
          />
        </div>

        {/* Price */}
        <div className="form-control w-28">
          <label className="label py-1">
            <span className="label-text text-xs">Price</span>
          </label>
          <input
            type="text"
            className="input input-bordered input-sm font-mono"
            placeholder="0.00"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            required
          />
        </div>

        {/* Fee */}
        <div className="form-control w-24">
          <label className="label py-1">
            <span className="label-text text-xs">Fee</span>
          </label>
          <input
            type="text"
            className="input input-bordered input-sm font-mono"
            placeholder="0.00"
            value={fee}
            onChange={(e) => setFee(e.target.value)}
          />
        </div>

        {/* Timestamp */}
        <div className="form-control w-44">
          <label className="label py-1">
            <span className="label-text text-xs">Date/Time</span>
          </label>
          <input
            type="datetime-local"
            className="input input-bordered input-sm"
            value={timestamp}
            onChange={(e) => setTimestamp(e.target.value)}
            required
          />
        </div>
      </div>

      {/* Total display */}
      {totalValue > 0 && (
        <div className="text-sm text-base-content/70">
          Total: <span className={`font-mono font-semibold ${entryType === 'BUY' ? 'text-error' : 'text-success'}`}>
            {entryType === 'BUY' ? '-' : '+'}${totalValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
          {feeAmount > 0 && (
            <span className="text-base-content/50 ml-2">
              (fee: ${feeAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })})
            </span>
          )}
        </div>
      )}

      {/* Notes toggle and field */}
      {!showNotes ? (
        <button
          type="button"
          className="btn btn-ghost btn-xs text-base-content/50"
          onClick={() => setShowNotes(true)}
        >
          + Add notes
        </button>
      ) : (
        <div className="form-control">
          <label className="label py-1">
            <span className="label-text text-xs">Notes</span>
          </label>
          <input
            type="text"
            className="input input-bordered input-sm"
            placeholder="Optional notes..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </div>
      )}

      {/* Actions */}
      <div className="flex justify-end gap-2 pt-2">
        <button type="button" className="btn btn-sm btn-ghost" onClick={onCancel} disabled={loading}>
          Cancel
        </button>
        <button type="submit" className="btn btn-sm btn-primary" disabled={loading}>
          {loading && <span className="loading loading-spinner loading-xs"></span>}
          {entry ? 'Update' : 'Add'} Entry
        </button>
      </div>
    </form>
  );
}
