# MyTradeLedger - Database Schema

## Design Intent

The database exists to record what actually happened, in the order it happened, and to allow profit or loss to be derived transparently from that record.

- The database does not infer, score, or label performance
- It does not group rows into "trades"
- Each row represents a real ledger event
- All totals and PnL are derivable, not stored as magic numbers

Think **accounting ledger**, not analytics system.

---

## Core Entities

### 1. Account

Represents a logical trading account or portfolio.

| Field | Type | Description |
|-------|------|-------------|
| `id` | UUID | Unique identifier |
| `name` | String | User-defined label (e.g. "Coinbase", "Paper", "Long-Term") |
| `base_currency` | String | Currency used for PnL calculations (default: USD) |
| `created_at` | DateTime | Creation timestamp |
| `archived_at` | DateTime? | Archive timestamp (nullable) |

**Notes:**
- No balances are stored here
- All balances are derived from ledger entries

---

### 2. Asset

Represents a traded asset or currency.

| Field | Type | Description |
|-------|------|-------------|
| `id` | UUID | Unique identifier |
| `symbol` | String | Unique symbol (e.g. BTC, ETH, USDC) |
| `name` | String? | Optional human-readable name |
| `precision` | Int | Decimal precision for quantities (default: 8) |
| `created_at` | DateTime | Creation timestamp |

**Notes:**
- Assets include both crypto and fiat/base currencies
- USD/USDC are treated the same as BTC from a modeling perspective

---

### 3. Ledger Entry (Core Table)

This is the heart of MyTradeLedger. Each row represents a single financial event.

| Field | Type | Description |
|-------|------|-------------|
| `id` | UUID | Unique identifier |
| `account_id` | UUID | Foreign key to Account |
| `timestamp` | DateTime | When the event occurred |
| `entry_type` | Enum | BUY, SELL, FEE, DEPOSIT, WITHDRAWAL, ADJUSTMENT |
| `asset_id` | UUID | Foreign key to Asset (what asset is affected) |
| `quantity` | Decimal(24,12) | Signed value (+increase, -decrease) |
| `price` | Decimal(24,12)? | Price per unit in base currency (nullable) |
| `value_base` | Decimal(24,12) | Total value in base currency (signed) |
| `reference_asset_id` | UUID? | Foreign key to Asset (for exchanges between assets) |
| `external_ref` | String? | Exchange order ID or reference |
| `notes` | String? | User annotation |
| `created_at` | DateTime | Creation timestamp |

#### Entry Type Interpretation

| Type | Asset Quantity | Base Currency Value |
|------|----------------|---------------------|
| BUY | Increases (+) | Decreases (-) |
| SELL | Decreases (-) | Increases (+) |
| FEE | Decreases (-) | Always negative |
| DEPOSIT | Increases (+) | Increases (+) |
| WITHDRAWAL | Decreases (-) | Decreases (-) |
| ADJUSTMENT | Either | Either |

**Important:**
- A BUY and SELL are not paired
- There is no concept of a "trade" at the database level
- Chronology is the only ordering principle
- No implicit linking between entries

---

### 4. Ledger Metadata (Optional)

Flexible key-value extension for ledger entries.

| Field | Type | Description |
|-------|------|-------------|
| `id` | UUID | Unique identifier |
| `ledger_entry_id` | UUID | Foreign key to LedgerEntry |
| `key` | String | Metadata key |
| `value` | String | Metadata value |

**Example uses:**
- Exchange name
- Strategy tag
- Import batch ID

---

## Derived Concepts (Not Stored)

These values are **queries over ledger entries**, not first-class data:

- Current balance
- Open positions
- Average entry price
- Profit or loss
- Win/loss classification

---

## Multi-Account Behavior

- All ledger entries belong to exactly one account
- Accounts are fully isolated
- Cross-account aggregation is a UI concern, not a data concern

---

## Export Expectations

Ledger entries must be exportable with:

- Stable column names
- Chronological ordering
- No hidden joins or transformations

CSV export should closely resemble the ledger table itself.

---

## Schema Philosophy

| Principle | Description |
|-----------|-------------|
| Rows represent facts | Each entry is a real event that happened |
| Time ordering matters | Chronology is the primary structure |
| Nothing is inferred | No calculated fields stored |
| Nothing is scored | No performance labels |
| Nothing is hidden | Full transparency |
| Totals are math, not data | All aggregates are derived |

This schema intentionally trades cleverness for auditability.
