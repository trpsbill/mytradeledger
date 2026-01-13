import { useState } from 'react';
import { LoadingSpinner, ErrorAlert, Modal, ConfirmDialog } from '../../components';
import { useApi } from '../../hooks';
import { accountsApi, ledgerApi } from '../../services/api';
import { LedgerEntryForm } from '../Ledger/LedgerEntryForm';
import type { Account, LedgerEntry, CreateLedgerEntryRequest } from '../../types';

export function DashboardPage() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<LedgerEntry | null>(null);
  const [deletingEntry, setDeletingEntry] = useState<LedgerEntry | null>(null);

  const { data: accounts, loading: accountsLoading } = useApi(
    () => accountsApi.list(),
    []
  );
  const { data: entries, loading: entriesLoading, error: entriesError, refetch } = useApi(
    () => ledgerApi.list({ limit: 50 }),
    []
  );

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

  if (accountsLoading || entriesLoading) return <LoadingSpinner />;
  if (entriesError) return <ErrorAlert message={entriesError} />;

  const hasEntries = entries && entries.length > 0;

  return (
    <div className="space-y-4">
      {/* Header with action buttons */}
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <div className="flex gap-2">
          {hasEntries && (
            <button className="btn btn-outline" onClick={() => ledgerApi.exportCsv()}>
              Export CSV
            </button>
          )}
          <button className="btn btn-primary" onClick={() => setIsModalOpen(true)}>
            + New Entry
          </button>
        </div>
      </div>

      {/* Compact Account Summary */}
      {accounts && accounts.length > 0 && (
        <div className="flex gap-3 flex-wrap">
          {accounts.map((account) => (
            <CompactAccountCard key={account.id} account={account} />
          ))}
        </div>
      )}

      {/* Main Activity Section */}
      {hasEntries ? (
        <div className="card bg-base-100 shadow">
          <div className="card-body p-4">
            <div className="overflow-x-auto">
              <table className="table table-sm">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Type</th>
                    <th>Symbol</th>
                    <th className="text-right">Qty</th>
                    <th className="text-right">Price</th>
                    <th className="text-right">Total</th>
                    <th className="text-right">P&L</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {entries.map((entry: LedgerEntry) => (
                    <tr key={entry.id} className="hover">
                      <td className="whitespace-nowrap text-sm">
                        {new Date(entry.timestamp).toLocaleDateString()}
                      </td>
                      <td>
                        <span className={`badge badge-xs ${getEntryTypeBadge(entry.entryType)}`}>
                          {entry.entryType}
                        </span>
                      </td>
                      <td className="font-mono text-sm">{entry.symbol}</td>
                      <td className="text-right font-mono text-sm">
                        {formatQuantity(entry.quantity)}
                      </td>
                      <td className="text-right font-mono text-sm">
                        {formatPrice(entry.price)}
                      </td>
                      <td className={`text-right font-mono text-sm font-medium ${
                        parseFloat(entry.valueBase) >= 0 ? 'text-success' : 'text-error'
                      }`}>
                        {formatValue(entry.valueBase)}
                      </td>
                      <td className={`text-right font-mono text-sm font-medium ${
                        entry.pnl ? (parseFloat(entry.pnl) >= 0 ? 'text-success' : 'text-error') : ''
                      }`}>
                        {entry.pnl ? formatPnL(entry.pnl) : '-'}
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
          </div>
        </div>
      ) : (
        <div className="card bg-base-100 shadow-xl">
          <div className="card-body text-center py-12">
            <h2 className="card-title justify-center">Welcome to MyTradeLedger</h2>
            <p className="text-base-content/70">
              Get started by recording your first trade.
            </p>
            <div className="card-actions justify-center mt-4">
              <button className="btn btn-primary" onClick={() => setIsModalOpen(true)}>
                Add Your First Trade
              </button>
            </div>
          </div>
        </div>
      )}

      {/* New Entry Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="New Entry"
      >
        <LedgerEntryForm
          onSubmit={handleCreate}
          onCancel={() => setIsModalOpen(false)}
        />
      </Modal>

      {/* Edit Entry Modal */}
      <Modal
        isOpen={!!editingEntry}
        onClose={() => setEditingEntry(null)}
        title="Edit Entry"
      >
        {editingEntry && (
          <LedgerEntryForm
            entry={editingEntry}
            onSubmit={handleUpdate}
            onCancel={() => setEditingEntry(null)}
          />
        )}
      </Modal>

      {/* Delete Confirmation */}
      <ConfirmDialog
        isOpen={!!deletingEntry}
        onClose={() => setDeletingEntry(null)}
        onConfirm={handleDelete}
        title="Delete Entry"
        message="Are you sure you want to delete this entry? This action cannot be undone."
        confirmLabel="Delete"
        variant="danger"
      />
    </div>
  );
}

function CompactAccountCard({ account }: { account: Account }) {
  const { data: pnl } = useApi(() => accountsApi.getPnL(account.id), [account.id]);
  const { data: balances } = useApi(() => accountsApi.getBalance(account.id), [account.id]);

  const pnlValue = pnl ? parseFloat(pnl.totalPnL) : 0;
  const pnlColor = pnlValue >= 0 ? 'text-success' : 'text-error';
  const holdingsCount = balances?.length ?? 0;

  return (
    <div className="card card-compact bg-base-100 shadow">
      <div className="card-body flex-row items-center gap-4 py-2 px-4">
        <div>
          <div className="text-xs text-base-content/60">{account.name}</div>
          <div className={`font-bold ${pnlColor}`}>
            {pnlValue >= 0 ? '+' : ''}{pnlValue.toLocaleString(undefined, {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })} {account.baseCurrency}
          </div>
        </div>
        {holdingsCount > 0 && (
          <div className="text-xs text-base-content/50">
            {holdingsCount} position{holdingsCount !== 1 ? 's' : ''}
          </div>
        )}
      </div>
    </div>
  );
}

function formatQuantity(qty: string) {
  return Math.abs(parseFloat(qty)).toFixed(8).replace(/\.?0+$/, '');
}

function formatPrice(price: string) {
  const num = parseFloat(price);
  return num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 8 }).replace(/\.?0+$/, '');
}

function formatValue(value: string) {
  const num = parseFloat(value);
  return num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatPnL(pnl: string) {
  const num = parseFloat(pnl);
  const formatted = Math.abs(num).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return num >= 0 ? `+${formatted}` : `-${formatted}`;
}

function getEntryTypeBadge(type: string) {
  switch (type) {
    case 'BUY': return 'badge-success';
    case 'SELL': return 'badge-error';
    default: return 'badge-ghost';
  }
}
