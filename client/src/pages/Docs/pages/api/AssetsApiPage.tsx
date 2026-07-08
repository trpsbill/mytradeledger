import { ApiEndpoint } from '../../components/ApiEndpoint';
import { Callout } from '../../components/Callout';

const BASE = `${window.location.origin}/api`;

export function AssetsApiPage() {
  return (
    <div>
      <h1 className="text-3xl font-bold text-base-content mb-3">Assets API</h1>

      <Callout type="warning">
        The asset registry is <strong>legacy</strong>. In the current version of MyTradeLedger,
        symbols are plain free-form strings on ledger entries — no registered asset is required.
        These endpoints remain available for backward compatibility but are not required for normal
        operation. New integrations should not rely on them.
      </Callout>

      <p className="text-base-content/70 text-lg leading-relaxed mt-6 mb-6">
        The asset registry originally held metadata about tradeable symbols (name, decimal
        precision). It is no longer a prerequisite for creating ledger entries.
      </p>

      <div className="mt-8 space-y-1">
        <ApiEndpoint
          method="GET"
          path={`${BASE}/assets`}
          auth={false}
          description="List all registered assets. This endpoint does not require authentication."
          response={`{
  "data": [
    {
      "id":        "asset-uuid-1",
      "symbol":    "BTC",
      "name":      "Bitcoin",
      "precision": 8,
      "createdAt": "2025-01-01T00:00:00.000Z"
    },
    {
      "id":        "asset-uuid-2",
      "symbol":    "ETH",
      "name":      "Ethereum",
      "precision": 18,
      "createdAt": "2025-01-01T00:00:00.000Z"
    }
  ]
}`}
          curl={`curl ${BASE}/assets`}
        />

        <ApiEndpoint
          method="POST"
          path={`${BASE}/assets`}
          description="Register a new asset in the registry. Requires authentication."
          requestBody={`{
  "symbol":    "SOL",       // required, must be unique
  "name":      "Solana",    // required
  "precision": 9            // required, decimal places
}`}
          response={`{
  "data": {
    "id":        "asset-uuid-new",
    "symbol":    "SOL",
    "name":      "Solana",
    "precision": 9,
    "createdAt": "2026-06-03T12:00:00.000Z"
  }
}`}
          curl={`curl -X POST \\
  -H "Authorization: Bearer $TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{"symbol":"SOL","name":"Solana","precision":9}' \\
  ${BASE}/assets`}
        />

        <ApiEndpoint
          method="GET"
          path={`${BASE}/assets/:id`}
          description="Retrieve a single registered asset by its UUID."
          pathParams={[
            { name: 'id', type: 'string (UUID)', required: true, description: 'Asset ID.' },
          ]}
          response={`{
  "data": {
    "id":        "asset-uuid-1",
    "symbol":    "BTC",
    "name":      "Bitcoin",
    "precision": 8,
    "createdAt": "2025-01-01T00:00:00.000Z"
  }
}`}
          curl={`curl -H "Authorization: Bearer $TOKEN" \\
  ${BASE}/assets/asset-uuid-1`}
        />

        <ApiEndpoint
          method="PATCH"
          path={`${BASE}/assets/:id`}
          description="Update a registered asset's name or precision. The symbol cannot be changed."
          pathParams={[
            { name: 'id', type: 'string (UUID)', required: true, description: 'Asset ID.' },
          ]}
          requestBody={`{
  "name":      "Bitcoin (Updated)",  // optional
  "precision": 8                     // optional
}`}
          response={`{ "data": { "id": "asset-uuid-1", "name": "Bitcoin (Updated)", ... } }`}
          curl={`curl -X PATCH \\
  -H "Authorization: Bearer $TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{"name":"Bitcoin (Updated)"}' \\
  ${BASE}/assets/asset-uuid-1`}
        />

        <ApiEndpoint
          method="DELETE"
          path={`${BASE}/assets/:id`}
          description="Remove an asset from the registry. Deleting an asset does not affect any ledger entries that reference its symbol string."
          pathParams={[
            { name: 'id', type: 'string (UUID)', required: true, description: 'Asset ID.' },
          ]}
          response={`{ "data": { "deleted": true } }`}
          curl={`curl -X DELETE \\
  -H "Authorization: Bearer $TOKEN" \\
  ${BASE}/assets/asset-uuid-1`}
        />
      </div>
    </div>
  );
}
