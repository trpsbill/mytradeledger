import { Callout } from '../components/Callout';

export function LedgerGuidePage() {
  return (
    <div>
      <h1 className="text-3xl font-bold text-base-content mb-3">Ledger Entries</h1>
      <p className="text-base-content/70 text-lg leading-relaxed mb-8">
        Ledger entries are the heart of MyTradeLedger. Each row records a single trade event
        and carries all the information needed to compute P&amp;L, positions, and exports.
      </p>

      <section className="mb-10">
        <h2 className="text-xl font-semibold text-base-content mb-4 pb-2 border-b border-base-300">
          Adding a Trade
        </h2>
        <p className="text-base-content/70 mb-4">
          From the <strong>Ledger</strong> page, click <strong>+ Add Entry</strong>. The form
          accepts the following fields:
        </p>
        <div className="overflow-x-auto">
          <table className="table table-sm w-full">
            <thead>
              <tr>
                <th>Field</th>
                <th>Required</th>
                <th>Description</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td><code className="text-xs font-mono">symbol</code></td>
                <td><span className="badge badge-xs badge-error">Yes</span></td>
                <td className="text-base-content/70">Free-form ticker string, e.g. <code className="text-xs bg-base-200 px-1 rounded">BTC/USD</code> or <code className="text-xs bg-base-200 px-1 rounded">AAPL</code>. Case-sensitive.</td>
              </tr>
              <tr>
                <td><code className="text-xs font-mono">entryType</code></td>
                <td><span className="badge badge-xs badge-error">Yes</span></td>
                <td className="text-base-content/70">BUY or SELL in the UI. All six types available via API.</td>
              </tr>
              <tr>
                <td><code className="text-xs font-mono">quantity</code></td>
                <td><span className="badge badge-xs badge-error">Yes</span></td>
                <td className="text-base-content/70">Number of units traded. Always enter as a positive number — the system applies the sign based on entry type.</td>
              </tr>
              <tr>
                <td><code className="text-xs font-mono">price</code></td>
                <td><span className="badge badge-xs badge-error">Yes</span></td>
                <td className="text-base-content/70">Price per unit in the account's base currency at the time of the trade.</td>
              </tr>
              <tr>
                <td><code className="text-xs font-mono">fee</code></td>
                <td><span className="badge badge-xs badge-ghost">No</span></td>
                <td className="text-base-content/70">Commission or transaction fee. Stored separately but does not affect valueBase or P&amp;L calculations (tracked for record-keeping).</td>
              </tr>
              <tr>
                <td><code className="text-xs font-mono">timestamp</code></td>
                <td><span className="badge badge-xs badge-ghost">No</span></td>
                <td className="text-base-content/70">ISO 8601 date/time of the trade. Defaults to now if omitted. Historical trades can be back-dated.</td>
              </tr>
              <tr>
                <td><code className="text-xs font-mono">notes</code></td>
                <td><span className="badge badge-xs badge-ghost">No</span></td>
                <td className="text-base-content/70">Free-text notes. Good for recording why you made the trade.</td>
              </tr>
              <tr>
                <td><code className="text-xs font-mono">accountId</code></td>
                <td><span className="badge badge-xs badge-ghost">No</span></td>
                <td className="text-base-content/70">Target account. If omitted, the Default account is used (and created if it doesn't exist).</td>
              </tr>
            </tbody>
          </table>
        </div>

        <Callout type="info">
          <code>valueBase</code> is computed automatically as <code>±(quantity × price)</code> — negative for BUY (cash out), positive for SELL (cash in). You never enter it manually.
        </Callout>
      </section>

      <section className="mb-10">
        <h2 className="text-xl font-semibold text-base-content mb-4 pb-2 border-b border-base-300">
          Entry Types Reference
        </h2>
        <div className="overflow-x-auto">
          <table className="table table-sm w-full">
            <thead>
              <tr>
                <th>Type</th>
                <th>Triggers P&amp;L</th>
                <th>Affects Position</th>
                <th>Description</th>
              </tr>
            </thead>
            <tbody>
              {[
                { type: 'BUY', pnl: false, pos: true, desc: 'Purchase. Increases your holding and cost basis for the symbol.' },
                { type: 'SELL', pnl: true, pos: true, desc: 'Sale. Reduces your holding and realizes P&L using average cost.' },
                { type: 'FEE', pnl: false, pos: false, desc: 'Standalone fee (e.g. custody fee, staking withdrawal fee).' },
                { type: 'DEPOSIT', pnl: false, pos: false, desc: 'Cash deposited into the account. Does not affect asset positions.' },
                { type: 'WITHDRAWAL', pnl: false, pos: false, desc: 'Cash withdrawn from the account.' },
                { type: 'ADJUSTMENT', pnl: false, pos: false, desc: 'Manual correction entry. Use when reconciling discrepancies.' },
              ].map((row) => (
                <tr key={row.type}>
                  <td><code className="text-xs font-mono font-semibold">{row.type}</code></td>
                  <td>
                    {row.pnl
                      ? <span className="badge badge-xs badge-success">Yes</span>
                      : <span className="badge badge-xs badge-ghost">No</span>}
                  </td>
                  <td>
                    {row.pos
                      ? <span className="badge badge-xs badge-info">Yes</span>
                      : <span className="badge badge-xs badge-ghost">No</span>}
                  </td>
                  <td className="text-sm text-base-content/70">{row.desc}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mb-10">
        <h2 className="text-xl font-semibold text-base-content mb-4 pb-2 border-b border-base-300">
          Editing Entries
        </h2>
        <p className="text-base-content/70 mb-3">
          Click the edit icon on any ledger row to open the edit form. All fields except
          <code className="text-xs bg-base-200 mx-1 px-1 rounded">accountId</code> can be modified.
        </p>
        <Callout type="warning">
          If you edit a historical BUY entry — especially its price or quantity — the P&amp;L on
          subsequent SELL entries for the same symbol may be stale. After editing historical entries,
          call <code>POST /api/ledger/recalculate-pnl</code> to recompute all realized P&amp;L
          values from scratch.
        </Callout>
      </section>

      <section className="mb-10">
        <h2 className="text-xl font-semibold text-base-content mb-4 pb-2 border-b border-base-300">
          Deleting Entries
        </h2>
        <p className="text-base-content/70 mb-3">
          Click the delete icon on any ledger row and confirm. Individual entry deletion is
          permanent. If you need to clear all entries (e.g. during testing or migration), the API
          provides a bulk delete endpoint:
        </p>
        <div className="bg-base-200 rounded p-3 font-mono text-xs text-base-content/80">
          DELETE /api/ledger/all
        </div>
        <Callout type="warning">
          <code>DELETE /api/ledger/all</code> deletes every ledger entry across all accounts for
          your user. This is irreversible. It does not delete the accounts themselves.
        </Callout>
      </section>

      <section className="mb-10">
        <h2 className="text-xl font-semibold text-base-content mb-4 pb-2 border-b border-base-300">
          Filtering and Pagination
        </h2>
        <p className="text-base-content/70 mb-3">
          The ledger table supports filtering by symbol and entry type via the filter controls above
          the table. These filters are stored in the URL query string, so you can bookmark or share
          filtered views.
        </p>
        <p className="text-sm text-base-content/70">
          Via the API, additional filters are available: <code className="text-xs bg-base-200 px-1 rounded">startDate</code>,
          <code className="text-xs bg-base-200 mx-1 px-1 rounded">endDate</code>,
          <code className="text-xs bg-base-200 px-1 rounded">limit</code>, and
          <code className="text-xs bg-base-200 ml-1 px-1 rounded">offset</code> for pagination.
          The default page size is 100 entries.
        </p>
      </section>
    </div>
  );
}
