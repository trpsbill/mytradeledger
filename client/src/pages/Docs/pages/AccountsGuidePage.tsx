import { Callout } from '../components/Callout';

export function AccountsGuidePage() {
  return (
    <div>
      <h1 className="text-3xl font-bold text-base-content mb-3">Accounts</h1>
      <p className="text-base-content/70 text-lg leading-relaxed mb-8">
        An account is a portfolio container that groups ledger entries together. P&amp;L,
        positions, and balances are all calculated independently per account.
      </p>

      <section className="mb-10">
        <h2 className="text-xl font-semibold text-base-content mb-4 pb-2 border-b border-base-300">
          Creating an Account
        </h2>
        <p className="text-base-content/70 mb-4">
          Navigate to the <strong>Accounts</strong> page from the top navigation and click{' '}
          <strong>+ New Account</strong>. You will be prompted for:
        </p>
        <div className="overflow-x-auto mb-4">
          <table className="table table-sm w-full">
            <thead>
              <tr>
                <th>Field</th>
                <th>Required</th>
                <th>Notes</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td><code className="text-xs font-mono">name</code></td>
                <td><span className="badge badge-xs badge-error">Yes</span></td>
                <td className="text-base-content/70">A descriptive label like "Main Portfolio" or "Roth IRA".</td>
              </tr>
              <tr>
                <td><code className="text-xs font-mono">baseCurrency</code></td>
                <td><span className="badge badge-xs badge-ghost">No</span></td>
                <td className="text-base-content/70">Currency for P&amp;L reporting. Defaults to <code className="text-xs bg-base-200 px-1 rounded">USD</code>.</td>
              </tr>
            </tbody>
          </table>
        </div>
        <Callout type="info">
          The base currency is used for display purposes in P&amp;L reports. MyTradeLedger does not
          perform currency conversion — it assumes your entry prices are already in the base currency.
        </Callout>
      </section>

      <section className="mb-10">
        <h2 className="text-xl font-semibold text-base-content mb-4 pb-2 border-b border-base-300">
          The Default Account
        </h2>
        <p className="text-base-content/70 mb-3">
          You do not need to create an account before adding your first trade. When you create a
          ledger entry without specifying an <code className="text-xs bg-base-200 px-1 rounded">accountId</code>,
          the server automatically creates a <strong>"Default"</strong> account on your behalf and
          assigns the entry to it.
        </p>
        <p className="text-base-content/70 mb-3">
          This means you can start recording trades immediately without any setup. If you later
          want to organize your trades into named accounts, you can rename the Default account or
          create new ones.
        </p>
        <Callout type="tip">
          The Default account is just a regular account — it has no special behavior beyond being
          auto-created. You can rename it, archive it, or delete it like any other account.
        </Callout>
      </section>

      <section className="mb-10">
        <h2 className="text-xl font-semibold text-base-content mb-4 pb-2 border-b border-base-300">
          Archiving vs. Deleting
        </h2>
        <p className="text-base-content/70 mb-4">
          Accounts support two ways to remove them from view:
        </p>
        <div className="space-y-4">
          <div className="border border-base-300 rounded-lg p-4 bg-base-100">
            <h3 className="font-semibold text-base-content mb-1">Archive</h3>
            <p className="text-sm text-base-content/70">
              Hides the account from the default account listing. All ledger entries are preserved.
              The account can be restored at any time via <strong>Unarchive</strong>. Use this when
              you close a brokerage account but want to keep the trade history.
            </p>
            <p className="mt-2 text-xs text-base-content/50 font-mono">
              POST /api/accounts/:id/archive
            </p>
          </div>
          <div className="border border-error/30 rounded-lg p-4 bg-error/5">
            <h3 className="font-semibold text-error mb-1">Delete</h3>
            <p className="text-sm text-base-content/70">
              Permanently removes the account <strong>and all its ledger entries</strong>. This
              action cannot be undone. Use this only when you are certain you no longer need the
              data.
            </p>
            <p className="mt-2 text-xs text-base-content/50 font-mono">
              DELETE /api/accounts/:id
            </p>
          </div>
        </div>
      </section>

      <section className="mb-10">
        <h2 className="text-xl font-semibold text-base-content mb-4 pb-2 border-b border-base-300">
          Multi-Account Workflows
        </h2>
        <p className="text-base-content/70 mb-4">
          Common patterns for organizing multiple accounts:
        </p>
        <div className="space-y-3">
          {[
            {
              name: 'By tax treatment',
              desc: 'Create separate accounts for "Taxable", "Roth IRA", and "Traditional IRA". P&L in each account reflects only that tax bucket, simplifying year-end reporting.',
            },
            {
              name: 'By brokerage',
              desc: 'One account per broker — "Fidelity", "Coinbase", "IBKR". Useful if you reconcile against broker statements regularly.',
            },
            {
              name: 'By asset class',
              desc: 'Separate accounts for "Equities", "Crypto", and "Forex" give you asset-class-level P&L breakdowns.',
            },
            {
              name: 'By strategy',
              desc: '"Momentum", "Buy and Hold", "Options" — track which strategies are performing.',
            },
          ].map((w) => (
            <div key={w.name} className="flex gap-3">
              <div className="mt-1 w-2 h-2 rounded-full bg-primary shrink-0"></div>
              <div>
                <span className="text-sm font-medium text-base-content">{w.name}: </span>
                <span className="text-sm text-base-content/70">{w.desc}</span>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="mb-10">
        <h2 className="text-xl font-semibold text-base-content mb-4 pb-2 border-b border-base-300">
          Account Balance and P&amp;L
        </h2>
        <p className="text-base-content/70 mb-3">
          Each account exposes two read endpoints:
        </p>
        <div className="space-y-3">
          <div className="bg-base-200 rounded p-3">
            <code className="text-xs font-mono">GET /api/accounts/:id/balance</code>
            <p className="text-sm text-base-content/70 mt-1">
              Returns the current <em>open position</em> — the quantity of each symbol you currently hold.
              For example: <code className="text-xs bg-base-100 px-1 rounded">{`{ "BTC/USD": "0.5", "AAPL": "10.0" }`}</code>
            </p>
          </div>
          <div className="bg-base-200 rounded p-3">
            <code className="text-xs font-mono">GET /api/accounts/:id/pnl</code>
            <p className="text-sm text-base-content/70 mt-1">
              Returns the total <em>realized</em> P&amp;L for the account, aggregated across all SELL entries.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
