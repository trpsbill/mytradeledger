import { Callout } from '../components/Callout';

export function PnLPage() {
  return (
    <div>
      <h1 className="text-3xl font-bold text-base-content mb-3">P&amp;L Calculation</h1>
      <p className="text-base-content/70 text-lg leading-relaxed mb-8">
        MyTradeLedger calculates realized profit and loss automatically on every SELL entry
        using the <strong>average cost method</strong> (also called average cost basis).
        Two figures are produced for each SELL: <strong>Gross P&amp;L</strong> (before fees)
        and <strong>Net P&amp;L</strong> (after fees).
      </p>

      <section className="mb-10">
        <h2 className="text-xl font-semibold text-base-content mb-4 pb-2 border-b border-base-300">
          The Average Cost Method
        </h2>
        <p className="text-base-content/70 mb-4">
          The average cost method determines your cost basis by dividing the total amount you paid
          for all units of a symbol — recorded <em>up to and including the sell date</em> — by the
          total number of units purchased. This gives you a single blended cost per unit:
        </p>
        <div className="bg-base-200 rounded-lg p-5 font-mono text-sm mb-4 space-y-2">
          <p className="text-base-content/60 text-xs uppercase tracking-widest">Formula</p>
          <p>avg_cost = Σ(buy_qty × buy_price) ÷ Σ(buy_qty)</p>
          <p>gross_pnl = (sell_price − avg_cost) × sell_qty</p>
        </div>
        <p className="text-sm text-base-content/70">
          The average cost is recalculated dynamically as you add more BUY entries. Each new purchase
          adjusts the blended rate, which in turn affects the P&amp;L on future SELL entries.
          Critically, only BUY entries with a timestamp <em>on or before</em> the SELL's timestamp
          count toward the average — later purchases are excluded so that historical sells are not
          retroactively repriced.
        </p>
      </section>

      <section className="mb-10">
        <h2 className="text-xl font-semibold text-base-content mb-4 pb-2 border-b border-base-300">
          Gross P&amp;L vs. Net P&amp;L
        </h2>
        <p className="text-base-content/70 mb-4">
          The two P&amp;L figures differ only in how trading fees are treated:
        </p>

        <div className="space-y-4 mb-6">
          <div className="border border-base-300 rounded-lg p-4">
            <h3 className="font-semibold text-base-content mb-2">Gross P&amp;L — fee-exclusive</h3>
            <p className="text-sm text-base-content/70 mb-3">
              Fees paid when buying are <em>not</em> added to the cost basis. The average cost is
              the raw purchase price only.
            </p>
            <div className="bg-base-200 rounded p-3 font-mono text-xs space-y-1">
              <p>avg_cost = Σ(buy_qty × buy_price) ÷ Σ(buy_qty)</p>
              <p>gross_pnl = (sell_price − avg_cost) × sell_qty</p>
            </div>
          </div>

          <div className="border border-base-300 rounded-lg p-4">
            <h3 className="font-semibold text-base-content mb-2">Net P&amp;L — fee-inclusive</h3>
            <p className="text-sm text-base-content/70 mb-3">
              Buy-side fees are folded into the cost basis (raising it), and the sell-side fee is
              subtracted from the proceeds. This gives a truer picture of actual profit after
              all commission costs.
            </p>
            <div className="bg-base-200 rounded p-3 font-mono text-xs space-y-1">
              <p>net_avg_cost = Σ(buy_qty × buy_price + buy_fee) ÷ Σ(buy_qty)</p>
              <p>net_pnl = (sell_price × sell_qty − sell_fee) − (net_avg_cost × sell_qty)</p>
            </div>
          </div>
        </div>

        <Callout type="tip">
          Use <strong>Gross P&amp;L</strong> to compare raw trade performance, and{' '}
          <strong>Net P&amp;L</strong> to see how much you actually kept after paying the broker.
          The difference between the two — shown as <em>Commission drag</em> on the account card
          — is the total fees paid across all trades.
        </Callout>
      </section>

      <section className="mb-10">
        <h2 className="text-xl font-semibold text-base-content mb-4 pb-2 border-b border-base-300">
          Worked Example
        </h2>
        <p className="text-base-content/70 mb-5">
          Suppose you make three trades in BTC/USD, each with a $10 fee:
        </p>

        <div className="space-y-3 mb-6">
          <div className="flex items-start gap-4 border border-base-300 rounded-lg p-4 bg-base-100">
            <span className="badge badge-success badge-sm shrink-0 mt-0.5">BUY</span>
            <div className="flex-1 text-sm">
              <p className="font-medium text-base-content">Buy 1 BTC at $60,000 (fee $10)</p>
              <p className="text-base-content/60 mt-1">
                Gross avg cost: <strong>$60,000</strong> | Net avg cost: <strong>$60,010</strong>{' '}
                <span className="text-base-content/40">(price + fee ÷ qty)</span>
              </p>
            </div>
          </div>

          <div className="flex items-start gap-4 border border-base-300 rounded-lg p-4 bg-base-100">
            <span className="badge badge-success badge-sm shrink-0 mt-0.5">BUY</span>
            <div className="flex-1 text-sm">
              <p className="font-medium text-base-content">Buy 1 more BTC at $70,000 (fee $10)</p>
              <p className="text-base-content/60 mt-1">
                Gross avg cost: <strong>$65,000</strong>{' '}
                <span className="text-base-content/40">($130,000 ÷ 2)</span> |{' '}
                Net avg cost: <strong>$65,010</strong>{' '}
                <span className="text-base-content/40">($130,020 ÷ 2)</span>
              </p>
            </div>
          </div>

          <div className="flex items-start gap-4 border border-primary/30 rounded-lg p-4 bg-primary/5">
            <span className="badge badge-error badge-sm shrink-0 mt-0.5">SELL</span>
            <div className="flex-1 text-sm">
              <p className="font-medium text-base-content">Sell 1 BTC at $75,000 (fee $10)</p>
              <div className="mt-2 grid grid-cols-2 gap-3">
                <div className="bg-base-100 rounded p-3 font-mono text-xs space-y-1 border border-base-300">
                  <p className="text-base-content/50 uppercase text-xs tracking-wider">Gross</p>
                  <p>avg_cost = $65,000</p>
                  <p>pnl = ($75,000 − $65,000) × 1</p>
                  <p className="text-success font-semibold">gross_pnl = +$10,000</p>
                </div>
                <div className="bg-base-100 rounded p-3 font-mono text-xs space-y-1 border border-base-300">
                  <p className="text-base-content/50 uppercase text-xs tracking-wider">Net</p>
                  <p>net_avg_cost = $65,010</p>
                  <p>proceeds = $75,000 − $10 = $74,990</p>
                  <p>net_pnl = $74,990 − ($65,010 × 1)</p>
                  <p className="text-success font-semibold">net_pnl = +$9,980</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <Callout type="tip">
          The average cost method means the order of your BUY entries does not matter — only the
          cumulative total cost and quantity matter. This is different from FIFO (first-in, first-out)
          or LIFO (last-in, first-out) methods.
        </Callout>
      </section>

      <section className="mb-10">
        <h2 className="text-xl font-semibold text-base-content mb-4 pb-2 border-b border-base-300">
          When P&amp;L Can't Be Calculated
        </h2>
        <p className="text-base-content/70 mb-4">
          In some situations it is mathematically impossible to compute a meaningful P&amp;L figure.
          When this happens, the entry is flagged with a yellow warning triangle{' '}
          <span className="inline-flex items-center gap-1 text-warning">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
              <path fillRule="evenodd" d="M9.401 3.003c1.155-2 4.043-2 5.197 0l7.355 12.748c1.154 2-.29 4.5-2.599 4.5H4.645c-2.309 0-3.752-2.5-2.598-4.5L9.4 3.003zM12 8.25a.75.75 0 01.75.75v3.75a.75.75 0 01-1.5 0V9a.75.75 0 01.75-.75zm0 8.25a.75.75 0 100-1.5.75.75 0 000 1.5z" clipRule="evenodd" />
            </svg>
          </span>{' '}
          in the ledger table and the account summary card shows how many sells were excluded from
          the totals.
        </p>
        <p className="text-base-content/70 mb-5">
          There are two conditions that trigger this flag:
        </p>

        <div className="space-y-4 mb-6">
          <div className="border-l-4 border-warning pl-4 py-1">
            <h3 className="font-semibold text-base-content mb-1">1. No purchases recorded before the sale</h3>
            <p className="text-sm text-base-content/70">
              The average cost formula requires at least one BUY entry with a timestamp on or before
              the SELL's timestamp. If no such entry exists — because you received the asset as a
              gift, an airdrop, staking reward, or through a transfer not yet recorded — there is
              no cost basis to divide by, and the calculation would produce an undefined result.
            </p>
          </div>

          <div className="border-l-4 border-warning pl-4 py-1">
            <h3 className="font-semibold text-base-content mb-1">2. Sell quantity exceeds accumulated purchases</h3>
            <p className="text-sm text-base-content/70">
              If the quantity being sold is larger than the total quantity of all BUY entries
              recorded up to the sell date, the average cost method breaks down — you would be
              assigning a cost basis to units you have no purchase record for. This can happen
              when some buy history is missing or when a transfer-in was not recorded.
            </p>
          </div>
        </div>

        <Callout type="warning">
          Excluded trades are <strong>silently dropped from the account-level P&amp;L totals</strong>.
          The gross and net figures shown on the account card reflect only the sells that could be
          fully costed. An account with excluded trades will show a count of how many were skipped,
          so you know the totals are incomplete.
        </Callout>

        <h3 className="font-semibold text-base-content mt-6 mb-3">How to fix excluded trades</h3>
        <p className="text-sm text-base-content/70 mb-3">
          To turn a flagged SELL into a costed one, record the missing acquisition history:
        </p>
        <ol className="list-decimal list-inside space-y-2 text-sm text-base-content/70 mb-4">
          <li>
            Add a BUY (or DEPOSIT/ADJUSTMENT) entry with a timestamp <em>before</em> the flagged
            SELL, covering the quantity you acquired.
          </li>
          <li>
            Once saved, click <strong>Recalculate P&amp;L</strong> (or call{' '}
            <code className="text-xs bg-base-200 px-1 rounded">POST /api/ledger/recalculate-pnl</code>)
            to reprocess all SELL entries. The flag will clear automatically if the new BUY
            provides sufficient cost basis.
          </li>
        </ol>
        <p className="text-sm text-base-content/70">
          If you genuinely have no cost basis — e.g. an airdrop received at zero cost — record the
          acquisition as a BUY at price $0. This gives the average cost engine a basis of $0/unit,
          so the entire proceeds of the sale become realized gain.
        </p>
      </section>

      <section className="mb-10">
        <h2 className="text-xl font-semibold text-base-content mb-4 pb-2 border-b border-base-300">
          What valueBase Represents
        </h2>
        <p className="text-base-content/70 mb-3">
          <code className="text-xs bg-base-200 px-1 rounded">valueBase</code> is a computed field
          on every ledger entry. It represents the cash impact of the trade in the account's base
          currency:
        </p>
        <div className="overflow-x-auto mb-4">
          <table className="table table-sm w-full">
            <thead>
              <tr>
                <th>Entry Type</th>
                <th>valueBase</th>
                <th>Meaning</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td><code className="text-xs font-mono">BUY</code></td>
                <td className="font-mono text-error">−(quantity × price)</td>
                <td className="text-base-content/70">Cash leaving the account to buy the asset</td>
              </tr>
              <tr>
                <td><code className="text-xs font-mono">SELL</code></td>
                <td className="font-mono text-success">+(quantity × price)</td>
                <td className="text-base-content/70">Cash entering the account from the sale</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className="text-sm text-base-content/70">
          Summing all <code className="text-xs bg-base-200 px-1 rounded">valueBase</code> values
          for an account gives you the net cash flow — useful for reconciling against your brokerage
          statement. The P&amp;L, by contrast, represents only the gain or loss on closed positions.
        </p>
      </section>

      <section className="mb-10">
        <h2 className="text-xl font-semibold text-base-content mb-4 pb-2 border-b border-base-300">
          When P&amp;L is Computed
        </h2>
        <p className="text-base-content/70 mb-3">
          Realized P&amp;L is calculated immediately when you create or update a SELL entry. The
          server reads all BUY entries for the same symbol in the same account with a timestamp
          on or before the SELL's timestamp, computes the average cost, then stores both the gross
          and net P&amp;L values on the SELL entry.
        </p>
        <p className="text-base-content/70 mb-3">
          Only <code className="text-xs bg-base-200 px-1 rounded">SELL</code> entries have a{' '}
          <code className="text-xs bg-base-200 px-1 rounded">pnl</code> value. BUY, FEE, DEPOSIT,
          WITHDRAWAL, and ADJUSTMENT entries will always show <code className="text-xs bg-base-200 px-1 rounded">null</code>{' '}
          for P&amp;L.
        </p>
      </section>

      <section className="mb-10">
        <h2 className="text-xl font-semibold text-base-content mb-4 pb-2 border-b border-base-300">
          Recalculating P&amp;L
        </h2>
        <p className="text-base-content/70 mb-3">
          If you edit or delete historical BUY entries, the P&amp;L stored on subsequent SELL entries
          may be outdated. To recompute everything from scratch, call the recalculate endpoint:
        </p>
        <div className="bg-base-200 rounded p-3 font-mono text-xs text-base-content/80 mb-3">
          POST /api/ledger/recalculate-pnl
        </div>
        <p className="text-sm text-base-content/70 mb-3">
          This iterates through all SELL entries for your user and recomputes the average cost,
          gross P&amp;L, net P&amp;L, and flag status for each one. The response includes the number
          of entries updated:
        </p>
        <pre className="bg-base-200 rounded p-3 text-xs font-mono">{`{ "data": { "updated": 12 } }`}</pre>

        <Callout type="info">
          You also need to run recalculate-pnl after bulk-importing entries via the CSV import if
          any of the imported entries are back-dated prior to existing SELL entries.
        </Callout>
      </section>

      <section className="mb-10">
        <h2 className="text-xl font-semibold text-base-content mb-4 pb-2 border-b border-base-300">
          P&amp;L Scope
        </h2>
        <p className="text-base-content/70">
          P&amp;L is always scoped to a single <strong>account + symbol</strong> combination.
          Trades in different accounts never affect each other's cost basis, even if they involve
          the same symbol. This mirrors the real-world behavior of holding the same stock in
          multiple brokerage accounts.
        </p>
      </section>
    </div>
  );
}
