import { useState } from 'react';
import { Link } from 'react-router-dom';
import { LoadingSpinner, ErrorAlert, EmptyState, Modal, ConfirmDialog } from '../../components';
import { useApi } from '../../hooks';
import { accountsApi } from '../../services/api';
import { AccountForm } from './AccountForm';
import type { Account, CreateAccountRequest } from '../../types';

export function AccountsPage() {
  const [showArchived, setShowArchived] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);
  const [deletingAccount, setDeletingAccount] = useState<Account | null>(null);

  const { data: accounts, loading, error, refetch } = useApi(
    () => accountsApi.list(showArchived),
    [showArchived]
  );

  const handleCreate = async (data: CreateAccountRequest) => {
    await accountsApi.create(data);
    setIsModalOpen(false);
    refetch();
  };

  const handleUpdate = async (data: CreateAccountRequest) => {
    if (!editingAccount) return;
    await accountsApi.update(editingAccount.id, data);
    setEditingAccount(null);
    refetch();
  };

  const handleDelete = async () => {
    if (!deletingAccount) return;
    await accountsApi.delete(deletingAccount.id);
    setDeletingAccount(null);
    refetch();
  };

  const handleArchive = async (account: Account) => {
    if (account.archivedAt) {
      await accountsApi.unarchive(account.id);
    } else {
      await accountsApi.archive(account.id);
    }
    refetch();
  };

  if (loading) return <LoadingSpinner />;
  if (error) return <ErrorAlert message={error} onRetry={refetch} />;

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Accounts</h1>
        <div className="flex gap-2">
          <label className="label cursor-pointer gap-2">
            <span className="label-text">Show archived</span>
            <input
              type="checkbox"
              className="toggle toggle-sm"
              checked={showArchived}
              onChange={(e) => setShowArchived(e.target.checked)}
            />
          </label>
          <button className="btn btn-primary" onClick={() => setIsModalOpen(true)}>
            New Account
          </button>
        </div>
      </div>

      {accounts?.length === 0 ? (
        <EmptyState
          title="No accounts yet"
          description="Create your first trading account to start logging trades."
          action={{ label: 'Create Account', onClick: () => setIsModalOpen(true) }}
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {accounts?.map((account) => (
            <AccountCard
              key={account.id}
              account={account}
              onEdit={() => setEditingAccount(account)}
              onDelete={() => setDeletingAccount(account)}
              onArchive={() => handleArchive(account)}
            />
          ))}
        </div>
      )}

      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Create Account"
      >
        <AccountForm
          onSubmit={handleCreate}
          onCancel={() => setIsModalOpen(false)}
        />
      </Modal>

      <Modal
        isOpen={!!editingAccount}
        onClose={() => setEditingAccount(null)}
        title="Edit Account"
      >
        {editingAccount && (
          <AccountForm
            account={editingAccount}
            onSubmit={handleUpdate}
            onCancel={() => setEditingAccount(null)}
          />
        )}
      </Modal>

      <ConfirmDialog
        isOpen={!!deletingAccount}
        onClose={() => setDeletingAccount(null)}
        onConfirm={handleDelete}
        title="Delete Account"
        message={`Are you sure you want to delete "${deletingAccount?.name}"? This will also delete all ledger entries for this account. This action cannot be undone.`}
        confirmLabel="Delete"
        variant="danger"
      />
    </div>
  );
}

interface AccountCardProps {
  account: Account;
  onEdit: () => void;
  onDelete: () => void;
  onArchive: () => void;
}

function AccountCard({ account, onEdit, onDelete, onArchive }: AccountCardProps) {
  const { data: pnl } = useApi(() => accountsApi.getPnL(account.id), [account.id]);

  const pnlValue = pnl ? parseFloat(pnl.totalPnL) : 0;
  const pnlColor = pnlValue >= 0 ? 'text-success' : 'text-error';

  return (
    <div className={`card bg-base-100 shadow-xl ${account.archivedAt ? 'opacity-60' : ''}`}>
      <div className="card-body">
        <div className="flex justify-between items-start">
          <div>
            <h2 className="card-title">
              {account.name}
              {account.archivedAt && (
                <span className="badge badge-ghost badge-sm">Archived</span>
              )}
            </h2>
            <p className="text-sm text-base-content/70">Base: {account.baseCurrency}</p>
          </div>
          <div className="dropdown dropdown-end">
            <label tabIndex={0} className="btn btn-ghost btn-sm btn-circle">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
              </svg>
            </label>
            <ul tabIndex={0} className="dropdown-content z-[1] menu p-2 shadow bg-base-100 rounded-box w-52">
              <li><button onClick={onEdit}>Edit</button></li>
              <li><button onClick={onArchive}>{account.archivedAt ? 'Unarchive' : 'Archive'}</button></li>
              <li><button onClick={onDelete} className="text-error">Delete</button></li>
            </ul>
          </div>
        </div>

        <div className="mt-4">
          <div className="stat p-0">
            <div className="stat-title">Total P&L</div>
            <div className={`stat-value text-2xl ${pnlColor}`}>
              {pnlValue >= 0 ? '+' : ''}{pnlValue.toFixed(2)} {account.baseCurrency}
            </div>
          </div>
        </div>

        <div className="card-actions justify-end mt-4">
          <Link to={`/ledger?accountId=${account.id}`} className="btn btn-sm btn-outline">
            View Ledger
          </Link>
        </div>
      </div>
    </div>
  );
}
