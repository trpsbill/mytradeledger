# MyTradeLedger - API Documentation

Base URL: `http://localhost:3000/api`

## Overview

All responses follow a consistent format:

**Success Response:**
```json
{
  "data": <result>,
  "meta": {
    "total": 100,
    "limit": 20,
    "offset": 0
  }
}
```

**Error Response:**
```json
{
  "error": "Error message"
}
```

---

## Health Check

### GET /health

Check API status.

**Response:**
```json
{
  "status": "ok",
  "timestamp": "2026-01-11T10:00:00.000Z"
}
```

---

## Accounts

Accounts represent trading portfolios. A "Default" account is automatically created when you add your first trade.

### GET /accounts

List all accounts.

**Query Parameters:**
| Name | Type | Default | Description |
|------|------|---------|-------------|
| includeArchived | boolean | false | Include archived accounts |

**Response:**
```json
{
  "data": [
    {
      "id": "uuid",
      "name": "Default",
      "baseCurrency": "USD",
      "createdAt": "2026-01-11T10:00:00.000Z",
      "archivedAt": null
    }
  ]
}
```

---

### GET /accounts/:id

Get account by ID.

**Response:**
```json
{
  "data": {
    "id": "uuid",
    "name": "Default",
    "baseCurrency": "USD",
    "createdAt": "2026-01-11T10:00:00.000Z",
    "archivedAt": null
  }
}
```

**Errors:**
- `404` - Account not found

---

### GET /accounts/:id/balance

Get balances for an account, grouped by symbol.

**Response:**
```json
{
  "data": [
    {
      "symbol": "BTC/USD",
      "quantity": "1.5"
    },
    {
      "symbol": "ETH/USD",
      "quantity": "10.0"
    }
  ]
}
```

**Errors:**
- `404` - Account not found

---

### GET /accounts/:id/pnl

Get total profit/loss for an account in base currency.

**Response:**
```json
{
  "data": {
    "accountId": "uuid",
    "baseCurrency": "USD",
    "totalPnL": "1250.50"
  }
}
```

**Errors:**
- `404` - Account not found

---

### POST /accounts

Create a new account.

**Request Body:**
```json
{
  "name": "Coinbase",
  "baseCurrency": "USD"
}
```

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| name | string | Yes | - | Account name |
| baseCurrency | string | No | "USD" | Base currency for P&L calculations |

**Response:** `201 Created`

**Errors:**
- `400` - Name is required

---

### PATCH /accounts/:id

Update an account.

**Request Body:**
```json
{
  "name": "Coinbase Pro",
  "baseCurrency": "EUR"
}
```

**Errors:**
- `404` - Account not found

---

### POST /accounts/:id/archive

Archive an account.

**Errors:**
- `404` - Account not found

---

### POST /accounts/:id/unarchive

Unarchive an account.

**Errors:**
- `404` - Account not found

---

### DELETE /accounts/:id

Delete an account and all its ledger entries.

**Response:** `204 No Content`

**Errors:**
- `404` - Account not found

---

## Ledger Entries

Ledger entries are the core data model. Each entry represents a trade (buy or sell).

### Entry Types

| Type | Description | Quantity | Value Base |
|------|-------------|----------|------------|
| BUY | Purchase of asset | Positive (+) | Negative (-) |
| SELL | Sale of asset | Negative (-) | Positive (+) |

### P&L Calculation

For SELL entries, P&L is automatically calculated using the **average cost method**:
- Average Cost = (Sum of all BUY costs for symbol) / (Total quantity bought)
- P&L = (Sell Price - Average Cost) × Quantity Sold

---

### GET /ledger

List ledger entries with optional filters.

**Query Parameters:**
| Name | Type | Default | Description |
|------|------|---------|-------------|
| symbol | string | - | Filter by symbol (partial match) |
| entryType | string | - | Filter by entry type (BUY or SELL) |
| startDate | string | - | Filter entries on or after date (ISO 8601) |
| endDate | string | - | Filter entries on or before date (ISO 8601) |
| limit | integer | 100 | Maximum entries to return |
| offset | integer | 0 | Number of entries to skip |

**Response:**
```json
{
  "data": [
    {
      "id": "uuid",
      "accountId": "uuid",
      "timestamp": "2026-01-11T10:00:00.000Z",
      "entryType": "BUY",
      "symbol": "BTC/USD",
      "quantity": "0.5",
      "price": "45000",
      "fee": "22.50",
      "valueBase": "-22500",
      "pnl": null,
      "notes": "First BTC purchase",
      "createdAt": "2026-01-11T10:00:00.000Z",
      "account": {
        "id": "uuid",
        "name": "Default",
        "baseCurrency": "USD",
        "createdAt": "2026-01-11T10:00:00.000Z",
        "archivedAt": null
      }
    }
  ],
  "meta": {
    "total": 150,
    "limit": 100,
    "offset": 0
  }
}
```

---

### GET /ledger/:id

Get ledger entry by ID.

**Response:**
```json
{
  "data": {
    "id": "uuid",
    "accountId": "uuid",
    "timestamp": "2026-01-11T10:00:00.000Z",
    "entryType": "SELL",
    "symbol": "BTC/USD",
    "quantity": "-0.25",
    "price": "50000",
    "fee": "12.50",
    "valueBase": "12500",
    "pnl": "1250.00",
    "notes": null,
    "createdAt": "2026-01-11T10:00:00.000Z",
    "account": { ... },
    "metadata": []
  }
}
```

