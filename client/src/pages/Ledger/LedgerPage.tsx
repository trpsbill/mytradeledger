import { useState, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { LoadingSpinner, ErrorAlert, EmptyState, Modal, ConfirmDialog } from '../../components';
import { useApi } from '../../hooks';
import { ledgerApi } from '../../services/api';
import { LedgerEntryForm } from './LedgerEntryForm';
import type { LedgerEntry, CreateLedgerEntryRequest, EntryType } from '../../types';

const ENTRY_TYPE_COLORS: Record<EntryType, string> = {
  BUY: 'badge-success',
  SELL: 'badge-error',
};

export function LedgerPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<LedgerEntry | null>(null);
  const [deletingEntry, setDeletingEntry] = useState<LedgerEntry | null>(null);
  const [showClearAllConfirm, setShowClearAllConfirm] = useState(false);

  // Filters from URL
  const symbolFilter = searchParams.get('symbol') || '';
  const entryType = searchParams.get('entryType') as EntryType | '';

  const queryParams = useMemo(() => ({
    symbol: symbolFilter || undefined,
    entryType: entryType || undefined,
    limit: 100,
  }), [symbolFilter, entryType]);

  const { data: entries, loading, error, refetch, meta } = useApiWithMeta(
    () => ledgerApi.list(queryParams),
    [queryParams]
  );

  const handleFilterChange = (key: string, value: string) => {
    const newParams = new URLSearchParams(searchParams);
    if (value) {
      newParams.set(key, value);
    } else {
      newParams.delete(key);
    }
    setSearchParams(newParams);
  };

  const handleCreate = async (data: CreateLedgerEntryRequest) => {
    await ledgerApi.create(data);
    setIsModalOpen(false);
    refetch();
  };

  const handleUpdate = async (data: CreateLedgerEntryRequest) => {
    if (!editingEntry) return;
    await ledgerApi.update(editingEntry.id, data);
    setEditingEntry(null);
    refetch();
  };

  const handleDelete = async () => {
    if (!deletingEntry) return;
    await ledgerApi.delete(deletingEntry.id);
    setDeletingEntry(null);
    refetch();
  };

  const handleClearAll = async () => {
    await ledgerApi.clearAll();
    setShowClearAllConfirm(false);
    refetch();
  };

  const formatQuantity = (entry: LedgerEntry) => {
    const qty = parseFloat(entry.quantity);
    return Math.abs(qty).toFixed(8).replace(/\.?0+$/, '');
  };

  const formatValue = (value: string) => {
    const num = parseFloat(value);
    return num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const formatPrice = (value: string) => {
    const num = parseFloat(value);
    return num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 8 }).replace(/\.?0+$/, '');
  };

  const formatPnL = (pnl: string) => {
    const num = parseFloat(pnl);
    const formatted = Math.abs(num).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return num >= 0 ? `+${formatted}` : `-${formatted}`;
  };

  if (loading) return <LoadingSpinner />;
  if (error) return <ErrorAlert message={error} onRetry={refetch} />;

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Ledger</h1>
        <div className="flex gap-2">
          {entries && entries.length > 0 && (
            <button
              className="btn btn-outline btn-error"
              onClick={() => setShowClearAllConfirm(true)}
            >
              Clear All
            </button>
          )}
          <button className="btn btn-primary" onClick={() => setIsModalOpen(true)}>
            New Entry
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-4 mb-6 flex-wrap items-center">
        <input
          type="text"
          className="input input-bordered input-sm w-40"
          placeholder="Filter by symbol..."
          value={symbolFilter}
          onChange={(e) => handleFilterChange('symbol', e.target.value)}
        />

        <select
          className="select select-bordered select-sm"
          value={entryType}
          onChange={(e) => handleFilterChange('entryType', e.target.value)}
        >
          <option value="">All Types</option>
          <option value="BUY">Buy</option>
          <option value="SELL">Sell</option>
        </select>

        {(symbolFilter || entryType) && (
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => setSearchParams(new URLSearchParams())}
          >
            Clear filters
          </button>
        )}

        {meta && (
          <span className="text-sm text-base-content/70 ml-auto">
            Showing {entries?.length ?? 0} of {meta.total} entries
          </span>
        )}
      </div>

      {entries?.length === 0 ? (
        <EmptyState
          title="No ledger entries"
          description={symbolFilter || entryType
            ? "No entries match the current filters."
            : "Record your first trade to start tracking your portfolio."
          }
          action={{ label: 'Add Entry', onClick: () => setIsModalOpen(true) }}
        />
      ) : (
        <div className="overflow-x-auto">
          <table className="table table-zebra">
            <thead>
              <tr>
                <th>Timestamp</th>
                <th>Type</th>
                <th>Symbol</th>
                <th className="text-right">Quantity</th>
                <th className="text-right">Price</th>
                <th className="text-right">Fee</th>
                <th className="text-right">Total</th>
                <th className="text-right">P&L</th>
                <th>Notes</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {entries?.map((entry) => (
                <tr key={entry.id}>
                  <td className="whitespace-nowrap text-sm">
                    {new Date(entry.timestamp).toLocaleString()}
                  </td>
                  <td>
                    <span className={`badge ${ENTRY_TYPE_COLORS[entry.entryType]} badge-sm`}>
                      {entry.entryType}
                    </span>
                  </td>
                  <td>
                    <span className="font-mono font-medium">{entry.symbol}</span>
                  </td>
                  <td className="text-right font-mono">
                    {formatQuantity(entry)}
                  </td>
                  <td className="text-right font-mono">
                    {formatPrice(entry.price)}
                  </td>
                  <td className="text-right font-mono text-base-content/60">
                    {entry.fee ? formatValue(entry.fee) : '-'}
                  </td>
                  <td className={`text-right font-mono font-medium ${
                    parseFloat(entry.valueBase) >= 0 ? 'text-success' : 'text-error'
                  }`}>
                    {formatValue(entry.valueBase)}
                  </td>
                  <td className={`text-right font-mono font-medium ${
                    entry.pnl ? (parseFloat(entry.pnl) >= 0 ? 'text-success' : 'text-error') : ''
                  }`}>
                    {entry.pnl ? formatPnL(entry.pnl) : '-'}
                  </td>
                  <td className="max-w-[150px] truncate text-base-content/70 text-sm">
                    {entry.notes || '-'}
                  </td>
                  <td>
                    <div className="flex gap-1 justify-end">
                      <button
                        className="btn btn-ghost btn-xs"
                        onClick={() => setEditingEntry(entry)}
                      >
                        Edit
                      </button>
                      <button
                        className="btn btn-ghost btn-xs text-error"
                        onClick={() => setDeletingEntry(entry)}
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="New Ledger Entry"
      >
        <LedgerEntryForm
          onSubmit={handleCreate}
          onCancel={() => setIsModalOpen(false)}
        />
      </Modal>

      <Modal
        isOpen={!!editingEntry}
        onClose={() => setEditingEntry(null)}
        title="Edit Ledger Entry"
      >
        {editingEntry && (
          <LedgerEntryForm
            entry={editingEntry}
            onSubmit={handleUpdate}
            onCancel={() => setEditingEntry(null)}
          />
        )}
      </Modal>

      <ConfirmDialog
        isOpen={!!deletingEntry}
        onClose={() => setDeletingEntry(null)}
        onConfirm={handleDelete}
        title="Delete Entry"
        message="Are you sure you want to delete this ledger entry? This action cannot be undone."
        confirmLabel="Delete"
        variant="danger"
      />

      <ConfirmDialog
        isOpen={showClearAllConfirm}
        onClose={() => setShowClearAllConfirm(false)}
        onConfirm={handleClearAll}
        title="Clear All Entries"
        message={`Are you sure you want to delete all ${meta?.total ?? entries?.length ?? 0} ledger entries? This action cannot be undone.`}
        confirmLabel="Clear All"
        variant="danger"
      />
    </div>
  );
}

// Extended hook that also returns meta
function useApiWithMeta<T>(
  fetcher: () => Promise<{ data: T; meta?: { total: number; limit: number; offset: number } }>,
  deps: unknown[] = []
) {
  const [meta, setMeta] = useState<{ total: number; limit: number; offset: number } | null>(null);

  const result = useApi(async () => {
    const response = await fetcher();
    setMeta(response.meta ?? null);
    return response;
  }, deps);

  return { ...result, meta };
}
