# MyTradeLedger — Project Definition

## Overview

MyTradeLedger is a crypto trade logging application focused on simple, accurate record-keeping and clear profit or loss visibility. It records buy and sell trades, reviews them chronologically, and shows cumulative financial results over time.

This is the **open-source, self-hosted** distribution: run it yourself with Docker, on your own infrastructure, with your own data. There is no hosted tier, no billing, no trade limits, and no anonymous "try it" mode baked into this codebase — every feature here is available to every account.

---

## Core Principles

- **Simplicity first** — The system records trades and shows profit or loss without additional interpretation.
- **Trade-centric** — Buy and sell executions are the primary unit of data.
- **Data ownership** — You run the database; export your data to CSV at any time.
- **A real API** — Every action available in the UI is available via the REST API with your own personal access token.

---

## What the Application Does

- Records crypto buy and sell trades across one or more accounts/portfolios
- Tracks quantity, price, fees, and timestamps
- Calculates realized gross and net P&L automatically (average-cost method)
- Bulk-imports trades from CSV (with duplicate detection)
- Exports the full ledger to CSV
- Supports email/password auth with email verification and password reset
- Issues personal access tokens for scripting against the API
- Seeds an optional sample "Demo Portfolio" account for exploring the app

---

## Deployment Model

Self-hosted only, via Docker Compose:

```bash
make up      # start everything
make db-migrate
```

See [SETUP.md](./SETUP.md) for full instructions.

---

## Technical Stack

- **Frontend:** React + TypeScript + Vite + Tailwind CSS + DaisyUI
- **Backend:** Node.js + Express + TypeScript
- **Database:** PostgreSQL + Prisma ORM
- **Runtime:** Docker + Docker Compose

---

## Target Audience

- Crypto traders who want a private, accurate trade log they fully control
- Developers who want to script against their trade history via a real API
- Anyone who'd rather self-host than hand their trade data to a third party
