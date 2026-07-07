import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LoadingSpinner, ErrorAlert, Modal, ConfirmDialog, PnlCell, FreeTierWarning, DemoAccountModal, DemoUpsellModal, Pagination, PageNavigator } from '../../components';
import { useApi, useApiWithMeta } from '../../hooks';
import { useAuth } from '../../contexts/AuthContext';
import { accountsApi, ledgerApi } from '../../services/api';
import { LedgerEntryForm } from '../Ledger/LedgerEntryForm';
import { ImportCsvModal } from '../../components/ImportCsvModal';
import type { Account, LedgerEntry, CreateLedgerEntryRequest } from '../../types';

const PAGE_SIZE_OPTIONS = [25, 50, 100];

export function DashboardPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isImportUpsellOpen, setIsImportUpsellOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<LedgerEntry | null>(null);
  const [deletingEntry, setDeletingEntry] = useState<LedgerEntry | null>(null);
  const [isDemoModalOpen, setIsDemoModalOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);

  const { data: accounts, loading: accountsLoading, refetch: refetchAccounts } = useApi(
    () => accountsApi.list(),
    []
  );
  // A real user's isDemo account is just a bonus example portfolio, excluded
  // here so it doesn't count as a "real" account. An anonymous demo session's
  // only account IS that isDemo account, so for them it's the real thing.
  const nonDemoAccounts = user?.isDemo ? (accounts ?? []) : (accounts ?? []).filter((a) => !a.isDemo);
  const showAccountColumn = nonDemoAccounts.length > 1;
  const hasNoAccounts = !accountsLoading && nonDemoAccounts.length === 0;
  const { data: entries, loading: entriesLoading, error: entriesError, refetch: refetchEntries, meta: entriesMeta } = useApiWithMeta(
    () => ledgerApi.list({ limit: pageSize, offset: (page - 1) * pageSize }),
    [page, pageSize]
  );

  const handleCreate = async (data: CreateLedgerEntryRequest) => {
    await ledgerApi.create(data);
    setIsModalOpen(false);
    refetchEntries();
  };

  const handleUpdate = async (data: CreateLedgerEntryRequest) => {
    if (!editingEntry) return;
    await ledgerApi.update(editingEntry.id, data);
    setEditingEntry(null);
    refetchEntries();
  };

  const handleDelete = async () => {
    if (!deletingEntry) return;
    await ledgerApi.delete(deletingEntry.id);
    setDeletingEntry(null);
    setPage(1);
    refetchEntries();
  };

  if (accountsLoading || entriesLoading) return <LoadingSpinner />;
  if (entriesError) return <ErrorAlert message={entriesError} />;

  const hasEntries = entries && entries.length > 0;

  return (
    <div className="space-y-4">
      <FreeTierWarning />
      {/* Header with action buttons */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <div className="flex flex-wrap gap-2">
          {hasEntries && (
            <button className="btn btn-outline" onClick={() => ledgerApi.exportCsv()}>
              Export CSV
            </button>
          )}
          <button
            className="btn btn-outline"
            onClick={() => user?.isDemo ? setIsImportUpsellOpen(true) : setIsImportModalOpen(true)}
          >
            Import CSV
          </button>
          <button className="btn btn-primary" onClick={() => hasNoAccounts ? navigate('/app/accounts') : setIsModalOpen(true)}>
            {hasNoAccounts ? 'Add Trading Account' : '+ New Entry'}
          </button>
        </div>
      </div>

      {/* Compact Account Summary */}
      {accounts && accounts.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {accounts.map((account) => (
            <CompactAccountCard key={account.id} account={account} />
          ))}
        </div>
      )}

      {/* Main Activity Section */}
      {hasEntries ? (
        <div className="card bg-base-100 shadow">
          <div className="card-body p-4">
            {entriesMeta && entriesMeta.total > 0 && (
              <div className="flex justify-end">
                <PageNavigator
                  page={page}
                  total={entriesMeta.total}
                  pageSize={pageSize}
                  onPageChange={(p) => setPage(p)}
                />
              </div>
            )}
            {/* Mobile: stacked card list */}
            <div className="sm:hidden divide-y divide-base-200">
              {entries.map((entry: LedgerEntry) => (
                <div key={entry.id} className="py-3 space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="font-mono font-medium">{entry.symbol}</span>
                      <span className={`badge badge-xs shrink-0 ${getEntryTypeBadge(entry.entryType)}`}>
                        {entry.entryType}
                      </span>
                      {showAccountColumn && (
                        <span className="text-xs text-base-content/50 truncate">{entry.account.name}</span>
                      )}
                    </div>
                    <span className="text-xs text-base-content/50 whitespace-nowrap shrink-0">
                      {new Date(entry.timestamp).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' })}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs text-base-content/50">
                      {formatQuantity(entry.quantity)} @ {formatPrice(entry.price)}
                    </span>
                    <div className="flex items-center gap-3">
                      <span className={`font-mono text-sm font-medium ${parseFloat(entry.valueBase) >= 0 ? 'text-success' : 'text-error'}`}>
                        {formatValue(entry.valueBase)}
                      </span>
                      <MobilePnlDisplay entryType={entry.entryType} pnl={entry.pnl} pnlStatus={entry.pnlStatus} />
                    </div>
                  </div>
                  <div className="flex justify-end gap-1">
                    <button className="btn btn-ghost btn-xs" onClick={() => setEditingEntry(entry)}>Edit</button>
                    <button className="btn btn-ghost btn-xs text-error" onClick={() => setDeletingEntry(entry)}>Delete</button>
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop: full table */}
            <div className="hidden sm:block overflow-x-auto">
              <table className="table table-sm">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Type</th>
                    <th>Symbol</th>
                    {showAccountColumn && <th>Account</th>}
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
                        {new Date(entry.timestamp).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' })}
                      </td>
                      <td>
                        <span className={`badge badge-xs ${getEntryTypeBadge(entry.entryType)}`}>
                          {entry.entryType}
                        </span>
                      </td>
                      <td className="font-mono text-sm">{entry.symbol}</td>
                      {showAccountColumn && (
                        <td className="text-sm text-base-content/70">{entry.account.name}</td>
                      )}
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
                      <PnlCell entryType={entry.entryType} pnl={entry.pnl} pnlStatus={entry.pnlStatus} className="text-sm" />
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
            {entriesMeta && entriesMeta.total > 0 && (
              <div className="px-4 pb-4">
                <Pagination
                  page={page}
                  pageSize={pageSize}
                  total={entriesMeta.total}
                  pageSizeOptions={PAGE_SIZE_OPTIONS}
                  onPageChange={(p) => setPage(p)}
                  onPageSizeChange={(ps) => { setPageSize(ps); setPage(1); }}
                />
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="card bg-base-100 shadow-xl">
          <div className="card-body text-center py-12">
            <h2 className="card-title justify-center">Welcome to MyTradeLedger</h2>
            {hasNoAccounts ? (
              <>
                <p className="text-base-content/70">
                  To get started, add a trading account — such as Coinbase, Kraken, or your broker — then record your first trade.
                </p>
                <div className="card-actions justify-center mt-4 flex-wrap gap-2">
                  <button className="btn btn-primary" onClick={() => navigate('/app/accounts')}>
                    Add Trading Account
                  </button>
                  <div className="tooltip" data-tip="Load sample crypto trades to explore the app — won't use your free tier slots">
                    <button className="btn btn-outline" onClick={() => setIsDemoModalOpen(true)}>
                      Load Demo Account
                    </button>
                  </div>
                </div>
              </>
            ) : (
              <>
                <p className="text-base-content/70">
                  Get started by recording your first trade, or load a demo account to see how it works.
                </p>
                <div className="card-actions justify-center mt-4 flex-wrap gap-2">
                  <button className="btn btn-primary" onClick={() => setIsModalOpen(true)}>
                    Add Your First Trade
                  </button>
                  <div className="tooltip" data-tip="Load sample crypto trades to explore the app — won't use your free tier slots">
                    <button className="btn btn-outline" onClick={() => setIsDemoModalOpen(true)}>
                      Load Demo Account
                    </button>
                  </div>
                </div>
              </>
            )}
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
          accounts={accounts ?? []}
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
            accounts={accounts ?? []}
            onSubmit={handleUpdate}
            onCancel={() => setEditingEntry(null)}
          />
        )}
      </Modal>

      {/* Import CSV Modal */}
      <ImportCsvModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        accounts={accounts}
        onImportComplete={() => { void refetchAccounts(); refetchEntries(); }}
      />

      <DemoAccountModal
        isOpen={isDemoModalOpen}
        onClose={() => setIsDemoModalOpen(false)}
        onLoaded={() => { void refetchAccounts(); refetchEntries(); }}
      />

      <DemoUpsellModal
        isOpen={isImportUpsellOpen}
        onClose={() => setIsImportUpsellOpen(false)}
        feature="Importing trades"
      />

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

  const pnlValue         = Number(pnl?.totalPnL    ?? 0);
  const netPnlValue      = Number(pnl?.totalNetPnL ?? 0);
  const feesValue        = Number(pnl?.totalFees   ?? 0);
  const uncomputableCount = pnl?.uncomputableCount ?? 0;
  const pnlColor    = pnlValue > 0 ? 'text-success' : pnlValue < 0 ? 'text-error' : 'text-base-content/50';
  const netPnlColor = netPnlValue > 0 ? 'text-success' : netPnlValue < 0 ? 'text-error' : 'text-base-content/50';
  const holdingsCount = balances?.length ?? 0;
  const totalCostBasis = (balances ?? []).reduce(
    (sum, b) => sum + parseFloat(b.costBasis),
    0,
  );

  const fmt = (n: number) =>
    (n >= 0 ? '+' : '−') +
    Math.abs(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <div className="card bg-base-100 shadow">
      <div className="card-body p-4 gap-3">
        {/* Header */}
        <div className="flex justify-between items-center">
          <span className="font-medium">{account.name}</span>
          {holdingsCount > 0 && (
            <span className="text-xs text-base-content/40">
              {holdingsCount} position{holdingsCount !== 1 ? 's' : ''}
            </span>
          )}
        </div>
        {/* Metric grid */}
        <div className="grid grid-cols-2 gap-4">
          <div className="text-center">
            <div className="text-xs uppercase tracking-wide text-base-content/40 mb-1">Gross P&amp;L</div>
            <div className={`text-lg font-medium ${pnlColor}`}>{fmt(pnlValue)}</div>
          </div>
          <div className="text-center">
            <div className="text-xs uppercase tracking-wide text-base-content/40 mb-1">Net P&amp;L</div>
            <div className={`text-lg font-medium ${netPnlColor}`}>{fmt(netPnlValue)}</div>
          </div>
        </div>
        {/* Open exposure row */}
        {totalCostBasis > 0 && (
          <div className="flex justify-between items-center pt-2 border-t border-base-200">
            <span className="text-xs text-base-content/40">Open exposure</span>
            <span className="text-sm font-medium">
              {totalCostBasis.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {account.baseCurrency}
            </span>
          </div>
        )}
        {/* Commission drag footer */}
        <div className={`flex justify-between items-center ${totalCostBasis > 0 ? '' : 'pt-2 border-t border-base-200'}`}>
          <span className="text-xs text-base-content/40">Commission drag</span>
          <span className="text-sm font-medium text-base-content/50">
            {feesValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {account.baseCurrency}
          </span>
        </div>
        {/* Excluded trades warning */}
        {uncomputableCount > 0 && (
          <div className="flex items-center gap-1.5 text-warning">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-3.5 h-3.5 shrink-0">
              <path fillRule="evenodd" d="M9.401 3.003c1.155-2 4.043-2 5.197 0l7.355 12.748c1.154 2-.29 4.5-2.599 4.5H4.645c-2.309 0-3.752-2.5-2.598-4.5L9.4 3.003zM12 8.25a.75.75 0 01.75.75v3.75a.75.75 0 01-1.5 0V9a.75.75 0 01.75-.75zm0 8.25a.75.75 0 100-1.5.75.75 0 000 1.5z" clipRule="evenodd" />
            </svg>
            <span className="text-xs">
              {uncomputableCount} {uncomputableCount === 1 ? 'trade' : 'trades'} excluded — P&amp;L couldn&apos;t be calculated
            </span>
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


function getEntryTypeBadge(type: string) {
  switch (type) {
    case 'BUY': return 'badge-success';
    case 'SELL': return 'badge-error';
    default: return 'badge-ghost';
  }
}

function MobilePnlDisplay({ entryType, pnl, pnlStatus }: { entryType: string; pnl: string | null; pnlStatus: string | null }) {
  if (entryType === 'SELL' && pnl == null && pnlStatus === 'PNL_UNCOMPUTABLE') {
    return (
      <span
        className="text-warning"
        title="P&L can't be calculated — no matching purchase recorded before this sale."
      >
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
          <path fillRule="evenodd" d="M9.401 3.003c1.155-2 4.043-2 5.197 0l7.355 12.748c1.154 2-.29 4.5-2.599 4.5H4.645c-2.309 0-3.752-2.5-2.598-4.5L9.4 3.003zM12 8.25a.75.75 0 01.75.75v3.75a.75.75 0 01-1.5 0V9a.75.75 0 01.75-.75zm0 8.25a.75.75 0 100-1.5.75.75 0 000 1.5z" clipRule="evenodd" />
        </svg>
      </span>
    );
  }
  if (pnl != null) {
    const num = parseFloat(pnl);
    const colorClass = num >= 0 ? 'text-success' : 'text-error';
    const abs = Math.abs(num).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return <span className={`font-mono font-medium text-sm ${colorClass}`}>{num >= 0 ? `+${abs}` : `-${abs}`}</span>;
  }
  return null;
}