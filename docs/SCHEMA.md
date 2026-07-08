# MyTradeLedger — Database Schema

The full source of truth is `server/prisma/schema.prisma`. This is a human-readable summary.

## Design Intent

The database records what actually happened, in the order it happened, and lets P&L be derived transparently from that record. Think **accounting ledger**, not analytics system — rows are facts, totals are math over those facts, nothing is scored or inferred beyond P&L.

---

## Core Entities

### User

An account holder. Email/password auth — no email verification or password-reset flow, since this
is a self-hosted, typically single-user instance with no email server assumed.

| Field | Type | Description |
|-------|------|-------------|
| `id` | UUID | Unique identifier |
| `email` | String | Unique, case-normalized to lowercase |
| `passwordHash` | String | bcrypt hash |
| `createdAt` | DateTime | Creation timestamp |

Related: `accounts`, `personalAccessTokens`.

### PersonalAccessToken

A long-lived API token a user can generate for scripting against the API without their session JWT.

| Field | Type | Description |
|-------|------|-------------|
| `id` | UUID | Unique identifier |
| `userId` | UUID | Owning user |
| `name` | String | User-chosen label |
| `tokenHash` | String | SHA-256 hash (the raw token is only ever shown once, at creation) |
| `tokenPrefix` / `lastFourChars` | String | Displayed in the UI so a token can be identified without the raw value |
| `expiresAt` | DateTime? | Optional expiry |
| `lastUsedAt` | DateTime? | Updated on each use |

### Account

A logical trading account or portfolio. A "Default" account is auto-created on first ledger entry. `isDemo` marks the optional seeded "Demo Portfolio" sample-data account (see `POST /api/accounts/demo`) — a real account like any other, just excluded from onboarding empty-state logic.

| Field | Type | Description |
|-------|------|-------------|
| `id` | UUID | Unique identifier |
| `userId` | UUID | Owning user |
| `name` | String | User-defined label (e.g. "Default", "Coinbase") |
| `baseCurrency` | String | Currency used for P&L calculations (default: USD) |
| `isDemo` | Boolean | True for the seeded sample-data account |
| `isDefault` | Boolean | True for the account used when no `accountId` is given |
| `archivedAt` | DateTime? | Archive timestamp (nullable) |

No balances are stored here — everything is derived from ledger entries.

### LedgerEntry (Core Table)

Each row represents a single financial event. A BUY and a later SELL are never paired at the data level — chronology and average-cost math are the only linking mechanism.

| Field | Type | Description |
|-------|------|-------------|
| `id` | UUID | Unique identifier |
| `accountId` | UUID | Foreign key to Account |
| `timestamp` | DateTime | When the event occurred |
| `entryType` | Enum | `BUY \| SELL \| FEE \| DEPOSIT \| WITHDRAWAL \| ADJUSTMENT` (UI currently exposes BUY/SELL) |
| `symbol` | String | Trading pair symbol (e.g. "BTC/USD") |
| `quantity` | Decimal(24,12) | Signed: positive for BUY, negative for SELL |
| `price` | Decimal(24,12) | Price per unit |
| `fee` | Decimal(24,12)? | Trading fee amount |
| `valueBase` | Decimal(24,12) | Total value in base currency, auto-calculated (negative for BUY, positive for SELL) |
| `pnl` | Decimal(24,12)? | Realized gross P&L for SELL entries, average-cost method |
| `netPnl` | Decimal(24,12)? | Realized P&L with fees folded into cost basis |
| `pnlStatus` | String? | Null normally; `"PNL_UNCOMPUTABLE"` when no prior BUY exists to cost the sale against |
| `notes` | String? | User annotation |

#### Auto-calculated fields

- `valueBase` = `quantity × price` (sign per entry type)
- `pnl` / `netPnl`: for SELL entries only, using average cost = (sum of BUY costs for the symbol) / (total quantity bought)

### LedgerMetadata

Flexible key-value extension for ledger entries (e.g. exchange name, import batch ID, strategy tag).

| Field | Type | Description |
|-------|------|-------------|
| `id` | UUID | Unique identifier |
| `ledgerEntryId` | UUID | Foreign key to LedgerEntry |
| `key` / `value` | String | Arbitrary key-value pair |

### Asset (legacy)

Kept for backward compatibility; trading pairs are stored directly as a `symbol` string on `LedgerEntry`, so this table is largely unused in the current model.

---

## Derived Concepts (queries, not stored)

- **Current balance**: SUM of `quantity` grouped by symbol
- **Total P&L**: SUM of `pnl` / `netPnl` for an account's SELL entries
- **Open exposure**: derived from average cost × remaining quantity per symbol

---

## Multi-Account, Multi-User

- Every `Account` belongs to exactly one `User`; every `LedgerEntry` belongs to exactly one `Account`
- Accounts are fully isolated — cross-account aggregation is a UI/query concern, not a data concern
- A "Default" account is auto-created for simplified single-account usage
