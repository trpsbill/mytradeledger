# MyTradeLedger — API Overview

Base URL: `http://localhost:3002/api` by default via `docker compose up` (see `docker-compose.yml`
for the host port mapping), or whatever host/port you've deployed to.

> **Full reference:** the running app serves complete, always-current API docs (with request/response
> examples and curl snippets) at `/docs/api/*` — Authentication, Accounts, Ledger, Assets. This file is a
> quick orientation; treat the in-app docs as the source of truth.

## Response shape

```json
{ "data": <result>, "meta": { "total": 100, "limit": 20, "offset": 0 } }
```

Errors: `{ "error": "message" }` with a standard HTTP status code.

## Authentication

Two ways to authenticate, both via `Authorization: Bearer <token>`:

- **Session JWT** — obtained from `POST /api/auth/login` or `/api/auth/register`, short-lived and
  auto-refreshed by the client while active.
- **Personal Access Token** (`mtl_...` prefix) — created from Settings → API Tokens, for scripts and
  automation. Doesn't expire unless you set an expiry.

Public (no token) endpoints: `GET /api/health`, `GET /api/auth/config`, `POST /api/auth/register`,
`POST /api/auth/login`, `GET /api/auth/challenge`. Everything else requires a valid Bearer token.

There's no email verification or password-reset flow — this is a self-hosted, typically single-user
instance with no email server assumed. If you forget your password, reset it directly in the
database (e.g. via Prisma Studio: `make db-studio`).

Full request/response examples: `/docs/api/authentication` in the running app, or
`client/src/pages/Docs/pages/api/AuthApiPage.tsx` in source.

## Core resources

| Resource | Base path | Docs |
|---|---|---|
| Accounts | `/api/accounts` | `/docs/api/accounts` |
| Ledger entries | `/api/ledger` | `/docs/api/ledger` |
| Assets (legacy) | `/api/assets` | `/docs/api/assets` |
| CSV import | `/api/import/preview`, `/api/import/commit` | `/docs/csv-export` |
| Personal access tokens | `/api/auth/tokens` | Settings → API Tokens in the UI |

### Ledger entry types

| Type | Quantity sign | Value base sign |
|------|------|------|
| BUY | + | − |
| SELL | − | + |

P&L on SELL entries is calculated automatically using the average-cost method; see
[SCHEMA.md](./SCHEMA.md) for the exact fields (`pnl`, `netPnl`, `pnlStatus`).

## Quick examples

```bash
# Register + capture the session token
TOKEN=$(curl -s -X POST http://localhost:3002/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"you@example.com","password":"securepass1"}' | jq -r .data.token)

# Record a BUY
curl -X POST http://localhost:3002/api/ledger \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"symbol":"BTC/USD","entryType":"BUY","quantity":"0.5","price":"45000","fee":"22.50"}'

# List entries, filtered and paginated
curl "http://localhost:3002/api/ledger?entryType=BUY&limit=20&offset=0" \
  -H "Authorization: Bearer $TOKEN"

# Export to CSV
curl -H "Authorization: Bearer $TOKEN" -O http://localhost:3002/api/ledger/export/csv
```
