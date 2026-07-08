import { ApiEndpoint } from '../../components/ApiEndpoint';
import { Callout } from '../../components/Callout';

const BASE = `${window.location.origin}/api`;

export function AccountsApiPage() {
  return (
    <div>
      <h1 className="text-3xl font-bold text-base-content mb-3">Accounts API</h1>
      <p className="text-base-content/70 text-lg leading-relaxed mb-6">
        Accounts are portfolio containers that group ledger entries together. P&amp;L and position
        data are calculated independently per account.
      </p>

      <Callout type="info">
        All endpoints on this page require an <code>Authorization: Bearer &lt;token&gt;</code> header.
        Each user can only access their own accounts.
      </Callout>

      <div className="mt-8 space-y-1">
        <ApiEndpoint
          method="GET"
          path={`${BASE}/accounts`}
          description="List all accounts for the authenticated user. Archived accounts are excluded by default."
          queryParams={[
            {
              name: 'includeArchived',
              type: 'boolean',
              required: false,
              description: 'Pass true to include archived accounts in the response.',
            },
          ]}
          response={`{
  "data": [
    {
      "id":           "acc-uuid-1",
      "name":         "Default",
      "baseCurrency": "USD",
      "isArchived":   false,
      "createdAt":    "2026-01-01T00:00:00.000Z"
    }
  ]
}`}
          curl={`curl -H "Authorization: Bearer $TOKEN" \\
  ${BASE}/accounts`}
        />

        <ApiEndpoint
          method="POST"
          path={`${BASE}/accounts`}
          description="Create a new account. The base currency is used for P&L reporting."
          requestBody={`{
  "name":         "Roth IRA",  // required
  "baseCurrency": "USD"        // optional, defaults to USD
}`}
          response={`{
  "data": {
    "id":           "acc-uuid-new",
    "name":         "Roth IRA",
    "baseCurrency": "USD",
    "isArchived":   false,
    "createdAt":    "2026-06-03T12:00:00.000Z"
  }
}`}
          curl={`curl -X POST \\
  -H "Authorization: Bearer $TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{"name":"Roth IRA","baseCurrency":"USD"}' \\
  ${BASE}/accounts`}
        />

        <ApiEndpoint
          method="GET"
          path={`${BASE}/accounts/:id`}
          description="Retrieve a single account by its UUID."
          pathParams={[
            { name: 'id', type: 'string (UUID)', required: true, description: 'Account ID.' },
          ]}
          response={`{
  "data": {
    "id":           "acc-uuid-1",
    "name":         "Default",
    "baseCurrency": "USD",
    "isArchived":   false,
    "createdAt":    "2026-01-01T00:00:00.000Z"
  }
}`}
          curl={`curl -H "Authorization: Bearer $TOKEN" \\
  ${BASE}/accounts/acc-uuid-1`}
        />

        <ApiEndpoint
          method="PATCH"
          path={`${BASE}/accounts/:id`}
          description="Update an account's name or base currency. Only provided fields are updated."
          pathParams={[
            { name: 'id', type: 'string (UUID)', required: true, description: 'Account ID.' },
          ]}
          requestBody={`{
  "name":         "My Portfolio",  // optional
  "baseCurrency": "EUR"            // optional
}`}
          response={`{
  "data": {
    "id":           "acc-uuid-1",
    "name":         "My Portfolio",
    "baseCurrency": "EUR",
    "isArchived":   false,
    "createdAt":    "2026-01-01T00:00:00.000Z"
  }
}`}
          curl={`curl -X PATCH \\
  -H "Authorization: Bearer $TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{"name":"My Portfolio"}' \\
  ${BASE}/accounts/acc-uuid-1`}
        />

        <ApiEndpoint
          method="POST"
          path={`${BASE}/accounts/:id/archive`}
          description="Archive an account. It will be hidden from the default listing but all data is preserved. Can be reversed with unarchive."
          pathParams={[
            { name: 'id', type: 'string (UUID)', required: true, description: 'Account ID.' },
          ]}
          response={`{ "data": { "id": "acc-uuid-1", "isArchived": true, ... } }`}
          curl={`curl -X POST \\
  -H "Authorization: Bearer $TOKEN" \\
  ${BASE}/accounts/acc-uuid-1/archive`}
        />

        <ApiEndpoint
          method="POST"
          path={`${BASE}/accounts/:id/unarchive`}
          description="Restore a previously archived account. It will appear again in the default account listing."
          pathParams={[
            { name: 'id', type: 'string (UUID)', required: true, description: 'Account ID.' },
          ]}
          response={`{ "data": { "id": "acc-uuid-1", "isArchived": false, ... } }`}
          curl={`curl -X POST \\
  -H "Authorization: Bearer $TOKEN" \\
  ${BASE}/accounts/acc-uuid-1/unarchive`}
        />

        <ApiEndpoint
          method="GET"
          path={`${BASE}/accounts/:id/balance`}
          description="Get the current open position balances for an account — the net quantity held per symbol, derived from all BUY and SELL entries."
          pathParams={[
            { name: 'id', type: 'string (UUID)', required: true, description: 'Account ID.' },
          ]}
          response={`{
  "data": {
    "BTC/USD": "0.5",
    "ETH/USD": "10.0",
    "AAPL":    "25.0"
  }
}`}
          curl={`curl -H "Authorization: Bearer $TOKEN" \\
  ${BASE}/accounts/acc-uuid-1/balance`}
        />

        <ApiEndpoint
          method="GET"
          path={`${BASE}/accounts/:id/pnl`}
          description="Get the total realized P&L for an account, aggregated across all SELL entries."
          pathParams={[
            { name: 'id', type: 'string (UUID)', required: true, description: 'Account ID.' },
          ]}
          response={`{
  "data": {
    "accountId":    "acc-uuid-1",
    "baseCurrency": "USD",
    "totalPnL":     "12450.00"
  }
}`}
          curl={`curl -H "Authorization: Bearer $TOKEN" \\
  ${BASE}/accounts/acc-uuid-1/pnl`}
        />

        <ApiEndpoint
          method="DELETE"
          path={`${BASE}/accounts/:id`}
          description="Permanently delete an account and ALL its ledger entries. This action is irreversible. Archived accounts can be deleted as well."
          pathParams={[
            { name: 'id', type: 'string (UUID)', required: true, description: 'Account ID.' },
          ]}
          response={`{ "data": { "deleted": true } }`}
          curl={`curl -X DELETE \\
  -H "Authorization: Bearer $TOKEN" \\
  ${BASE}/accounts/acc-uuid-1`}
        />
      </div>
    </div>
  );
}
