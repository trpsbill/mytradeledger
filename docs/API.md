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
  "error": "Error message",
  "details": "Additional details (optional)"
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

## Assets

Assets represent tradeable currencies (crypto or fiat).

### GET /assets

List all assets.

**Response:**
```json
{
  "data": [
    {
      "id": "uuid",
      "symbol": "BTC",
      "name": "Bitcoin",
      "precision": 8,
      "createdAt": "2026-01-11T10:00:00.000Z"
    }
  ]
}
```

---

### GET /assets/:id

Get asset by ID.

**Parameters:**
| Name | Type | Description |
|------|------|-------------|
| id | string | Asset UUID |

**Response:**
```json
{
  "data": {
    "id": "uuid",
    "symbol": "BTC",
    "name": "Bitcoin",
    "precision": 8,
    "createdAt": "2026-01-11T10:00:00.000Z"
  }
}
```

**Errors:**
- `404` - Asset not found

---

### POST /assets

Create a new asset.

**Request Body:**
```json
{
  "symbol": "BTC",
  "name": "Bitcoin",
  "precision": 8
}
```

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| symbol | string | Yes | - | Unique asset symbol (auto-uppercased) |
| name | string | No | null | Human-readable name |
| precision | integer | No | 8 | Decimal precision for quantities |

**Response:** `201 Created`
```json
{
  "data": {
    "id": "uuid",
    "symbol": "BTC",
    "name": "Bitcoin",
    "precision": 8,
    "createdAt": "2026-01-11T10:00:00.000Z"
  }
}
```

**Errors:**
- `400` - Symbol is required
- `409` - Asset with this symbol already exists

---

### PATCH /assets/:id

Update an asset.

**Parameters:**
| Name | Type | Description |
|------|------|-------------|
| id | string | Asset UUID |

