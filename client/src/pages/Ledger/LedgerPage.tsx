import { useState, useMemo, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { LoadingSpinner, ErrorAlert, EmptyState, Modal, ConfirmDialog, PnlCell, DemoAccountModal, Pagination, PageNavigator } from '../../components';
import { useApi, useApiWithMeta } from '../../hooks';
import { accountsApi, ledgerApi } from '../../services/api';
import { LedgerEntryForm } from './LedgerEntryForm';
import type { LedgerEntry, CreateLedgerEntryRequest, EntryType } from '../../types';

const PAGE_SIZE_OPTIONS = [25, 50, 100];

const ENTRY_TYPE_COLORS: Record<EntryType, string> = {
  BUY: 'badge-success',
  SELL: 'badge-error',
};

export function LedgerPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<LedgerEntry | null>(null);
  const [deletingEntry, setDeletingEntry] = useState<LedgerEntry | null>(null);
  const [showClearAllConfirm, setShowClearAllConfirm] = useState(false);
  const [showDeleteSelectedConfirm, setShowDeleteSelectedConfirm] = useState(false);
  const [isDemoModalOpen, setIsDemoModalOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Filters and pagination from URL
  const symbolFilter = searchParams.get('symbol') || '';
  const entryType = searchParams.get('entryType') as EntryType | '';
  const accountIdFilter = searchParams.get('accountId') || '';
  const rawPage = parseInt(searchParams.get('page') || '1', 10);
  const page = Number.isNaN(rawPage) ? 1 : Math.max(1, rawPage);
  const pageSize = (() => {
    const raw = parseInt(searchParams.get('pageSize') || '50', 10);
    return PAGE_SIZE_OPTIONS.includes(raw) ? raw : 50;
  })();

  const queryParams = useMemo(() => ({
    accountId: accountIdFilter || undefined,
    symbol: symbolFilter || undefined,
    entryType: entryType || undefined,
    limit: pageSize,
    offset: (page - 1) * pageSize,
  }), [accountIdFilter, symbolFilter, entryType, page, pageSize]);

  const { data: entries, loading, error, refetch, meta } = useApiWithMeta(
    () => ledgerApi.list(queryParams),
    [queryParams]
  );

  // Clamp to last page when a bookmarked or manually-edited page URL is out of range
  useEffect(() => {
    if (!meta || meta.total === 0) return;
    const totalPages = Math.max(1, Math.ceil(meta.total / pageSize));
    if (page > totalPages) {
      const newParams = new URLSearchParams(searchParams);
      newParams.set('page', String(totalPages));
      setSearchParams(newParams);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meta]);

  const { data: accounts, loading: accountsLoading } = useApi(() => accountsApi.list(), []);
  // A user's isDemo account is just a bonus example portfolio, excluded here
  // so it doesn't count as a "real" account for empty-state purposes.
  const nonDemoAccounts = (accounts ?? []).filter((a) => !a.isDemo);
  const showAccountFilter = nonDemoAccounts.length > 1;
  const hasNoAccounts = !accountsLoading && nonDemoAccounts.length === 0;

  // Selection helpers
  const visibleIds = (entries ?? []).map((e) => e.id);
  const allSelected = visibleIds.length > 0 && visibleIds.every((id) => selectedIds.has(id));
  const someSelected = visibleIds.some((id) => selectedIds.has(id));

  const toggleAll = () => {
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(visibleIds));
    }
  };

  const toggleOne = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleFilterChange = (key: string, value: string) => {
    setSelectedIds(new Set());
    const newParams = new URLSearchParams(searchParams);
    if (value) {
      newParams.set(key, value);
    } else {
      newParams.delete(key);
    }
    newParams.set('page', '1');
    setSearchParams(newParams);
  };

  const handlePageChange = (newPage: number) => {
    setSelectedIds(new Set());
    const newParams = new URLSearchParams(searchParams);
    newParams.set('page', String(newPage));
    setSearchParams(newParams);
  };

  const handlePageSizeChange = (newPageSize: number) => {
    setSelectedIds(new Set());
    const newParams = new URLSearchParams(searchParams);
    newParams.set('pageSize', String(newPageSize));
    newParams.set('page', '1');
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

  const handleDeleteSelected = async () => {
    await ledgerApi.deleteBatch([...selectedIds]);
    setSelectedIds(new Set());
    setShowDeleteSelectedConfirm(false);
    refetch();
  };

  const handleClearAll = async () => {
    await ledgerApi.clearAll();
    setSelectedIds(new Set());
    setShowClearAllConfirm(false);
    handlePageChange(1);
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

  const hasActiveFilters = !!(symbolFilter || entryType || accountIdFilter);
  const selectedCount = [...selectedIds].filter((id) => visibleIds.includes(id)).length;

  if (loading) return <LoadingSpinner />;
  if (error) return <ErrorAlert message={error} onRetry={refetch} />;

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2 mb-6">
        <h1 className="text-2xl font-bold">Ledger</h1>
        <div className="flex flex-wrap gap-2">
          {someSelected && (
            <button
              className="btn btn-outline btn-error"
              onClick={() => setShowDeleteSelectedConfirm(true)}
            >
              Delete {selectedCount} selected
            </button>
          )}
          {entries && entries.length > 0 && !someSelected && (
            <button
              className="btn btn-outline btn-error"
              onClick={() => setShowClearAllConfirm(true)}
            >
              Clear All
            </button>
          )}
          <button
            className="btn btn-primary"
            onClick={() => hasNoAccounts ? navigate('/app/accounts') : setIsModalOpen(true)}
          >
            {hasNoAccounts ? 'Add Trading Account' : 'New Entry'}
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-4 mb-6 flex-wrap items-center">
        {showAccountFilter && (
          <select
            className="select select-bordered select-sm"
            value={accountIdFilter}
            onChange={(e) => handleFilterChange('accountId', e.target.value)}
          >
            <option value="">All Accounts</option>
            {nonDemoAccounts.map((a) => (
              <option key={a.id} value={a.id}>{a.name}</option>
            ))}
          </select>
        )}

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

        {hasActiveFilters && (
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => {
              setSelectedIds(new Set());
              const newParams = new URLSearchParams();
              if (searchParams.get('pageSize')) newParams.set('pageSize', searchParams.get('pageSize')!);
              setSearchParams(newParams);
            }}
          >
            Clear filters
          </button>
        )}

        {meta && meta.total > 0 && (
          <div className="ml-auto">
            <PageNavigator
              page={page}
              total={meta.total}
              pageSize={pageSize}
              onPageChange={handlePageChange}
            />
          </div>
        )}
      </div>

      {entries?.length === 0 ? (
        hasNoAccounts && !hasActiveFilters ? (
          <EmptyState
            title="No trading accounts yet"
            description="Add a trading account — such as Coinbase, Kraken, or your broker — to start tracking your trades."
            action={{ label: 'Add Trading Account', onClick: () => navigate('/app/accounts') }}
          />
        ) : (
          <EmptyState
            title="No ledger entries"
            description={hasActiveFilters
              ? "No entries match the current filters."
              : "Record your first trade to start tracking your portfolio."
            }
            action={{ label: 'Add Entry', onClick: () => setIsModalOpen(true) }}
            secondaryAction={!hasActiveFilters ? {
              label: 'Load Demo Account',
              onClick: () => setIsDemoModalOpen(true),
              tooltip: 'Load sample crypto trades to explore the app',
            } : undefined}
          />
        )
      ) : (
        <>
        {/* Mobile: stacked card list */}
        <div className="sm:hidden">
          <div className="flex items-center gap-2 py-2 border-b border-base-200">
            <input
              type="checkbox"
              className="checkbox checkbox-sm"
              checked={allSelected}
              ref={(el) => { if (el) el.indeterminate = someSelected && !allSelected; }}
              onChange={toggleAll}
            />
            <span className="text-sm text-base-content/60">Select all</span>
          </div>
          <div className="divide-y divide-base-200">
            {entries?.map((entry) => (
              <div key={entry.id} className={`py-3 space-y-1.5 ${selectedIds.has(entry.id) ? 'bg-base-200' : ''}`}>
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <input
                      type="checkbox"
                      className="checkbox checkbox-sm shrink-0"
                      checked={selectedIds.has(entry.id)}
                      onChange={() => toggleOne(entry.id)}
                    />
                    <span className="font-mono font-medium">{entry.symbol}</span>
                    <span className={`badge ${ENTRY_TYPE_COLORS[entry.entryType]} badge-sm shrink-0`}>
                      {entry.entryType}
                    </span>
                    {showAccountFilter && (
                      <span className="text-xs text-base-content/50 truncate">{entry.account.name}</span>
                    )}
                  </div>
                  <span className="text-xs text-base-content/50 whitespace-nowrap shrink-0">
                    {new Date(entry.timestamp).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' })}
                  </span>
                </div>
                <div className="flex items-start justify-between gap-2 pl-7">
                  <div className="text-xs text-base-content/50 space-y-0.5">
                    <div>{formatQuantity(entry)} @ {formatPrice(entry.price)}</div>
                    {entry.fee && parseFloat(entry.fee) > 0 && (
                      <div>Fee: {formatValue(entry.fee)}</div>
                    )}
                    {entry.notes && (
                      <div className="truncate max-w-[180px]">{entry.notes}</div>
                    )}
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className={`font-mono text-sm font-medium ${parseFloat(entry.valueBase) >= 0 ? 'text-success' : 'text-error'}`}>
                      {formatValue(entry.valueBase)}
                    </span>
                    <LedgerMobilePnlDisplay entry={entry} />
                  </div>
                </div>
                <div className="flex justify-end gap-1">
                  <button className="btn btn-ghost btn-xs" onClick={() => setEditingEntry(entry)}>Edit</button>
                  <button className="btn btn-ghost btn-xs text-error" onClick={() => setDeletingEntry(entry)}>Delete</button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Desktop: full table */}
        <div className="hidden sm:block overflow-x-auto">
          <table className="table table-zebra">
            <thead>
              <tr>
                <th>
                  <input
                    type="checkbox"
                    className="checkbox checkbox-sm"
                    checked={allSelected}
                    ref={(el) => { if (el) el.indeterminate = someSelected && !allSelected; }}
                    onChange={toggleAll}
                  />
                </th>
                <th>Timestamp</th>
                <th>Type</th>
                <th>Symbol</th>
                {showAccountFilter && <th>Account</th>}
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
                <tr key={entry.id} className={selectedIds.has(entry.id) ? 'bg-base-200' : ''}>
                  <td>
                    <input
                      type="checkbox"
                      className="checkbox checkbox-sm"
                      checked={selectedIds.has(entry.id)}
                      onChange={() => toggleOne(entry.id)}
                    />
                  </td>
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
                  {showAccountFilter && (
                    <td className="text-sm text-base-content/70">{entry.account.name}</td>
                  )}
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
                  <PnlCell entryType={entry.entryType} pnl={entry.pnl} pnlStatus={entry.pnlStatus} />
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
        </>
      )}

      {meta && meta.total > 0 && (
        <Pagination
          page={page}
          pageSize={pageSize}
          total={meta.total}
          pageSizeOptions={PAGE_SIZE_OPTIONS}
          onPageChange={handlePageChange}
          onPageSizeChange={handlePageSizeChange}
        />
      )}

      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="New Ledger Entry"
      >
        <LedgerEntryForm
          accounts={accounts ?? []}
          accountsLoading={accountsLoading}
          initialAccountId={accountIdFilter || undefined}
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
            accounts={accounts ?? []}
            accountsLoading={accountsLoading}
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
        isOpen={showDeleteSelectedConfirm}
        onClose={() => setShowDeleteSelectedConfirm(false)}
        onConfirm={handleDeleteSelected}
        title="Delete Selected Entries"
        message={`Are you sure you want to delete ${selectedCount} selected ${selectedCount === 1 ? 'entry' : 'entries'}? This action cannot be undone.`}
        confirmLabel={`Delete ${selectedCount} ${selectedCount === 1 ? 'entry' : 'entries'}`}
        variant="danger"
      />

      <DemoAccountModal
        isOpen={isDemoModalOpen}
        onClose={() => setIsDemoModalOpen(false)}
        onLoaded={refetch}
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

function LedgerMobilePnlDisplay({ entry }: { entry: LedgerEntry }) {
  if (entry.entryType === 'SELL' && entry.pnl == null && entry.pnlStatus === 'PNL_UNCOMPUTABLE') {
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
  if (entry.pnl != null) {
    const num = parseFloat(entry.pnl);
    const colorClass = num >= 0 ? 'text-success' : 'text-error';
    const abs = Math.abs(num).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return <span className={`font-mono font-medium text-sm ${colorClass}`}>{num >= 0 ? `+${abs}` : `-${abs}`}</span>;
  }
  return null;
}

