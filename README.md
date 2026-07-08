# MyTradeLedger

MyTradeLedger is a simple, local-first crypto trade logging application. It allows you to record buy and sell trades, view them chronologically, and see cumulative profit or loss over time without unnecessary complexity.

The project is designed for traders who want a clear record of what trades were made and how their account is performing, while keeping full control over their data.

---

## Key Features

- Log crypto **BUY** and **SELL** trades
- Track quantity, price, fees, and timestamps
- Automatic gross and net realized P&L (average-cost method)
- Clean, table-first interface
- Support for multiple accounts or portfolios
- Bulk CSV import (with duplicate detection) and CSV export
- One-click "Load Demo Account" to explore the app with sample trades
- Email/password auth (no email verification or password-reset flow — self-hosted, no email server assumed)
- Personal access tokens for scripting against a real REST API
- Runs locally with Docker — no external services required

---

## Screenshots

### Dashboard
Overview of all accounts with P&L summaries, holdings, and recent activity.

### Ledger
Chronological trade log with filtering by account, asset, and entry type. Color-coded entries show gains (green) and losses (red).

### Accounts
Manage multiple trading accounts with individual P&L tracking.

---

## Philosophy

MyTradeLedger focuses on clarity and accuracy rather than analysis or interpretation.

The goal is to answer a simple question:

> *What trades have I made, and am I making or losing money?*

There are no analytics charts, scores, or performance labels — just account summaries, a
chronological record of trades, and their financial results.

---

## Quick Start

This project uses a **Docker-first** development approach. No local Node.js installation required.

### Prerequisites

- Docker
- Docker Compose
- Make (optional, but recommended)

### Start the Application

```bash
# Clone the repository
git clone git@github.com:trpsbill/mytradeledger.git
cd mytradeledger

# Start all services
make dev

# Or without make:
docker compose up
```

### Initialize the Database

On first run (or after pulling schema changes):

```bash
make db-migrate
```

### Access the Application

Once running:
- **Frontend:** http://localhost:5173
- **API:** http://localhost:3000
- **Database:** localhost:5433

---

## Application Pages

### Dashboard (`/app`)
- Account summary cards with gross/net P&L and fees
- Recent ledger activity with edit/delete
- Add new trades or import a CSV directly from the dashboard
- Export to CSV

### Accounts (`/app/accounts`)
- List all trading accounts
- Create, edit, archive, and delete accounts
- View P&L per account
- Toggle archived accounts visibility

### Ledger (`/app/ledger`)
- Chronological list of all ledger entries
- Filter by symbol or entry type
- Create new entries with auto-calculated values
- Entry types: BUY, SELL
- Edit and delete existing entries, or clear the whole ledger
- P&L automatically calculated for SELL entries

### API Tokens (`/app/settings/tokens`)
- Generate and revoke personal access tokens for API access

### Docs (`/docs`)
- Full public documentation, including a live API reference — no login required

---

## Development Commands

All commands run inside Docker containers. Use `make help` to see all available commands.

### Starting & Stopping

```bash
make dev          # Start all services (foreground)
make up-d         # Start all services (background)
make down         # Stop all services
make logs         # Follow all logs
make logs-server  # Follow server logs only
make logs-client  # Follow client logs only
```

### Building

```bash
make build        # Build all containers
make rebuild      # Rebuild without cache (after dependency changes)
```

### Database

```bash
make db-push      # Push schema changes to database
make db-migrate   # Run migrations
make db-studio    # Open Prisma Studio (database GUI)
make db-reset     # Reset database (WARNING: deletes all data)
```

### Shell Access

```bash
make shell-server  # Open shell in server container
make shell-client  # Open shell in client container
make shell-db      # Open psql in database container
```

### Cleanup

```bash
make clean        # Stop containers and remove volumes
```

---

## Project Structure

