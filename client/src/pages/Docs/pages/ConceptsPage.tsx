import { Callout } from '../components/Callout';

export function ConceptsPage() {
  return (
    <div>
      <h1 className="text-3xl font-bold text-base-content mb-3">Core Concepts</h1>
      <p className="text-base-content/70 text-lg leading-relaxed mb-8">
        Understanding the data model and a few key conventions will make everything else click.
      </p>

      <section className="mb-10">
        <h2 className="text-xl font-semibold text-base-content mb-4 pb-2 border-b border-base-300">
          Data Model
        </h2>
        <p className="text-base-content/70 mb-4">
          MyTradeLedger has four core entities arranged in a strict hierarchy:
        </p>
        <div className="space-y-4">
          {[
            {
              entity: 'User',
              desc: 'Your account. One user owns all their accounts and entries. Authentication is email + password; all API calls require a JWT Bearer token.',
            },
            {
              entity: 'Account',
              desc: 'A portfolio container — for example "Taxable Brokerage", "Roth IRA", or "Crypto". Each account has a base currency (default USD) used for P&L reporting. Accounts can be archived to hide them without losing data.',
            },
            {
              entity: 'LedgerEntry',
              desc: 'A single trade event belonging to an account. Stores the symbol, entry type, quantity, price, fee, timestamp, and computed values (valueBase, pnl). This is the core table.',
            },
            {
              entity: 'LedgerMetadata',
              desc: 'Zero or more arbitrary key-value pairs attached to a single LedgerEntry. Used for exchange order IDs, tax lot references, or any custom annotation you need without modifying the core schema.',
            },
          ].map((e) => (
            <div key={e.entity} className="flex gap-4">
              <div className="shrink-0 w-36">
                <code className="text-sm font-mono font-semibold text-primary bg-primary/10 px-2 py-1 rounded">
                  {e.entity}
                </code>
              </div>
              <p className="text-sm text-base-content/70 flex-1">{e.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mb-10">
        <h2 className="text-xl font-semibold text-base-content mb-4 pb-2 border-b border-base-300">
          Symbols
        </h2>
        <p className="text-base-content/70 mb-3">
          A symbol is a plain string — there is no validation or asset registry requirement.
          You can use any format that makes sense for your workflow:
        </p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 mb-4">
          {['BTC/USD', 'ETH/USD', 'AAPL', 'SPY', 'TSLA', 'EUR/USD', 'SOL/BTC', 'ROTH-AAPL'].map((s) => (
            <code key={s} className="text-xs font-mono bg-base-200 px-3 py-1.5 rounded text-center text-base-content/80">
              {s}
            </code>
          ))}
        </div>
        <p className="text-sm text-base-content/70">
          The only requirement is consistency: P&amp;L is calculated per account per symbol, so{' '}
          <code className="text-xs bg-base-200 px-1 rounded">BTC/USD</code> and{' '}
          <code className="text-xs bg-base-200 px-1 rounded">btc/usd</code> would be treated as
          two different symbols.
        </p>
        <Callout type="warning">
          Symbols are case-sensitive. Stick to one casing convention across all your entries.
        </Callout>
      </section>

      <section className="mb-10">
        <h2 className="text-xl font-semibold text-base-content mb-4 pb-2 border-b border-base-300">
          Quantities and valueBase
        </h2>
        <p className="text-base-content/70 mb-4">
          The database stores <code className="text-xs bg-base-200 px-1 rounded">quantity</code>{' '}
          as a signed decimal, but the API and UI accept positive numbers and derive the sign from
          the entry type:
        </p>
        <div className="overflow-x-auto mb-4">
          <table className="table table-sm w-full text-sm">
            <thead>
              <tr>
                <th>Entry Type</th>
                <th>quantity sign</th>
                <th>valueBase sign</th>
                <th>Meaning</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td><code className="text-xs font-mono">BUY</code></td>
                <td className="text-success font-mono">+ (positive)</td>
                <td className="text-error font-mono">− (negative)</td>
                <td className="text-base-content/70">Asset in, cash out</td>
              </tr>
              <tr>
                <td><code className="text-xs font-mono">SELL</code></td>
                <td className="text-error font-mono">− (negative)</td>
                <td className="text-success font-mono">+ (positive)</td>
                <td className="text-base-content/70">Asset out, cash in</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className="text-sm text-base-content/70">
          <code className="text-xs bg-base-200 px-1 rounded">valueBase</code> is calculated
          automatically as <code className="text-xs bg-base-200 px-1 rounded">±(quantity × price)</code>.
          You never need to set it manually.
        </p>
      </section>

      <section className="mb-10">
        <h2 className="text-xl font-semibold text-base-content mb-4 pb-2 border-b border-base-300">
          Entry Types
        </h2>
        <p className="text-base-content/70 mb-4">
          The <code className="text-xs bg-base-200 px-1 rounded">EntryType</code> enum has six
          values. The UI currently exposes BUY and SELL; all types are available via the API.
        </p>
        <div className="overflow-x-auto">
          <table className="table table-sm w-full">
            <thead>
              <tr>
                <th>Type</th>
                <th>Triggers P&amp;L?</th>
                <th>Description</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td><code className="text-xs font-mono font-semibold">BUY</code></td>
                <td><span className="badge badge-xs badge-ghost">No</span></td>
                <td className="text-base-content/70">Purchase of an asset. Increases your position and cost basis.</td>
              </tr>
              <tr>
                <td><code className="text-xs font-mono font-semibold">SELL</code></td>
                <td><span className="badge badge-xs badge-success">Yes</span></td>
                <td className="text-base-content/70">Sale of an asset. Decreases your position and triggers realized P&amp;L calculation.</td>
              </tr>
              <tr>
                <td><code className="text-xs font-mono font-semibold">FEE</code></td>
                <td><span className="badge badge-xs badge-ghost">No</span></td>
                <td className="text-base-content/70">Standalone fee not attached to a buy or sell (e.g. custody fee, subscription).</td>
              </tr>
              <tr>
                <td><code className="text-xs font-mono font-semibold">DEPOSIT</code></td>
                <td><span className="badge badge-xs badge-ghost">No</span></td>
                <td className="text-base-content/70">Cash deposited into the account. Useful for tracking cash flow.</td>
              </tr>
              <tr>
                <td><code className="text-xs font-mono font-semibold">WITHDRAWAL</code></td>
                <td><span className="badge badge-xs badge-ghost">No</span></td>
                <td className="text-base-content/70">Cash withdrawn from the account.</td>
              </tr>
              <tr>
                <td><code className="text-xs font-mono font-semibold">ADJUSTMENT</code></td>
                <td><span className="badge badge-xs badge-ghost">No</span></td>
                <td className="text-base-content/70">Manual correction or reconciliation entry. Does not affect position tracking.</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section className="mb-10">
        <h2 className="text-xl font-semibold text-base-content mb-4 pb-2 border-b border-base-300">
          How P&amp;L is Calculated
        </h2>
        <p className="text-base-content/70 mb-3">
          Realized P&amp;L is computed on every <code className="text-xs bg-base-200 px-1 rounded">SELL</code> entry
          using the <strong>average cost method</strong>. When you sell, the system looks up the
          weighted-average cost of all prior BUY entries for that symbol in that account, then
          multiplies the difference by the quantity sold. See the{' '}
          <a href="/docs/pnl" className="text-primary hover:underline">P&amp;L Calculation</a> page
          for a worked numeric example.
        </p>
      </section>
    </div>
  );
}
