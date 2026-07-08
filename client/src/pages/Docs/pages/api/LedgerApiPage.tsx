import { ApiEndpoint } from '../../components/ApiEndpoint';
import { Callout } from '../../components/Callout';

const BASE = `${window.location.origin}/api`;

export function LedgerApiPage() {
  return (
    <div>
      <h1 className="text-3xl font-bold text-base-content mb-3">Ledger API</h1>
      <p className="text-base-content/70 text-lg leading-relaxed mb-6">
        The ledger endpoints are the core of the API. Use them to create, query, edit, and delete
        trade entries, bulk-import historical data, export to CSV, and manage entry metadata.
      </p>

      <Callout type="info">
        All endpoints require <code>Authorization: Bearer &lt;token&gt;</code> unless otherwise noted.
        Entries are always scoped to the authenticated user.
      </Callout>

      <div className="mt-8">
        <h2 className="text-lg font-semibold text-base-content mb-3 pb-2 border-b border-base-300">
          Entries
        </h2>
        <div className="space-y-1">
          <ApiEndpoint
            method="GET"
            path={`${BASE}/ledger`}
            description="List ledger entries for the authenticated user. Supports filtering by symbol, entry type, and date range, plus pagination."
            queryParams={[
              { name: 'symbol',    type: 'string',  required: false, description: 'Filter by symbol (case-sensitive). E.g. BTC/USD.' },
              { name: 'entryType', type: 'string',  required: false, description: 'Filter by entry type: BUY, SELL, FEE, DEPOSIT, WITHDRAWAL, or ADJUSTMENT.' },
              { name: 'startDate', type: 'ISO 8601',required: false, description: 'Include only entries on or after this date.' },
              { name: 'endDate',   type: 'ISO 8601',required: false, description: 'Include only entries on or before this date.' },
              { name: 'limit',     type: 'integer', required: false, description: 'Maximum number of results to return. Default 100.' },
              { name: 'offset',    type: 'integer', required: false, description: 'Number of results to skip. Default 0. Use with limit for pagination.' },
            ]}
            response={`{
  "data": [
    {
      "id":        "entry-uuid-1",
      "accountId": "acc-uuid-1",
      "symbol":    "BTC/USD",
      "entryType": "BUY",
      "quantity":  "1.0",
      "price":     "60000",
      "fee":       "9.99",
      "valueBase": "-60000",
      "pnl":       null,
      "timestamp": "2026-01-15T10:30:00.000Z",
      "notes":     "Initial purchase",
      "createdAt": "2026-01-15T10:31:00.000Z"
    }
  ],
  "meta": { "total": 42, "limit": 100, "offset": 0 }
}`}
            curl={`curl -H "Authorization: Bearer $TOKEN" \\
  "${BASE}/ledger?symbol=BTC%2FUSD&entryType=BUY&limit=10"`}
          />

          <ApiEndpoint
            method="POST"
            path={`${BASE}/ledger`}
            description="Create a single ledger entry. If accountId is omitted, the Default account is used (and created automatically if it doesn't exist). valueBase is computed server-side."
            requestBody={`{
  "symbol":    "BTC/USD",              // required
  "entryType": "BUY",                  // required: BUY | SELL | FEE | DEPOSIT | WITHDRAWAL | ADJUSTMENT
  "quantity":  1.0,                    // required, positive number
  "price":     60000,                  // required, positive number
  "fee":       9.99,                   // optional
  "timestamp": "2026-01-15T10:30:00Z", // optional, defaults to now
  "notes":     "Initial purchase",     // optional
  "accountId": "acc-uuid-1"            // optional, uses Default if omitted
}`}
            response={`{
  "data": {
    "id":        "entry-uuid-new",
    "accountId": "acc-uuid-1",
    "symbol":    "BTC/USD",
    "entryType": "BUY",
    "quantity":  "1.0",
    "price":     "60000",
    "fee":       "9.99",
    "valueBase": "-60000",
    "pnl":       null,
    "timestamp": "2026-01-15T10:30:00.000Z",
    "notes":     "Initial purchase",
    "createdAt": "2026-06-03T12:00:00.000Z"
  }
}`}
            curl={`curl -X POST \\
  -H "Authorization: Bearer $TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{
    "symbol": "BTC/USD",
    "entryType": "BUY",
    "quantity": 1.0,
    "price": 60000,
    "fee": 9.99
  }' \\
  ${BASE}/ledger`}
          />

          <ApiEndpoint
            method="POST"
            path={`${BASE}/ledger/batch`}
            description="Create multiple ledger entries in a single request. Useful for importing historical trades. All entries are created in one transaction. Run recalculate-pnl after importing back-dated entries."
            requestBody={`{
  "entries": [
    {
      "symbol":    "BTC/USD",
      "entryType": "BUY",
      "quantity":  1.0,
      "price":     40000,
      "timestamp": "2025-01-01T00:00:00Z"
    },
    {
      "symbol":    "ETH/USD",
      "entryType": "BUY",
      "quantity":  5.0,
      "price":     2500,
      "timestamp": "2025-02-01T00:00:00Z"
    }
  ]
}`}
            response={`{ "data": { "count": 2 } }`}
            curl={`curl -X POST \\
  -H "Authorization: Bearer $TOKEN" \\
  -H "Content-Type: application/json" \\
  -d @trades.json \\
  ${BASE}/ledger/batch`}
          />

          <ApiEndpoint
            method="GET"
            path={`${BASE}/ledger/:id`}
            description="Retrieve a single ledger entry by its UUID."
            pathParams={[
              { name: 'id', type: 'string (UUID)', required: true, description: 'Ledger entry ID.' },
            ]}
            response={`{ "data": { "id": "entry-uuid-1", "symbol": "BTC/USD", ... } }`}
            curl={`curl -H "Authorization: Bearer $TOKEN" \\
  ${BASE}/ledger/entry-uuid-1`}
          />

          <ApiEndpoint
            method="PATCH"
            path={`${BASE}/ledger/:id`}
            description="Update a ledger entry. Only provided fields are updated. If you edit price or quantity on a historical entry, run recalculate-pnl afterward."
            pathParams={[
              { name: 'id', type: 'string (UUID)', required: true, description: 'Ledger entry ID.' },
            ]}
            requestBody={`{
  "symbol":    "ETH/USD",  // optional
  "entryType": "SELL",     // optional
  "quantity":  1.0,        // optional
  "price":     3200,       // optional
  "fee":       null,       // optional, set to null to clear
  "notes":     "Updated"   // optional
}`}
            response={`{ "data": { "id": "entry-uuid-1", ...updatedFields } }`}
            curl={`curl -X PATCH \\
  -H "Authorization: Bearer $TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{"notes":"Tax lot A"}' \\
  ${BASE}/ledger/entry-uuid-1`}
          />

          <ApiEndpoint
            method="DELETE"
            path={`${BASE}/ledger/:id`}
            description="Permanently delete a single ledger entry. This action cannot be undone."
            pathParams={[
              { name: 'id', type: 'string (UUID)', required: true, description: 'Ledger entry ID.' },
            ]}
            response={`{ "data": { "deleted": true } }`}
            curl={`curl -X DELETE \\
  -H "Authorization: Bearer $TOKEN" \\
  ${BASE}/ledger/entry-uuid-1`}
          />
        </div>

        <h2 className="text-lg font-semibold text-base-content mt-8 mb-3 pb-2 border-b border-base-300">
          Bulk Operations
        </h2>
        <div className="space-y-1">
          <ApiEndpoint
            method="POST"
            path={`${BASE}/ledger/recalculate-pnl`}
            description="Recompute realized P&L for all SELL entries belonging to the authenticated user. Processes entries in chronological order per account per symbol. Run this after editing historical entries or after a batch import with back-dated entries."
            response={`{ "data": { "updated": 12 } }`}
            curl={`curl -X POST \\
  -H "Authorization: Bearer $TOKEN" \\
  ${BASE}/ledger/recalculate-pnl`}
          />

          <ApiEndpoint
            method="DELETE"
            path={`${BASE}/ledger/all`}
            description="Permanently delete ALL ledger entries for the authenticated user, across all accounts. The accounts themselves are not deleted. This action is irreversible."
            response={`{ "data": { "deleted": 42 } }`}
            curl={`curl -X DELETE \\
  -H "Authorization: Bearer $TOKEN" \\
  ${BASE}/ledger/all`}
          />
        </div>

        <h2 className="text-lg font-semibold text-base-content mt-8 mb-3 pb-2 border-b border-base-300">
          CSV Export
        </h2>
        <div className="space-y-1">
          <ApiEndpoint
            method="GET"
            path={`${BASE}/ledger/export/csv`}
            description="Download ledger entries as a CSV file. Accepts the same query parameters as the list endpoint (symbol, entryType, startDate, endDate). Does not support limit/offset — exports all matching entries."
            queryParams={[
              { name: 'symbol',    type: 'string',   required: false, description: 'Filter by symbol.' },
              { name: 'entryType', type: 'string',   required: false, description: 'Filter by entry type.' },
              { name: 'startDate', type: 'ISO 8601', required: false, description: 'Start of date range.' },
              { name: 'endDate',   type: 'ISO 8601', required: false, description: 'End of date range.' },
            ]}
            response={`Content-Type: text/csv
Content-Disposition: attachment; filename="ledger-export-2026-06-03.csv"

id,accountId,symbol,entryType,quantity,price,fee,valueBase,pnl,timestamp,notes,createdAt
entry-uuid-1,acc-uuid-1,BTC/USD,BUY,1.0,60000,9.99,-60000,,2026-01-15T10:30:00Z,...`}
            curl={`curl -H "Authorization: Bearer $TOKEN" \\
  "${BASE}/ledger/export/csv" \\
  -o ledger-full.csv`}
          />
        </div>

        <h2 className="text-lg font-semibold text-base-content mt-8 mb-3 pb-2 border-b border-base-300">
          Metadata
        </h2>
        <div className="space-y-1">
          <ApiEndpoint
            method="GET"
            path={`${BASE}/ledger/:id/metadata`}
            description="List all metadata key-value pairs attached to a ledger entry."
            pathParams={[
              { name: 'id', type: 'string (UUID)', required: true, description: 'Ledger entry ID.' },
            ]}
            response={`{
  "data": [
    { "id": "meta-uuid-1", "key": "orderId", "value": "ORD-8821", "entryId": "entry-uuid-1" },
    { "id": "meta-uuid-2", "key": "taxLot",  "value": "LOT-A",    "entryId": "entry-uuid-1" }
  ]
}`}
            curl={`curl -H "Authorization: Bearer $TOKEN" \\
  ${BASE}/ledger/entry-uuid-1/metadata`}
          />

          <ApiEndpoint
            method="POST"
            path={`${BASE}/ledger/:id/metadata`}
            description="Add a metadata key-value pair to a ledger entry. Multiple records with the same key are allowed."
            pathParams={[
              { name: 'id', type: 'string (UUID)', required: true, description: 'Ledger entry ID.' },
            ]}
            requestBody={`{
  "key":   "orderId",    // required
  "value": "ORD-8821"   // required
}`}
            response={`{
  "data": {
    "id":      "meta-uuid-new",
    "key":     "orderId",
    "value":   "ORD-8821",
    "entryId": "entry-uuid-1"
  }
}`}
            curl={`curl -X POST \\
  -H "Authorization: Bearer $TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{"key":"orderId","value":"ORD-8821"}' \\
  ${BASE}/ledger/entry-uuid-1/metadata`}
          />

          <ApiEndpoint
            method="DELETE"
            path={`${BASE}/ledger/:id/metadata/:metadataId`}
            description="Remove a specific metadata record by its ID."
            pathParams={[
              { name: 'id',         type: 'string (UUID)', required: true, description: 'Ledger entry ID.' },
              { name: 'metadataId', type: 'string (UUID)', required: true, description: 'Metadata record ID.' },
            ]}
            response={`{ "data": { "deleted": true } }`}
            curl={`curl -X DELETE \\
  -H "Authorization: Bearer $TOKEN" \\
  ${BASE}/ledger/entry-uuid-1/metadata/meta-uuid-1`}
          />
        </div>
      </div>
    </div>
  );
}
