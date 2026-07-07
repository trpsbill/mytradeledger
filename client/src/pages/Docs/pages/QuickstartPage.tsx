import { Link } from 'react-router-dom';
import { Callout } from '../components/Callout';

function Step({ number, title, children }: { number: number; title: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-4 mb-8">
      <div className="shrink-0">
        <div className="w-8 h-8 rounded-full bg-primary text-primary-content flex items-center justify-center text-sm font-bold">
          {number}
        </div>
      </div>
      <div className="flex-1 pt-0.5">
        <h3 className="text-base font-semibold text-base-content mb-2">{title}</h3>
        <div className="text-sm text-base-content/70 space-y-2">{children}</div>
      </div>
    </div>
  );
}

export function QuickstartPage() {
  return (
    <div>
      <h1 className="text-3xl font-bold text-base-content mb-3">Quick Start</h1>
      <p className="text-base-content/70 text-lg leading-relaxed mb-8">
        From zero to your first realized P&amp;L in five steps. This walkthrough assumes you have
        access to the app at{' '}
        <code className="text-sm bg-base-200 px-1.5 py-0.5 rounded">mytradeledger.home.arpa</code>.
      </p>

      <div className="mb-10">
        <Step number={1} title="Create your account">
          <p>
            Navigate to <strong>Sign Up</strong> on the home page. Enter your email address and
            choose a password of at least 8 characters. The <em>Marketing opt-in</em> checkbox is
            optional — leave it unchecked if you prefer not to receive product updates.
          </p>
          <p>
            After registering you will be issued a JWT token and logged in automatically. This token
            is valid for 30 days.
          </p>
          <Callout type="info">
            If you already have an account, click <strong>Log In</strong> instead.
          </Callout>
        </Step>

        <Step number={2} title="Navigate to the Ledger">
          <p>
            Once logged in, you will land on the <strong>Dashboard</strong>. Click{' '}
            <strong>Ledger</strong> in the top navigation bar.
          </p>
          <p>
            The ledger table will be empty. You will also notice there are no accounts yet — a{' '}
            <strong>Default</strong> account will be created automatically the first time you add
            an entry.
          </p>
        </Step>

        <Step number={3} title="Add your first BUY trade">
          <p>
            Click the <strong>+ Add Entry</strong> button. Fill in the form:
          </p>
          <div className="bg-base-200 rounded-lg p-4 font-mono text-xs mt-2 space-y-1">
            <div><span className="text-base-content/50">Symbol:</span>  BTC/USD</div>
            <div><span className="text-base-content/50">Type:</span>    BUY</div>
            <div><span className="text-base-content/50">Quantity:</span> 1</div>
            <div><span className="text-base-content/50">Price:</span>   60000</div>
            <div><span className="text-base-content/50">Fee:</span>     9.99  <span className="text-base-content/40">(optional)</span></div>
          </div>
          <p className="mt-2">
            Click <strong>Save</strong>. The entry appears in the ledger with a negative{' '}
            <code>valueBase</code> of <code>-60000</code> — representing cash leaving your account
            to acquire the asset.
          </p>
          <Callout type="tip">
            The <strong>Default</strong> account was created automatically in the background. Visit
            the <strong>Accounts</strong> page to rename it or create additional accounts.
          </Callout>
        </Step>

        <Step number={4} title="Add a SELL trade">
          <p>
            Click <strong>+ Add Entry</strong> again and record a partial sale:
          </p>
          <div className="bg-base-200 rounded-lg p-4 font-mono text-xs mt-2 space-y-1">
            <div><span className="text-base-content/50">Symbol:</span>  BTC/USD</div>
            <div><span className="text-base-content/50">Type:</span>    SELL</div>
            <div><span className="text-base-content/50">Quantity:</span> 0.5</div>
            <div><span className="text-base-content/50">Price:</span>   75000</div>
          </div>
          <p className="mt-2">
            On save, the backend computes realized P&amp;L immediately: you bought 1 BTC at
            $60,000 (average cost = $60,000), then sold 0.5 BTC at $75,000.
            Realized P&amp;L = ($75,000 − $60,000) × 0.5 = <strong>$7,500</strong>.
          </p>
          <p>
            The P&amp;L value will appear in the <code>pnl</code> column for that SELL row.
          </p>
        </Step>

        <Step number={5} title="View P&L on the Dashboard">
          <p>
            Click <strong>Dashboard</strong> in the top navigation. The dashboard shows your total
            realized P&amp;L aggregated across all accounts, as well as your current open positions
            (quantity held per symbol).
          </p>
          <p>
            Your $7,500 gain from the BTC sale should appear in the summary. The remaining 0.5 BTC
            position is still open — it will appear in your holdings until you record another SELL.
          </p>
        </Step>
      </div>

      <div className="border border-base-300 rounded-lg p-5 bg-base-100">
        <h2 className="text-base font-semibold text-base-content mb-3">Next steps</h2>
        <ul className="space-y-2 text-sm text-base-content/70">
          <li>
            <Link to="/docs/concepts" className="text-primary hover:underline">Core Concepts</Link>
            {' '}— Understand the data model, entry types, and how valueBase works.
          </li>
          <li>
            <Link to="/docs/accounts" className="text-primary hover:underline">Accounts Guide</Link>
            {' '}— Create separate portfolios for different strategies or tax treatments.
          </li>
          <li>
            <Link to="/docs/pnl" className="text-primary hover:underline">P&amp;L Calculation</Link>
            {' '}— A detailed walkthrough of the average cost method with worked examples.
          </li>
          <li>
            <Link to="/docs/api/ledger" className="text-primary hover:underline">Ledger API</Link>
            {' '}— Bulk-import trades programmatically via the batch endpoint.
          </li>
        </ul>
      </div>
    </div>
  );
}
