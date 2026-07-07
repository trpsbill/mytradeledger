import { Callout } from '../components/Callout';

export function MetadataPage() {
  return (
    <div>
      <h1 className="text-3xl font-bold text-base-content mb-3">Entry Metadata</h1>
      <p className="text-base-content/70 text-lg leading-relaxed mb-8">
        Metadata lets you attach arbitrary key-value pairs to any ledger entry. Use it to store
        information that doesn't fit the standard entry fields — without changing the core schema.
      </p>

      <section className="mb-10">
        <h2 className="text-xl font-semibold text-base-content mb-4 pb-2 border-b border-base-300">
          What Metadata Is
        </h2>
        <p className="text-base-content/70 mb-4">
          Each <code className="text-xs bg-base-200 px-1 rounded">LedgerMetadata</code> record is
          a simple key-value pair linked to a specific ledger entry. Both key and value are strings.
          A single entry can have multiple metadata records (one per key).
        </p>
        <div className="bg-base-200 rounded-lg p-4 font-mono text-xs text-base-content/80 mb-4">
          <p className="text-base-content/40 mb-2">// Example metadata on a single entry</p>
          <p>{`{ "key": "orderId",   "value": "ORD-20260603-8821" }`}</p>
          <p>{`{ "key": "taxLot",    "value": "LOT-2026-A" }`}</p>
          <p>{`{ "key": "broker",    "value": "Coinbase Advanced" }`}</p>
          <p>{`{ "key": "strategy",  "value": "momentum" }`}</p>
        </div>
      </section>

      <section className="mb-10">
        <h2 className="text-xl font-semibold text-base-content mb-4 pb-2 border-b border-base-300">
          Common Use Cases
        </h2>
        <div className="grid gap-4 sm:grid-cols-2">
          {[
            {
              title: 'Exchange Order IDs',
              desc: 'Link each trade to the exchange order that generated it. Useful when reconciling against exchange trade history.',
              key: 'orderId',
              value: 'ORD-20260603-8821',
            },
            {
              title: 'Tax Lot References',
              desc: 'Tag entries with your tax lot IDs for specific-identification accounting. Reference these when preparing Schedule D.',
              key: 'taxLot',
              value: 'LOT-2026-A',
            },
            {
              title: 'Broker Notes',
              desc: 'Record the broker or venue where the trade was executed, especially useful in multi-broker setups.',
              key: 'venue',
              value: 'Coinbase Pro',
            },
            {
              title: 'Custom Tags',
              desc: 'Categorize trades with arbitrary tags — strategy name, analyst, trade thesis, or any workflow label.',
              key: 'strategy',
              value: 'breakout',
            },
          ].map((uc) => (
            <div key={uc.title} className="border border-base-300 rounded-lg p-4 bg-base-100">
              <h3 className="font-semibold text-base-content mb-1">{uc.title}</h3>
              <p className="text-sm text-base-content/60 mb-2">{uc.desc}</p>
              <code className="text-xs bg-base-200 px-2 py-1 rounded block">
                {uc.key}: {uc.value}
              </code>
            </div>
          ))}
        </div>
      </section>

      <section className="mb-10">
        <h2 className="text-xl font-semibold text-base-content mb-4 pb-2 border-b border-base-300">
          Managing Metadata via API
        </h2>
        <p className="text-base-content/70 mb-4">
          Metadata is only accessible through the API — there is no UI for it in the current version.
        </p>

        <div className="space-y-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-base-content/40 mb-2">
              List metadata for an entry
            </p>
            <pre className="bg-neutral text-neutral-content rounded-md p-3 text-xs font-mono overflow-x-auto">{`curl -H "Authorization: Bearer $TOKEN" \\
  http://localhost:3000/api/ledger/{entryId}/metadata`}</pre>
            <pre className="bg-base-200 rounded-md p-3 text-xs font-mono mt-2 overflow-x-auto">{`{
  "data": [
    { "id": "meta-uuid-1", "key": "orderId", "value": "ORD-8821" },
    { "id": "meta-uuid-2", "key": "taxLot",  "value": "LOT-A" }
  ]
}`}</pre>
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-base-content/40 mb-2">
              Add a metadata key-value pair
            </p>
            <pre className="bg-neutral text-neutral-content rounded-md p-3 text-xs font-mono overflow-x-auto">{`curl -X POST \\
  -H "Authorization: Bearer $TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{"key": "orderId", "value": "ORD-8821"}' \\
  http://localhost:3000/api/ledger/{entryId}/metadata`}</pre>
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-base-content/40 mb-2">
              Delete a specific metadata record
            </p>
            <pre className="bg-neutral text-neutral-content rounded-md p-3 text-xs font-mono overflow-x-auto">{`curl -X DELETE \\
  -H "Authorization: Bearer $TOKEN" \\
  http://localhost:3000/api/ledger/{entryId}/metadata/{metadataId}`}</pre>
          </div>
        </div>
      </section>

      <section className="mb-10">
        <h2 className="text-xl font-semibold text-base-content mb-4 pb-2 border-b border-base-300">
          Limitations
        </h2>
        <div className="space-y-3">
          <div className="flex gap-3">
            <div className="mt-1 w-2 h-2 rounded-full bg-warning shrink-0"></div>
            <p className="text-sm text-base-content/70">
              <strong>No CSV export:</strong> Metadata is not included in the CSV export. It is
              only accessible via the API.
            </p>
          </div>
          <div className="flex gap-3">
            <div className="mt-1 w-2 h-2 rounded-full bg-warning shrink-0"></div>
            <p className="text-sm text-base-content/70">
              <strong>No duplicate key enforcement:</strong> The API does not prevent you from
              adding two records with the same key to a single entry. If you need key uniqueness,
              delete the old record before adding a new one.
            </p>
          </div>
          <div className="flex gap-3">
            <div className="mt-1 w-2 h-2 rounded-full bg-warning shrink-0"></div>
            <p className="text-sm text-base-content/70">
              <strong>No bulk update:</strong> Each metadata record must be added or deleted
              individually. There is no batch metadata endpoint.
            </p>
          </div>
        </div>
        <Callout type="info">
          Metadata is scoped to the entry that owns it. Deleting a ledger entry also deletes all
          its associated metadata records.
        </Callout>
      </section>
    </div>
  );
}
