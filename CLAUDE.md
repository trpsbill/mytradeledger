# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

MyTradeLedger is a self-hosted, open-source crypto trade tracking app with a monorepo structure:
- `client/` — React + Vite + TypeScript frontend (DaisyUI/Tailwind for UI)
- `server/` — Express + TypeScript backend with Prisma ORM (PostgreSQL)

## Development Commands

The project is **Docker-first**. Use the `Makefile` targets from the repo root:

```bash
make up          # Start all services (docker-compose.yml)
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

When adding new npm packages to `server/` or `client/`, run `make rebuild` so they get installed inside the Docker image.

## Pre-Commit Checks (run after every code change)

Run all of the following from outside Docker — they work against local `node_modules` without containers:

| Step | Server | Client |
|------|--------|--------|
| Lint | `cd server && npm run lint` | `cd client && npm run lint` |
| Typecheck | `cd server && npx tsc --noEmit` | `cd client && npm run build` |
| Typecheck tests | — | `cd client && npx tsc --project tsconfig.test.json --noEmit` |
| Unit tests | `cd server && npm test` | `cd client && npm test` |
| Integration tests | `cd server && npm run test:integration` | — |

Note: `npm run build` uses `tsconfig.json` which **excludes** test files. The separate test typecheck step catches type errors in `*.test.ts(x)` files and matches what CI runs.

All checks must pass before staging any commit. Fix failures before proceeding — do not ask to commit with known failures.

## Environment Setup

Copy `.env.example` to `.env` at the repo root (read by `docker-compose.yml`) and `server/.env.example` to `server/.env`. See both files for the full list with comments; key ones:

```
JWT_SECRET=                   # signs session JWTs — generate a strong random value
SIGNUP_ENABLED=true           # set false to close registration
CHALLENGE_ENABLED=true        # self-hosted PoW anti-automation challenge; set false to disable
MJ_APIKEY_PUBLIC=             # Mailjet — only used for the support-request form
MJ_SANDBOX=true               # logs emails to console instead of sending
```

There is no email verification or password-reset flow — this is a self-hosted, typically
single-user instance with no email server assumed. Forgot your password? Reset it directly via
`make db-studio`.

## Architecture

### Backend
- **Entry point**: `server/src/index.ts` — mounts route groups: `/api/auth`, `/api/accounts`, `/api/assets`, `/api/ledger`, `/api/import`, `/api/support`
- **Pattern**: Routes → Controllers → Services → Prisma (DB)
- **Database client**: singleton at `server/src/db/index.ts`
- **Auth**: email/password with bcrypt, session JWTs (`middleware/auth.ts`), and personal access tokens (`mtl_...` prefix, `services/tokenService.ts`) for API scripting. No email verification or password reset.
- **P&L calculation**: Realized gross P&L (`pnl`) and fee-inclusive net P&L (`netPnl`) are computed on `SELL` entries using the average cost method (`ledgerService`). `valueBase` is auto-calculated (negative for BUY, positive for SELL). `pnlStatus` is `"PNL_UNCOMPUTABLE"` when no prior BUY exists to cost a sale against. `POST /api/ledger/recalculate-pnl` recomputes all existing entries.
- **Default account**: The system auto-creates a "Default" account on first ledger entry creation (`ledgerService.getDefaultAccount`). `POST /api/accounts/demo` seeds an optional sample "Demo Portfolio" account (`Account.isDemo`) for onboarding.
- **CSV import**: `server/src/import/` — preview (dedupe + validation) then commit, via `POST /api/import/preview` and `/api/import/commit`.
- **Auth challenge (PoW)**: After repeated auth failures, the public auth routes (login/register) demand a self-hosted proof-of-work challenge before proceeding — defense-in-depth on top of the per-account lockout. `middleware/challenge.ts` is the failure-counting gate (interface + wiring); `middleware/powChallenge.ts` is the Altcha-style provider (issues a salt/target via `GET /api/auth/challenge`, verifies the solution statelessly via an HMAC signature, no DB). The client solves it in `client/src/services/pow.ts` and retries transparently. Gated by `CHALLENGE_ENABLED`.

### Frontend
- **Routing**: React Router. Public routes: Home (`/`), Signup, Login, Privacy, Docs (`/docs/*`, no auth required). Authenticated routes live under `/app` with a shared `<Layout>`: Dashboard (`/app`), Accounts (`/app/accounts`), Ledger (`/app/ledger`), API Tokens (`/app/settings/tokens`).
- **API layer**: `client/src/services/api.ts` — typed functions using `authApi`, `accountsApi`, `ledgerApi`, `tokensApi`, and `supportApi` objects
- **Data fetching**: `useApi` hook (`client/src/hooks/useApi.ts`) handles loading/error state. `LedgerPage`/`DashboardPage` use a local `useApiWithMeta` extension that also captures pagination metadata.
- **Filtering**: Ledger filters (symbol, entryType) are stored in URL search params.
- **Theme**: Light/dark toggle persisted via `useTheme` hook.
- **UI components**: Shared components in `client/src/components/` — `Modal`, `ConfirmDialog`, `EmptyState`, `ErrorAlert`, `LoadingSpinner`, `Layout`, `DemoAccountModal`.

### Data Model (Prisma)
- `User` — email/password auth account holder
- `PersonalAccessToken` — long-lived API tokens (`mtl_...` prefix), hashed at rest
- `Account` — portfolio container with `baseCurrency` (default USD); `isDemo` marks the seeded sample-data account, `isDefault` marks the account used when no `accountId` is given
- `Asset` — traded symbols with precision (largely legacy; symbol is now a plain string on `LedgerEntry`)
- `LedgerEntry` — core table; `quantity` is signed (positive = BUY, negative = SELL), `valueBase` is signed (negative = cash out for BUY), `pnl`/`netPnl`/`pnlStatus` hold realized P&L
- `LedgerMetadata` — arbitrary key-value pairs attached to ledger entries
- `EntryType` enum: `BUY | SELL | FEE | DEPOSIT | WITHDRAWAL | ADJUSTMENT` (UI currently only exposes BUY/SELL)