**Errors:**
- `404` - Ledger entry not found

---

### POST /ledger

Create a new ledger entry. Account is automatically assigned to "Default" (created if needed).

**Request Body:**
```json
{
  "symbol": "BTC/USD",
  "entryType": "BUY",
  "quantity": "0.5",
  "price": "45000",
  "fee": "22.50",
  "timestamp": "2026-01-11T10:00:00.000Z",
  "notes": "First BTC purchase"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| symbol | string | Yes | Trading pair symbol (e.g., "BTC/USD", "ETH-USDT") |
| entryType | string | Yes | BUY or SELL |
| quantity | string/number | Yes | Quantity (always positive, sign is auto-calculated) |
| price | string/number | Yes | Price per unit |
| fee | string/number | No | Trading fee amount |
| timestamp | string | No | Event timestamp (ISO 8601), defaults to now |
| notes | string | No | User notes |

**Auto-calculated fields:**
- `valueBase` = quantity × price (negative for BUY, positive for SELL)
- `pnl` = calculated for SELL entries using average cost method

**Response:** `201 Created`

**Errors:**
- `400` - symbol is required
- `400` - entryType is required (must be BUY or SELL)
- `400` - quantity must be a positive number
- `400` - price must be a positive number

---

### POST /ledger/batch

Create multiple ledger entries at once.

**Request Body:**
```json
{
  "entries": [
    {
      "symbol": "BTC/USD",
      "entryType": "BUY",
      "quantity": "0.5",
      "price": "45000"
    },
    {
      "symbol": "BTC/USD",
      "entryType": "SELL",
      "quantity": "0.25",
      "price": "50000"
    }
  ]
}
```

**Response:** `201 Created`
```json
{
  "data": {
    "count": 2
  }
}
```

**Errors:**
- `400` - entries array is required

---

### PATCH /ledger/:id

Update a ledger entry. P&L is recalculated for SELL entries.

**Request Body:**
```json
{
  "symbol": "BTC/USD",
  "entryType": "BUY",
  "quantity": "0.6",
  "price": "44000",
  "fee": "20.00",
  "timestamp": "2026-01-11T11:00:00.000Z",
  "notes": "Updated notes"
}
```

All fields are optional.

**Errors:**
- `400` - Invalid entryType
- `404` - Ledger entry not found

---

### DELETE /ledger/:id

Delete a ledger entry.

**Response:** `204 No Content`

**Errors:**
- `404` - Ledger entry not found

---

### GET /ledger/export/csv

Export all ledger entries to CSV format.

**Query Parameters:**
| Name | Type | Description |
|------|------|-------------|
| symbol | string | Filter by symbol |
| entryType | string | Filter by entry type |
| startDate | string | Filter by start date |
| endDate | string | Filter by end date |

**Response:** CSV file download with headers:
`Date, Type, Symbol, Quantity, Price, Fee, Total, P&L, Notes`

---

### POST /ledger/recalculate-pnl

Recalculate P&L for all existing SELL entries. Useful after importing data or fixing entries.

**Response:**
```json
{
  "data": {
    "updated": 5
  }
}
```

---

## Ledger Metadata

Attach key-value metadata to ledger entries.

### GET /ledger/:id/metadata

Get metadata for a ledger entry.

**Response:**
```json
{
  "data": [
    {
      "id": "uuid",
      "ledgerEntryId": "uuid",
      "key": "exchange",
      "value": "coinbase"
    }
  ]
}
```

---

### POST /ledger/:id/metadata

Add metadata to a ledger entry.

**Request Body:**
```json
{
  "key": "exchange",
  "value": "coinbase"
}
```

**Response:** `201 Created`

**Errors:**
- `400` - key and value are required
- `404` - Ledger entry not found

---

### DELETE /ledger/:id/metadata/:metadataId

Delete a metadata entry.

**Response:** `204 No Content`

**Errors:**
- `404` - Metadata not found

---

## Examples

### Record a BTC Purchase

```bash
curl -X POST http://localhost:3000/api/ledger \
  -H "Content-Type: application/json" \
  -d '{
    "symbol": "BTC/USD",
    "entryType": "BUY",
    "quantity": "0.5",
    "price": "45000",
    "fee": "22.50",
    "notes": "First BTC purchase"
  }'
```

### Record a BTC Sale

```bash
curl -X POST http://localhost:3000/api/ledger \
  -H "Content-Type: application/json" \
  -d '{
    "symbol": "BTC/USD",
    "entryType": "SELL",
    "quantity": "0.25",
    "price": "50000",
    "fee": "12.50"
  }'
```

### Query Ledger with Filters

```bash
# Get all BUY entries
curl "http://localhost:3000/api/ledger?entryType=BUY"

# Get entries for a specific symbol
curl "http://localhost:3000/api/ledger?symbol=BTC"

# Get entries in a date range
curl "http://localhost:3000/api/ledger?startDate=2026-01-01&endDate=2026-01-31"

# Paginate results
curl "http://localhost:3000/api/ledger?limit=20&offset=40"
```

### Export to CSV

```bash
curl -O http://localhost:3000/api/ledger/export/csv
```

### Check Account Status

```bash
# Get balances (grouped by symbol)
curl http://localhost:3000/api/accounts/<uuid>/balance

# Get total P&L
curl http://localhost:3000/api/accounts/<uuid>/pnl
```

### Recalculate P&L

```bash
curl -X POST http://localhost:3000/api/ledger/recalculate-pnl
```