```
mytradeledger/
├── client/                     # React frontend
│   ├── src/
│   │   ├── components/         # Shared UI components
│   │   │   ├── Layout.tsx      # App shell with navigation
│   │   │   ├── Modal.tsx       # Modal dialogs
│   │   │   ├── ConfirmDialog.tsx
│   │   │   └── ...
│   │   ├── pages/              # Application pages
│   │   │   ├── Dashboard/      # Home page with trade log
│   │   │   ├── Accounts/       # Account management
│   │   │   └── Ledger/         # Full ledger view
│   │   ├── services/           # API client
│   │   ├── hooks/              # Custom React hooks
│   │   └── types/              # TypeScript definitions
│   ├── package.json
│   ├── vite.config.js
│   └── tailwind.config.js
│
├── server/                     # Node.js backend
│   ├── src/
│   │   ├── routes/             # API route definitions
│   │   ├── controllers/        # Request handlers
│   │   ├── services/           # Business logic
│   │   ├── middleware/         # Auth, rate limiting, PoW challenge
│   │   ├── import/             # CSV import pipeline (parse, preview, commit)
│   │   ├── db/                 # Database client
│   │   └── types/              # TypeScript definitions
│   ├── prisma/
│   │   └── schema.prisma       # Database schema
│   └── package.json
│
├── docker/                     # Docker configuration
│   ├── client.Dockerfile
│   ├── client.dev.Dockerfile
│   ├── server.Dockerfile
│   ├── server.dev.Dockerfile
│   └── nginx.conf
│
├── docs/                       # Documentation
│   ├── API.md                  # API reference
│   ├── SCHEMA.md               # Database schema
│   ├── SETUP.md                # Setup guide
│   └── PROJECT.md              # Project definition
│
├── docker-compose.yml          # Everything you need (make up)
└── Makefile                    # Development commands
```

---

## Tech Stack

- **Frontend:** React, TypeScript, Vite, Tailwind CSS, DaisyUI
- **Backend:** Node.js, Express, TypeScript
- **Database:** PostgreSQL, Prisma ORM
- **Runtime:** Docker, Docker Compose

---

## API Overview

Every endpoint except `/api/health` and auth registration/login requires a Bearer token — either your
session JWT or a personal access token from Settings → API Tokens.

| Endpoint | Description |
|----------|-------------|
| `POST /api/auth/register` / `/api/auth/login` | Create an account / get a session token |
| `GET /api/accounts` | List all accounts |
| `GET /api/accounts/:id/balance` | Get balances by symbol |
| `GET /api/accounts/:id/pnl` | Get gross/net profit or loss |
| `GET /api/ledger` | List ledger entries (with filters) |
| `POST /api/ledger` | Create ledger entry |
| `POST /api/import/preview` / `/api/import/commit` | Preview and commit a CSV import |
| `GET /api/ledger/export/csv` | Export to CSV |
| `GET /api/auth/tokens` / `POST /api/auth/tokens` | List / create personal access tokens |
| `POST /api/accounts/demo` | Seed a sample account with demo trades |

### Example: Add a Trade

```bash
curl -X POST http://localhost:3000/api/ledger \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "symbol": "BTC/USD",
    "entryType": "BUY",
    "quantity": "0.5",
    "price": "45000",
    "fee": "22.50"
  }'
```

See [API Reference](docs/API.md) for complete documentation, or the live docs at `/docs/api/*`.

---

## Deployment

- Runs entirely on your own machine or server
- No cloud dependencies, no external services required
- Free to use, no trade limits
- Uses Docker and Docker Compose

---

## Running It Long-Term

```bash
# Build and start in the background
docker compose up --build -d
```

The client is reachable on `:5173` and the API on `:3000` (see `docker-compose.yml` for the exact
port mappings). Put your own reverse proxy (nginx, Caddy, Traefik) in front if you want a domain
name or TLS — nothing in this repo assumes one.

---

## Data Ownership & Export

Your data is always yours.

All trades can be exported to CSV using a stable, predictable format suitable for spreadsheets, scripts, or external analysis tools.

---

## Documentation

- [Setup Guide](docs/SETUP.md) - Detailed setup and development instructions
- [API Reference](docs/API.md) - REST API endpoints and contracts
- [Database Schema](docs/SCHEMA.md) - Database design and entity definitions
- [Project Definition](docs/PROJECT.md) - Project goals and specifications

---

## Project Status

MyTradeLedger is under active development. Features and structure may evolve, but the core focus on simplicity, transparency, and data ownership will remain.

---

## Who This Is For

- Crypto traders who want a clean, private trade log they fully control
- Users who prefer simple gross/net profit-loss tracking
- Developers who want to script against their trade history via a real API
- Anyone who'd rather self-host than hand their trade data to a third party

---

## Roadmap (High-Level)

- [x] Core ledger functionality
- [x] Account management
- [x] Gross/net P&L calculations (average cost method)
- [x] CSV import and export
- [x] Email/password auth
- [x] Personal access tokens
- [x] Light/dark theme
- [ ] Ongoing usability refinements

---

## License

License details will be added prior to the first public release.

---

**MyTradeLedger**
*A simple crypto trade log. Clear data. No noise.*
