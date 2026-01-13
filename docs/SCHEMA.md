# MyTradeLedger - Database Schema

## Design Intent

The database exists to record what actually happened, in the order it happened, and to allow profit or loss to be derived transparently from that record.

- The database does not infer, score, or label performance
- It does not group rows into "trades"
- Each row represents a real ledger event
- All totals and PnL are derivable from the ledger

Think **accounting ledger**, not analytics system.

---

## Core Entities

### 1. Account

Represents a logical trading account or portfolio. A "Default" account is auto-created when the first trade is recorded.

| Field | Type | Description |
|-------|------|-------------|
| `id` | UUID | Unique identifier |
| `name` | String | User-defined label (e.g. "Default", "Coinbase") |
| `base_currency` | String | Currency used for PnL calculations (default: USD) |
| `created_at` | DateTime | Creation timestamp |
| `archived_at` | DateTime? | Archive timestamp (nullable) |

**Notes:**
- No balances are stored here
- All balances are derived from ledger entries

---

### 2. Ledger Entry (Core Table)

This is the heart of MyTradeLedger. Each row represents a single trade event.

| Field | Type | Description |
|-------|------|-------------|
| `id` | UUID | Unique identifier |
| `account_id` | UUID | Foreign key to Account |
| `timestamp` | DateTime | When the event occurred |
| `entry_type` | Enum | BUY or SELL |
| `symbol` | String | Trading pair symbol (e.g., "BTC/USD", "ETH-USDT") |
| `quantity` | Decimal(24,12) | Signed value (+increase for BUY, -decrease for SELL) |
| `price` | Decimal(24,12) | Price per unit |
| `fee` | Decimal(24,12)? | Trading fee amount (nullable) |
| `value_base` | Decimal(24,12) | Total value in base currency (auto-calculated) |
| `pnl` | Decimal(24,12)? | Realized P&L for SELL entries (auto-calculated) |
| `notes` | String? | User annotation |
| `created_at` | DateTime | Creation timestamp |

#### Entry Type Interpretation

| Type | Asset Quantity | Base Currency Value |
|------|----------------|---------------------|
| BUY | Increases (+) | Decreases (-) |
| SELL | Decreases (-) | Increases (+) |

#### Auto-Calculated Fields

- **`value_base`**: `quantity × price` (negative for BUY, positive for SELL)
- **`pnl`**: For SELL entries only, calculated using the average cost method:
  - Average Cost = (Sum of all BUY costs for symbol) / (Total quantity bought)
  - P&L = (Sell Price - Average Cost) × Quantity Sold

**Important:**
- A BUY and SELL are not paired
- There is no concept of a "trade" at the database level
- Chronology is the only ordering principle
- No implicit linking between entries

---

### 3. Ledger Metadata (Optional)

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

### 4. Asset (Legacy)

The Asset table exists for backward compatibility but is not used in the simplified model. Trading pairs are stored directly as a `symbol` string in ledger entries.

---

## Derived Concepts (Queries, Not Stored)

These values are **queries over ledger entries**:

- **Current balance**: SUM of quantities grouped by symbol
- **Total P&L**: SUM of valueBase for an account
- **Realized P&L**: SUM of pnl field for SELL entries

---

## Multi-Account Behavior

- All ledger entries belong to exactly one account
- Accounts are fully isolated
- Cross-account aggregation is a UI concern, not a data concern
- A "Default" account is auto-created for simplified single-account usage

---

## Export Expectations

Ledger entries are exportable to CSV with:

- Stable column names: Date, Type, Symbol, Quantity, Price, Fee, Total, P&L, Notes
- Chronological ordering
- No hidden joins or transformations

---

## Schema Philosophy

| Principle | Description |
|-----------|-------------|
| Rows represent facts | Each entry is a real event that happened |
| Time ordering matters | Chronology is the primary structure |
| Minimal inference | Only P&L is calculated (for convenience) |
| Nothing is scored | No performance labels |
| Nothing is hidden | Full transparency |
| Totals are math, not data | All aggregates are derived |

This schema intentionally trades cleverness for auditability.
