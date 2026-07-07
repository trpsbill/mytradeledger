import { useState } from 'react';

type Tab = 'guide' | 'api';

const METHOD_COLORS: Record<string, string> = {
  GET:    'badge-info',
  POST:   'badge-success',
  PATCH:  'badge-warning',
  DELETE: 'badge-error',
};

function Method({ verb }: { verb: string }) {
  return (
    <span className={`badge badge-sm font-mono font-bold ${METHOD_COLORS[verb] ?? 'badge-ghost'}`}>
      {verb}
    </span>
  );
}

function Endpoint({
  method, path, auth = true, description, request, response,
}: {
  method: string;
  path: string;
  auth?: boolean;
  description: string;
  request?: string;
  response?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border border-base-300 rounded-lg overflow-hidden mb-3">
      <button
        className="w-full flex items-center gap-3 px-4 py-3 bg-base-100 hover:bg-base-200 text-left"
        onClick={() => setOpen(o => !o)}
      >
        <Method verb={method} />
        <code className="text-sm font-mono flex-1">{path}</code>
        {!auth && <span className="badge badge-ghost badge-sm">no auth</span>}
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className={`h-4 w-4 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && (
        <div className="px-4 pb-4 bg-base-100 border-t border-base-300 space-y-3 pt-3">
          <p className="text-sm text-base-content/80">{description}</p>
          {request && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-base-content/50 mb-1">Request body</p>
              <pre className="bg-base-200 rounded p-3 text-xs overflow-x-auto">{request}</pre>
            </div>
          )}
          {response && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-base-content/50 mb-1">Response</p>
              <pre className="bg-base-200 rounded p-3 text-xs overflow-x-auto">{response}</pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-8">
      <h2 className="text-lg font-bold mb-4 pb-2 border-b border-base-300">{title}</h2>
      {children}
    </section>
  );
}

function UserGuide() {
  return (
    <div className="prose prose-sm max-w-none">
      <Section title="Overview">
        <p className="text-base-content/80 mb-3">
          MyTradeLedger is a personal trade tracking app for recording buys and sells across any
          asset class. It calculates realized P&amp;L automatically using the{' '}
          <strong>average cost method</strong>.
        </p>
        <p className="text-base-content/80">
          Everything is organized into <strong>Accounts</strong> (portfolios) containing{' '}
          <strong>Ledger Entries</strong> (individual trade events).
        </p>
      </Section>

      <Section title="Accounts">
        <p className="text-base-content/80 mb-3">
          An account is a logical portfolio container — for example "Main Portfolio", "Crypto", or
          "Roth IRA". Each account has a <strong>base currency</strong> (default USD) used for P&amp;L
          reporting.
        </p>
        <ul className="list-disc list-inside space-y-1 text-base-content/80 text-sm">
          <li>Create accounts from the <strong>Accounts</strong> page.</li>
          <li>Accounts can be <strong>archived</strong> to hide them without losing data.</li>
          <li>A <strong>Default</strong> account is auto-created when you add your first ledger entry.</li>
          <li>Deleting an account permanently deletes all its ledger entries.</li>
        </ul>
      </Section>

      <Section title="Ledger Entries">
        <p className="text-base-content/80 mb-3">
          Each row in the ledger represents a single trade event. Supported entry types:
        </p>
        <div className="overflow-x-auto mb-4">
          <table className="table table-sm w-full">
            <thead>
              <tr>
                <th>Type</th>
                <th>Description</th>
              </tr>
            </thead>
            <tbody>
              <tr><td><code>BUY</code></td><td>Purchase of an asset. Increases your position.</td></tr>
              <tr><td><code>SELL</code></td><td>Sale of an asset. Decreases your position and triggers P&amp;L calculation.</td></tr>
              <tr><td><code>FEE</code></td><td>Standalone fee not attached to a trade.</td></tr>
              <tr><td><code>DEPOSIT</code></td><td>Cash deposited into the account.</td></tr>
              <tr><td><code>WITHDRAWAL</code></td><td>Cash withdrawn from the account.</td></tr>
              <tr><td><code>ADJUSTMENT</code></td><td>Manual correction or adjustment entry.</td></tr>
            </tbody>
          </table>
        </div>
        <div className="alert alert-info text-sm">
          <span>The UI currently exposes BUY and SELL. All types are available via the API.</span>
        </div>
      </Section>

      <Section title="P&L Calculation">
        <p className="text-base-content/80 mb-3">
          Realized P&amp;L is computed automatically on every <code>SELL</code> entry using the{' '}
          <strong>average cost method</strong>:
        </p>
        <div className="bg-base-200 rounded-lg p-4 font-mono text-sm mb-3">
          <p>avg_cost = total_cost_of_position / total_quantity_held</p>
          <p>realized_pnl = (sell_price − avg_cost) × sell_quantity</p>
        </div>
        <ul className="list-disc list-inside space-y-1 text-base-content/80 text-sm">
          <li><code>valueBase</code> is auto-calculated: negative for BUY (cash out), positive for SELL (cash in).</li>
          <li>Use <strong>Recalculate P&amp;L</strong> (<code>POST /api/ledger/recalculate-pnl</code>) if you edit historical entries.</li>
          <li>P&amp;L is per-account and per-symbol.</li>
        </ul>
      </Section>

      <Section title="CSV Export">
        <p className="text-base-content/80">
          Export your full ledger (or a filtered subset) as a CSV file via{' '}
          <code>GET /api/ledger/export/csv</code>. Supports the same{' '}
          <code>symbol</code>, <code>entryType</code>, <code>startDate</code>, and{' '}
          <code>endDate</code> query parameters as the ledger list endpoint.
        </p>
      </Section>

      <Section title="Metadata">
        <p className="text-base-content/80">
          Arbitrary key-value pairs can be attached to any ledger entry via the metadata API.
          Useful for storing exchange order IDs, notes, tax lot references, or any custom data
          without modifying the core schema.
        </p>
      </Section>
    </div>
  );
}

function ApiReference() {
  const base = '/api';
  return (
    <div>
      <div className="alert alert-ghost border border-base-300 mb-6 text-sm">
        <div>
          <p className="font-semibold mb-1">Base URL: <code>{window.location.origin}{base}</code></p>
          <p className="text-base-content/70">
            All endpoints except <code>/auth/register</code> and <code>/auth/login</code> require an{' '}
            <code>Authorization: Bearer &lt;token&gt;</code> header.
          </p>
        </div>
      </div>

      <Section title="Authentication">
        <Endpoint
          method="POST" path={`${base}/auth/register`} auth={false}
          description="Create a new user account. Returns a JWT token valid for 30 days."
          request={`{
  "email": "you@example.com",
  "password": "minlength8",
  "marketingOptIn": false
}`}
          response={`{
  "data": {
    "token": "<jwt>",
    "user": { "id": "...", "email": "...", "isPaid": false }
  }
}`}
        />
        <Endpoint
          method="POST" path={`${base}/auth/login`} auth={false}
          description="Log in with email and password. Returns a fresh JWT token."
          request={`{
  "email": "you@example.com",
  "password": "yourpassword"
}`}
          response={`{
  "data": {
    "token": "<jwt>",
    "user": { "id": "...", "email": "...", "isPaid": false }
  }
}`}
        />
        <Endpoint
          method="GET" path={`${base}/auth/me`}
          description="Return the authenticated user's profile."
          response={`{
  "data": {
    "id": "...", "email": "...", "isPaid": false,
    "marketingOptIn": false, "createdAt": "..."
  }
}`}
        />
      </Section>

      <Section title="Accounts">
        <Endpoint
          method="GET" path={`${base}/accounts`}
          description="List all accounts for the authenticated user. Pass ?includeArchived=true to include archived accounts."
          response={`{ "data": [{ "id": "...", "name": "Default", "baseCurrency": "USD", ... }] }`}
        />
        <Endpoint
          method="POST" path={`${base}/accounts`}
          description="Create a new account."
          request={`{ "name": "My Portfolio", "baseCurrency": "USD" }`}
          response={`{ "data": { "id": "...", "name": "My Portfolio", ... } }`}
        />
        <Endpoint
          method="GET" path={`${base}/accounts/:id`}
          description="Get a single account by ID."
          response={`{ "data": { "id": "...", "name": "...", ... } }`}
        />
        <Endpoint
          method="PATCH" path={`${base}/accounts/:id`}
          description="Update an account's name or base currency."
          request={`{ "name": "New Name", "baseCurrency": "EUR" }`}
          response={`{ "data": { ... updated account ... } }`}
        />
        <Endpoint
          method="POST" path={`${base}/accounts/:id/archive`}
          description="Archive an account (hides it from default listing without deleting data)."
          response={`{ "data": { ... } }`}
        />
        <Endpoint
          method="POST" path={`${base}/accounts/:id/unarchive`}
          description="Restore a previously archived account."
          response={`{ "data": { ... } }`}
        />
        <Endpoint
          method="GET" path={`${base}/accounts/:id/balance`}
          description="Get the current position balances for an account — quantity held per symbol."
          response={`{ "data": { "BTC/USD": "1.5", "ETH/USD": "10.0" } }`}
        />
        <Endpoint
          method="GET" path={`${base}/accounts/:id/pnl`}
          description="Get the total realized P&L for an account."
          response={`{
  "data": {
    "accountId": "...",
    "baseCurrency": "USD",
    "totalPnL": "2450.00"
  }
}`}
        />
        <Endpoint
          method="DELETE" path={`${base}/accounts/:id`}
          description="Permanently delete an account and all its ledger entries. Irreversible."
        />
      </Section>

      <Section title="Ledger">
        <Endpoint
          method="GET" path={`${base}/ledger`}
          description="List ledger entries for the authenticated user. Supports filtering and pagination."
          request={`Query params:
  symbol      — filter by symbol (e.g. BTC/USD)
  entryType   — BUY | SELL | FEE | DEPOSIT | WITHDRAWAL | ADJUSTMENT
  startDate   — ISO 8601 date string
  endDate     — ISO 8601 date string
  limit       — default 100
  offset      — default 0`}
          response={`{
  "data": [ { "id": "...", "symbol": "BTC/USD", "entryType": "BUY", ... } ],
  "meta": { "total": 42, "limit": 100, "offset": 0 }
}`}
        />
        <Endpoint
          method="POST" path={`${base}/ledger`}
          description="Create a single ledger entry. A Default account is auto-created if none exists. valueBase is calculated automatically."
          request={`{
  "symbol":    "BTC/USD",       // required
  "entryType": "BUY",           // required: BUY | SELL
  "quantity":  0.5,             // required, positive number
  "price":     65000,           // required, positive number
  "fee":       9.99,            // optional
  "timestamp": "2026-01-15T...",// optional, defaults to now
  "notes":     "string",        // optional
  "accountId": "..."            // optional, uses Default if omitted
}`}
          response={`{ "data": { "id": "...", "valueBase": "-32500", "pnl": null, ... } }`}
        />
        <Endpoint
          method="POST" path={`${base}/ledger/batch`}
          description="Create multiple ledger entries in one request."
          request={`{ "entries": [ { ...same fields as single create... }, ... ] }`}
          response={`{ "data": { "count": 5 } }`}
        />
        <Endpoint
          method="GET" path={`${base}/ledger/:id`}
          description="Get a single ledger entry by ID."
          response={`{ "data": { "id": "...", ... } }`}
        />
        <Endpoint
          method="PATCH" path={`${base}/ledger/:id`}
          description="Update a ledger entry. Run recalculate-pnl afterwards if editing historical entries."
          request={`{
  "symbol":    "ETH/USD",
  "entryType": "SELL",
  "quantity":  1.0,
  "price":     3200,
  "fee":       null,
  "notes":     "string"
}`}
          response={`{ "data": { ... updated entry ... } }`}
        />
        <Endpoint
          method="DELETE" path={`${base}/ledger/:id`}
          description="Delete a single ledger entry."
        />
        <Endpoint
          method="POST" path={`${base}/ledger/recalculate-pnl`}
          description="Recompute realized P&L for all SELL entries belonging to the authenticated user. Run this after editing or importing historical entries."
          response={`{ "data": { "updated": 12 } }`}
        />
        <Endpoint
          method="GET" path={`${base}/ledger/export/csv`}
          description="Download ledger entries as a CSV file. Accepts the same query params as the list endpoint."
          response={`Content-Type: text/csv
Content-Disposition: attachment; filename="ledger-export-2026-06-03.csv"`}
        />
        <Endpoint
          method="DELETE" path={`${base}/ledger/all`}
          description="Delete ALL ledger entries for the authenticated user. Irreversible."
          response={`{ "data": { "deleted": 42 } }`}
        />
      </Section>

      <Section title="Ledger Metadata">
        <p className="text-sm text-base-content/70 mb-4">
          Attach arbitrary key-value pairs to any ledger entry — useful for order IDs, tax lot
          references, or custom annotations.
        </p>
        <Endpoint
          method="GET" path={`${base}/ledger/:id/metadata`}
          description="List all metadata attached to a ledger entry."
          response={`{ "data": [{ "id": "...", "key": "orderId", "value": "XYZ-123" }] }`}
        />
        <Endpoint
          method="POST" path={`${base}/ledger/:id/metadata`}
          description="Add a metadata key-value pair to a ledger entry."
          request={`{ "key": "orderId", "value": "XYZ-123" }`}
          response={`{ "data": { "id": "...", "key": "orderId", "value": "XYZ-123" } }`}
        />
        <Endpoint
          method="DELETE" path={`${base}/ledger/:id/metadata/:metadataId`}
          description="Remove a specific metadata entry by its ID."
        />
      </Section>

      <Section title="Assets (Legacy)">
        <p className="text-sm text-base-content/70 mb-4">
          The asset registry is largely legacy — symbols are now plain strings on ledger entries.
          These endpoints remain available for backward compatibility.
        </p>
        <Endpoint
          method="GET" path={`${base}/assets`} auth={false}
          description="List all registered assets."
          response={`{ "data": [{ "id": "...", "symbol": "BTC", "name": "Bitcoin", "precision": 8 }] }`}
        />
        <Endpoint
          method="POST" path={`${base}/assets`}
          description="Register a new asset."
          request={`{ "symbol": "BTC", "name": "Bitcoin", "precision": 8 }`}
          response={`{ "data": { "id": "...", "symbol": "BTC", ... } }`}
        />
        <Endpoint
          method="GET" path={`${base}/assets/:id`}
          description="Get a single asset by ID."
        />
        <Endpoint
          method="PATCH" path={`${base}/assets/:id`}
          description="Update an asset's name or precision."
          request={`{ "name": "Bitcoin", "precision": 8 }`}
        />
        <Endpoint
          method="DELETE" path={`${base}/assets/:id`}
          description="Delete an asset."
        />
      </Section>
    </div>
  );
}

export function DocsPage() {
  const [tab, setTab] = useState<Tab>('guide');

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Documentation</h1>
        <p className="text-base-content/60 text-sm mt-1">User guide and API reference for MyTradeLedger</p>
      </div>

      <div role="tablist" className="tabs tabs-bordered mb-6">
        <button
          role="tab"
          className={`tab ${tab === 'guide' ? 'tab-active' : ''}`}
          onClick={() => setTab('guide')}
        >
          User Guide
        </button>
        <button
          role="tab"
          className={`tab ${tab === 'api' ? 'tab-active' : ''}`}
          onClick={() => setTab('api')}
        >
          API Reference
        </button>
      </div>

      {tab === 'guide' ? <UserGuide /> : <ApiReference />}
    </div>
  );
}
