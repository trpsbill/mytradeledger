# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

MyTradeLedger is a personal trade tracking app with a monorepo structure:
- `client/` — React + Vite + TypeScript frontend (DaisyUI/Tailwind for UI)
- `server/` — Express + TypeScript backend with Prisma ORM (PostgreSQL)

## Development Commands

The project is **Docker-first**. Use the `Makefile` targets from the repo root:

```bash
make up          # Start all services (docker-compose.dev.yml)
make up-d        # Start in background
make down        # Stop all services
make rebuild     # Rebuild images (needed after adding npm packages)
make logs        # Follow all logs
make logs-server # Server logs only

# Database (runs inside the server container)
make db-migrate  # Run Prisma migrations
make db-push     # Push schema without a migration file
make db-reset    # Reset DB (destructive)
make db-studio   # Open Prisma Studio on :5555

# Shell access
make shell-server  # sh into server container
```

When adding new npm packages to `server/`, run `make rebuild` so they get installed inside the Docker image.

## Pre-Commit Checks (run after every code change)

Run all of the following from outside Docker — they work against local `node_modules` without containers:

| Step | Server | Client |
|------|--------|--------|
| Lint | `cd server && npm run lint` | `cd client && npm run lint` |
| Typecheck | `cd server && npx tsc --noEmit` | `cd client && npm run build` |
| Typecheck tests | — | `cd client && npx tsc --project tsconfig.test.json --noEmit` |
| Unit tests | `cd server && npm test` | `cd client && npm test` |

Note: `npm run build` uses `tsconfig.json` which **excludes** test files. The separate test typecheck step catches type errors in `*.test.ts(x)` files and matches what CI runs.

All checks must pass before staging any commit. Fix failures before proceeding — do not ask to commit with known failures.

## Environment Setup

**Server** (`server/.env`):
```
PORT=3000
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/mytradeledger?schema=public"
```

Auth anti-automation challenge (optional; see `server/.env.example` for the full list):
```
CHALLENGE_ENABLED=true        # self-hosted PoW challenge; set false to disable entirely
CHALLENGE_POW_MAX=50000       # difficulty (client brute-forces ~max/2 hashes)
CHALLENGE_POW_EXPIRY_MS=300000
CHALLENGE_HMAC_SECRET=        # signs challenges; falls back to JWT_SECRET if unset
```

**Client** (`client/.env`): The client proxies `/api` requests — no API URL needed in dev (Vite handles it). `PORT=3001` is available if needed.

## Architecture

### Backend
- **Entry point**: `server/src/index.ts` — mounts three route groups: `/api/accounts`, `/api/assets`, `/api/ledger`
- **Pattern**: Routes → Controllers → Services → Prisma (DB)
- **Database client**: singleton at `server/src/db/index.ts`
- **P&L calculation**: Realized P&L is computed on `SELL` entries using the average cost method (`ledgerService.getAverageCost`). `valueBase` is auto-calculated (negative for BUY, positive for SELL). The `POST /api/ledger/recalculate-pnl` endpoint can recompute all existing entries.
- **Default account**: The system auto-creates a "Default" account on first ledger entry creation (`ledgerService.getDefaultAccount`).
- **Auth challenge (PoW)**: After repeated auth failures, the public auth routes (login/register/forgot-password) demand a self-hosted proof-of-work challenge before proceeding — defense-in-depth on top of the per-account lockout. `middleware/challenge.ts` is the failure-counting gate (interface + wiring); `middleware/powChallenge.ts` is the Altcha-style provider (issues a salt/target via `GET /api/auth/challenge`, verifies the solution statelessly via an HMAC signature, no DB). The client solves it in `client/src/services/pow.ts` and retries transparently. Gated by `CHALLENGE_ENABLED`.

### Frontend
- **Routing**: React Router with a single `<Layout>` wrapper. Three pages: Dashboard (`/`), Accounts (`/accounts`), Ledger (`/ledger`)
- **API layer**: `client/src/services/api.ts` — typed functions using `accountsApi` and `ledgerApi` objects
- **Data fetching**: `useApi` hook (`client/src/hooks/useApi.ts`) handles loading/error state. `LedgerPage` uses a local `useApiWithMeta` extension that also captures pagination metadata.
- **Filtering**: Ledger filters (symbol, entryType) are stored in URL search params.
- **Theme**: Light/dark toggle persisted via `useTheme` hook.
- **UI components**: Shared components in `client/src/components/` — `Modal`, `ConfirmDialog`, `EmptyState`, `ErrorAlert`, `LoadingSpinner`, `Layout`.

### Data Model (Prisma)
- `Account` — portfolio container with `baseCurrency` (default USD)
- `Asset` — traded symbols with precision (largely legacy; symbol is now a plain string on `LedgerEntry`)
- `LedgerEntry` — core table; `quantity` is signed (positive = BUY, negative = SELL), `valueBase` is signed (negative = cash out for BUY)
- `LedgerMetadata` — arbitrary key-value pairs attached to ledger entries
- `EntryType` enum: `BUY | SELL | FEE | DEPOSIT | WITHDRAWAL | ADJUSTMENT` (UI currently only exposes BUY/SELL)
