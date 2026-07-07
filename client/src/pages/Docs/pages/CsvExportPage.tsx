import { Callout } from '../components/Callout';

export function CsvExportPage() {
  return (
    <div>
      <h1 className="text-3xl font-bold text-base-content mb-3">CSV Export</h1>
      <p className="text-base-content/70 text-lg leading-relaxed mb-8">
        Download your entire ledger — or a filtered slice — as a CSV file for use in spreadsheets,
        tax preparation software, or any external tool.
      </p>

      <section className="mb-10">
        <h2 className="text-xl font-semibold text-base-content mb-4 pb-2 border-b border-base-300">
          Endpoint
        </h2>
        <div className="flex items-center gap-3 bg-base-200 rounded-lg p-4 mb-4">
          <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-blue-100 text-blue-700">GET</span>
          <code className="text-sm font-mono text-base-content">/api/ledger/export/csv</code>
        </div>
        <p className="text-base-content/70 text-sm">
          The response has <code className="text-xs bg-base-200 px-1 rounded">Content-Type: text/csv</code>{' '}
          and a <code className="text-xs bg-base-200 px-1 rounded">Content-Disposition</code> header
          that triggers a browser download with a filename like{' '}
          <code className="text-xs bg-base-200 px-1 rounded">ledger-export-2026-06-03.csv</code>.
        </p>
      </section>

      <section className="mb-10">
        <h2 className="text-xl font-semibold text-base-content mb-4 pb-2 border-b border-base-300">
          Available Filters
        </h2>
        <p className="text-base-content/70 mb-4">
          The export endpoint accepts the same query parameters as the ledger list endpoint. All
          filters are optional — omitting them exports the full ledger.
        </p>
        <div className="overflow-x-auto">
          <table className="table table-sm w-full">
            <thead>
              <tr>
                <th>Parameter</th>
                <th>Type</th>
                <th>Description</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td><code className="text-xs font-mono">symbol</code></td>
                <td className="text-xs text-base-content/60 font-mono">string</td>
                <td className="text-sm text-base-content/70">Export only entries matching this symbol. Case-sensitive.</td>
              </tr>
              <tr>
                <td><code className="text-xs font-mono">entryType</code></td>
                <td className="text-xs text-base-content/60 font-mono">string</td>
                <td className="text-sm text-base-content/70">Filter by entry type: <code className="text-xs bg-base-200 px-1 rounded">BUY</code>, <code className="text-xs bg-base-200 px-1 rounded">SELL</code>, etc.</td>
              </tr>
              <tr>
                <td><code className="text-xs font-mono">startDate</code></td>
                <td className="text-xs text-base-content/60 font-mono">ISO 8601</td>
                <td className="text-sm text-base-content/70">Include only entries on or after this date.</td>
              </tr>
              <tr>
                <td><code className="text-xs font-mono">endDate</code></td>
                <td className="text-xs text-base-content/60 font-mono">ISO 8601</td>
                <td className="text-sm text-base-content/70">Include only entries on or before this date.</td>
              </tr>
            </tbody>
          </table>
        </div>
        <Callout type="info">
          Date values must be ISO 8601 format, e.g.{' '}
          <code>2026-01-01T00:00:00Z</code> or simply <code>2026-01-01</code>. The server parses
          both full datetime strings and date-only values.
        </Callout>
      </section>

      <section className="mb-10">
        <h2 className="text-xl font-semibold text-base-content mb-4 pb-2 border-b border-base-300">
          CSV Columns
        </h2>
        <p className="text-base-content/70 mb-4">
          The exported file contains one row per ledger entry with the following columns:
        </p>
        <div className="overflow-x-auto">
          <table className="table table-sm w-full">
            <thead>
              <tr>
                <th>Column</th>
                <th>Description</th>
              </tr>
            </thead>
            <tbody>
              {[
                { col: 'id', desc: 'Unique entry UUID' },
                { col: 'accountId', desc: 'UUID of the account this entry belongs to' },
                { col: 'symbol', desc: 'The traded symbol string' },
                { col: 'entryType', desc: 'BUY, SELL, FEE, DEPOSIT, WITHDRAWAL, or ADJUSTMENT' },
                { col: 'quantity', desc: 'Signed quantity (positive = BUY, negative = SELL)' },
                { col: 'price', desc: 'Price per unit in the account base currency' },
                { col: 'fee', desc: 'Commission or fee (empty if not set)' },
                { col: 'valueBase', desc: 'Computed cash value (negative for BUY, positive for SELL)' },
                { col: 'pnl', desc: 'Realized P&L (SELL entries only, otherwise empty)' },
                { col: 'timestamp', desc: 'ISO 8601 datetime of the trade' },
                { col: 'notes', desc: 'Free-text notes (empty if not set)' },
                { col: 'createdAt', desc: 'ISO 8601 datetime when the record was created' },
              ].map((r) => (
                <tr key={r.col}>
                  <td><code className="text-xs font-mono">{r.col}</code></td>
                  <td className="text-sm text-base-content/70">{r.desc}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Callout type="warning">
          Ledger metadata (key-value pairs) is not included in the CSV export. Metadata is
          accessible only via the API (<code>GET /api/ledger/:id/metadata</code>).
        </Callout>
      </section>

      <section className="mb-10">
        <h2 className="text-xl font-semibold text-base-content mb-4 pb-2 border-b border-base-300">
          Example — Full Export
        </h2>
        <pre className="bg-neutral text-neutral-content rounded-md p-4 text-xs overflow-x-auto font-mono leading-relaxed">{`curl -H "Authorization: Bearer $TOKEN" \\
  "https://mytradeledger.home.arpa/api/ledger/export/csv" \\
  -o ledger-full.csv`}</pre>
      </section>

      <section className="mb-10">
        <h2 className="text-xl font-semibold text-base-content mb-4 pb-2 border-b border-base-300">
          Example — Filtered by Symbol and Year
        </h2>
        <pre className="bg-neutral text-neutral-content rounded-md p-4 text-xs overflow-x-auto font-mono leading-relaxed">{`curl -H "Authorization: Bearer $TOKEN" \\
  "https://mytradeledger.home.arpa/api/ledger/export/csv?symbol=BTC%2FUSD&startDate=2025-01-01&endDate=2025-12-31" \\
  -o btc-2025.csv`}</pre>
        <p className="text-xs text-base-content/50 mt-2">
          Note: URL-encode the slash in symbols — <code>BTC/USD</code> becomes <code>BTC%2FUSD</code>.
        </p>
      </section>
    </div>
  );
}