**Request Body:**
```json
{
  "name": "Bitcoin Core",
  "precision": 8
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| name | string | No | Human-readable name |
| precision | integer | No | Decimal precision |

**Response:**
```json
{
  "data": {
    "id": "uuid",
    "symbol": "BTC",
    "name": "Bitcoin Core",
    "precision": 8,
    "createdAt": "2026-01-11T10:00:00.000Z"
  }
}
```

**Errors:**
- `404` - Asset not found

---

### DELETE /assets/:id

Delete an asset.

**Parameters:**
| Name | Type | Description |
|------|------|-------------|
| id | string | Asset UUID |

**Response:** `204 No Content`

**Errors:**
- `404` - Asset not found

---

## Accounts

Accounts represent trading portfolios or exchange accounts.

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
      "name": "Main Account",
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

**Parameters:**
| Name | Type | Description |
|------|------|-------------|
| id | string | Account UUID |

**Response:**
```json
{
  "data": {
    "id": "uuid",
    "name": "Main Account",
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

Get asset balances for an account. Balances are derived from ledger entries.

**Parameters:**
| Name | Type | Description |
|------|------|-------------|
| id | string | Account UUID |

**Response:**
```json
{
  "data": [
    {
      "asset": {
        "id": "uuid",
        "symbol": "BTC",
        "name": "Bitcoin",
        "precision": 8,
        "createdAt": "2026-01-11T10:00:00.000Z"
      },
      "quantity": "1.5"
    },
    {
      "asset": {
        "id": "uuid",
        "symbol": "ETH",
        "name": "Ethereum",
        "precision": 8,
        "createdAt": "2026-01-11T10:00:00.000Z"
      },
      "quantity": "10.0"
    }
  ]
}
```

**Errors:**
- `404` - Account not found

---

### GET /accounts/:id/pnl

Get total profit/loss for an account in base currency. P&L is derived from ledger entries.

**Parameters:**
| Name | Type | Description |
|------|------|-------------|
| id | string | Account UUID |

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
```json
{
  "data": {
    "id": "uuid",
    "name": "Coinbase",
    "baseCurrency": "USD",
    "createdAt": "2026-01-11T10:00:00.000Z",
    "archivedAt": null
  }
}
```

**Errors:**
- `400` - Name is required

---

### PATCH /accounts/:id

Update an account.

**Parameters:**
| Name | Type | Description |
|------|------|-------------|
| id | string | Account UUID |

**Request Body:**
```json
{
  "name": "Coinbase Pro",
  "baseCurrency": "EUR"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| name | string | No | Account name |
| baseCurrency | string | No | Base currency |

**Response:**
```json
{
  "data": {
    "id": "uuid",
    "name": "Coinbase Pro",
    "baseCurrency": "EUR",
    "createdAt": "2026-01-11T10:00:00.000Z",
    "archivedAt": null
  }
}
```

**Errors:**
- `404` - Account not found

---

### POST /accounts/:id/archive

Archive an account.

**Parameters:**
| Name | Type | Description |
|------|------|-------------|
| id | string | Account UUID |

**Response:**
```json
{
  "data": {
    "id": "uuid",
    "name": "Old Account",
    "baseCurrency": "USD",
    "createdAt": "2026-01-11T10:00:00.000Z",
    "archivedAt": "2026-01-15T10:00:00.000Z"
  }
}
```

**Errors:**
- `404` - Account not found

---

### POST /accounts/:id/unarchive

Unarchive an account.

**Parameters:**
| Name | Type | Description |
|------|------|-------------|
| id | string | Account UUID |

**Response:**
```json
{
  "data": {
    "id": "uuid",
    "name": "Restored Account",
    "baseCurrency": "USD",
    "createdAt": "2026-01-11T10:00:00.000Z",
    "archivedAt": null
  }
}
```

**Errors:**
- `404` - Account not found

---

### DELETE /accounts/:id

Delete an account and all its ledger entries.

**Parameters:**
| Name | Type | Description |
|------|------|-------------|
| id | string | Account UUID |

**Response:** `204 No Content`

**Errors:**
- `404` - Account not found

---

## Ledger Entries

Ledger entries are the core data model. Each entry represents a single financial event.

### Entry Types

| Type | Description | Quantity | Value Base |
|------|-------------|----------|------------|
| BUY | Purchase of asset | Positive (+) | Negative (-) |
| SELL | Sale of asset | Negative (-) | Positive (+) |
| FEE | Fee payment | Negative (-) | Negative (-) |
| DEPOSIT | Deposit into account | Positive (+) | Positive (+) |
| WITHDRAWAL | Withdrawal from account | Negative (-) | Negative (-) |
| ADJUSTMENT | Manual correction | Either | Either |

---

### GET /ledger

List ledger entries with optional filters.

**Query Parameters:**
| Name | Type | Default | Description |
|------|------|---------|-------------|
| accountId | string | - | Filter by account |
| assetId | string | - | Filter by asset |
| entryType | string | - | Filter by entry type |
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
      "assetId": "uuid",
      "quantity": "0.5",
      "price": "45000",
      "valueBase": "-22500",
      "referenceAssetId": "uuid",
      "fee": "22.50",
      "feeAssetId": "uuid",
      "externalRef": "order-123",
      "notes": "First BTC purchase",
      "createdAt": "2026-01-11T10:00:00.000Z",
      "asset": {
        "id": "uuid",
        "symbol": "BTC",
        "name": "Bitcoin",
        "precision": 8,
        "createdAt": "2026-01-11T10:00:00.000Z"
      },
      "referenceAsset": {
        "id": "uuid",
        "symbol": "USD",
        "name": "US Dollar",
        "precision": 2,
        "createdAt": "2026-01-11T10:00:00.000Z"
      },
      "feeAsset": {
        "id": "uuid",
        "symbol": "USD",
        "name": "US Dollar",
        "precision": 2,
        "createdAt": "2026-01-11T10:00:00.000Z"
      },
      "account": {
        "id": "uuid",
        "name": "Main Account",
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

**Parameters:**
| Name | Type | Description |
|------|------|-------------|
| id | string | Ledger entry UUID |

**Response:**
```json
{
  "data": {
    "id": "uuid",
    "accountId": "uuid",
    "timestamp": "2026-01-11T10:00:00.000Z",
    "entryType": "BUY",
    "assetId": "uuid",
    "quantity": "0.5",
    "price": "45000",
    "valueBase": "-22500",
    "referenceAssetId": "uuid",
    "fee": "22.50",
    "feeAssetId": "uuid",
    "externalRef": "order-123",
    "notes": "First BTC purchase",
    "createdAt": "2026-01-11T10:00:00.000Z",
    "asset": { ... },
    "referenceAsset": { ... },
    "feeAsset": { ... },
    "account": { ... },
    "metadata": [
      {
        "id": "uuid",
        "ledgerEntryId": "uuid",
        "key": "exchange",
        "value": "coinbase"
      }
    ]
  }
}
```

**Errors:**
- `404` - Ledger entry not found

---

### POST /ledger

Create a new ledger entry.

**Request Body:**
```json
{
  "accountId": "uuid",
  "timestamp": "2026-01-11T10:00:00.000Z",
  "entryType": "BUY",
  "assetId": "uuid",
  "quantity": "0.5",
  "price": "45000",
  "valueBase": "-22500",
  "referenceAssetId": "uuid",
  "fee": "22.50",
  "feeAssetId": "uuid",
  "externalRef": "order-123",
  "notes": "First BTC purchase"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| accountId | string | Yes | Account UUID |
| timestamp | string | Yes | Event timestamp (ISO 8601) |
| entryType | string | Yes | BUY, SELL, FEE, DEPOSIT, WITHDRAWAL, or ADJUSTMENT |
| assetId | string | Yes | Asset UUID |
| quantity | string/number | Yes | Signed quantity (+ or -) |
| price | string/number | No | Price per unit in base currency |
| valueBase | string/number | Yes | Total value in base currency (signed) |
| referenceAssetId | string | No | Reference asset UUID (for exchanges) |
| fee | string/number | No | Trading fee amount |
| feeAssetId | string | No | Asset UUID for fee (e.g., USD, BTC) |
| externalRef | string | No | External reference (e.g., exchange order ID) |
| notes | string | No | User notes |

**Response:** `201 Created`
```json
{
  "data": {
    "id": "uuid",
    "accountId": "uuid",
    "timestamp": "2026-01-11T10:00:00.000Z",
    "entryType": "BUY",
    "assetId": "uuid",
    "quantity": "0.5",
    "price": "45000",
    "valueBase": "-22500",
    "referenceAssetId": "uuid",
    "fee": "22.50",
    "feeAssetId": "uuid",
    "externalRef": "order-123",
    "notes": "First BTC purchase",
    "createdAt": "2026-01-11T10:00:00.000Z",
    "asset": { ... },
    "referenceAsset": { ... },
    "feeAsset": { ... },
    "account": { ... }
  }
}
```

**Errors:**
- `400` - Missing required field
- `400` - Invalid entryType
- `400` - Account not found
- `400` - Asset not found
- `400` - Reference asset not found

---

### POST /ledger/batch

Create multiple ledger entries at once.

**Request Body:**
```json
{
  "entries": [
    {
      "accountId": "uuid",
      "timestamp": "2026-01-11T10:00:00.000Z",
      "entryType": "BUY",
      "assetId": "uuid",
      "quantity": "0.5",
      "price": "45000",
      "valueBase": "-22500",
      "fee": "22.50",
      "feeAssetId": "uuid"
    },
    {
      "accountId": "uuid",
      "timestamp": "2026-01-11T11:00:00.000Z",
      "entryType": "SELL",
      "assetId": "uuid",
      "quantity": "-0.25",
      "price": "46000",
      "valueBase": "11500",
      "fee": "11.50",
      "feeAssetId": "uuid"
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

Update a ledger entry.

**Parameters:**
| Name | Type | Description |
|------|------|-------------|
| id | string | Ledger entry UUID |

**Request Body:**
```json
{
  "timestamp": "2026-01-11T11:00:00.000Z",
  "notes": "Updated notes"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| timestamp | string | No | Event timestamp |
| entryType | string | No | Entry type |
| assetId | string | No | Asset UUID |
| quantity | string/number | No | Quantity |
| price | string/number | No | Price (null to clear) |
| valueBase | string/number | No | Value in base currency |
| referenceAssetId | string | No | Reference asset (null to clear) |
| fee | string/number | No | Trading fee (null to clear) |
| feeAssetId | string | No | Fee asset UUID (null to clear) |
| externalRef | string | No | External reference |
| notes | string | No | Notes |

**Response:**
```json
{
  "data": {
    "id": "uuid",
    ...
  }
}
```

**Errors:**
- `400` - Invalid entryType
- `404` - Ledger entry not found

---

### DELETE /ledger/:id

Delete a ledger entry.

**Parameters:**
| Name | Type | Description |
|------|------|-------------|
| id | string | Ledger entry UUID |

**Response:** `204 No Content`

**Errors:**
- `404` - Ledger entry not found

---

## Ledger Metadata

Attach key-value metadata to ledger entries.

### GET /ledger/:id/metadata

Get metadata for a ledger entry.

**Parameters:**
| Name | Type | Description |
|------|------|-------------|
| id | string | Ledger entry UUID |

**Response:**
```json
{
  "data": [
    {
      "id": "uuid",
      "ledgerEntryId": "uuid",
      "key": "exchange",
      "value": "coinbase"
    },
    {
      "id": "uuid",
      "ledgerEntryId": "uuid",
      "key": "strategy",
      "value": "dca"
    }
  ]
}
```

**Errors:**
- `404` - Ledger entry not found

---

### POST /ledger/:id/metadata

Add metadata to a ledger entry.

**Parameters:**
| Name | Type | Description |
|------|------|-------------|
| id | string | Ledger entry UUID |

**Request Body:**
```json
{
  "key": "exchange",
  "value": "coinbase"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| key | string | Yes | Metadata key |
| value | string | Yes | Metadata value |

**Response:** `201 Created`
```json
{
  "data": {
    "id": "uuid",
    "ledgerEntryId": "uuid",
    "key": "exchange",
    "value": "coinbase"
  }
}
```

**Errors:**
- `400` - key and value are required
- `404` - Ledger entry not found

---

### DELETE /ledger/:id/metadata/:metadataId

Delete a metadata entry.

**Parameters:**
| Name | Type | Description |
|------|------|-------------|
| id | string | Ledger entry UUID |
| metadataId | string | Metadata entry UUID |

**Response:** `204 No Content`

**Errors:**
- `404` - Metadata not found

---

## Examples

### Record a BTC Purchase

```bash
# 1. Create assets (if not exists)
curl -X POST http://localhost:3000/api/assets \
  -H "Content-Type: application/json" \
  -d '{"symbol": "BTC", "name": "Bitcoin"}'

curl -X POST http://localhost:3000/api/assets \
  -H "Content-Type: application/json" \
  -d '{"symbol": "USD", "name": "US Dollar", "precision": 2}'

# 2. Create account
curl -X POST http://localhost:3000/api/accounts \
  -H "Content-Type: application/json" \
  -d '{"name": "Main Trading Account"}'

# 3. Record the purchase with integrated fee (BUY 0.5 BTC at $45,000 with $22.50 fee)
curl -X POST http://localhost:3000/api/ledger \
  -H "Content-Type: application/json" \
  -d '{
    "accountId": "<account-uuid>",
    "timestamp": "2026-01-11T10:00:00Z",
    "entryType": "BUY",
    "assetId": "<btc-uuid>",
    "quantity": "0.5",
    "price": "45000",
    "valueBase": "-22500",
    "referenceAssetId": "<usd-uuid>",
    "fee": "22.50",
    "feeAssetId": "<usd-uuid>"
  }'
```

### Record a BTC Sale

```bash
# SELL 0.25 BTC at $50,000 with $12.50 fee
curl -X POST http://localhost:3000/api/ledger \
  -H "Content-Type: application/json" \
  -d '{
    "accountId": "<account-uuid>",
    "timestamp": "2026-01-15T14:30:00Z",
    "entryType": "SELL",
    "assetId": "<btc-uuid>",
    "quantity": "-0.25",
    "price": "50000",
    "valueBase": "12500",
    "referenceAssetId": "<usd-uuid>",
    "fee": "12.50",
    "feeAssetId": "<usd-uuid>"
  }'
```

### Query Ledger with Filters

```bash
# Get all BUY entries for an account
curl "http://localhost:3000/api/ledger?accountId=<uuid>&entryType=BUY"

# Get entries in a date range
curl "http://localhost:3000/api/ledger?startDate=2026-01-01&endDate=2026-01-31"

# Paginate results
curl "http://localhost:3000/api/ledger?limit=20&offset=40"
```

### Check Account Status

```bash
# Get balances (derived from ledger)
curl http://localhost:3000/api/accounts/<uuid>/balance

# Get P&L (derived from ledger)
curl http://localhost:3000/api/accounts/<uuid>/pnl
```
