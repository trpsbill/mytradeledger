# MyTradeLedger

MyTradeLedger is a simple, local-first crypto trade logging application. It allows you to record buy and sell trades, view them chronologically, and see cumulative profit or loss over time without unnecessary complexity.

The project is designed for traders who want a clear record of what trades were made and how their account is performing, while keeping full control over their data.

---

## Key Features

- Log crypto **BUY** and **SELL** trades
- Track quantity, price, fees, and timestamps
- View cumulative profit or loss over time
- Clean, table-first interface
- Support for multiple accounts or portfolios
- Export all trade data to CSV
- Runs locally with Docker
- Optional hosted version for convenience

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

There are no dashboards, scores, or performance labels. Just a clear, chronological record of trades and their financial results.

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
docker compose -f docker-compose.dev.yml up
```

### Initialize the Database

On first run (or after schema changes):

```bash
make db-push
```

### Access the Application

Once running:
- **Frontend:** http://localhost:5173
- **API:** http://localhost:3000
- **Database:** localhost:5433

---

## Application Pages

### Dashboard (`/`)
- Account summary cards with P&L
- Recent ledger activity with edit/delete
- Add new trades directly from dashboard
- Export to CSV

### Accounts (`/accounts`)
- List all trading accounts
- Create, edit, archive, and delete accounts
- View P&L per account
- Toggle archived accounts visibility

### Ledger (`/ledger`)
- Chronological list of all ledger entries
- Filter by symbol or entry type
- Create new entries with auto-calculated values
- Entry types: BUY, SELL
- Edit and delete existing entries
- P&L automatically calculated for SELL entries

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
│   ├── vite.config.ts
│   └── tailwind.config.js
│
├── server/                     # Node.js backend
│   ├── src/
│   │   ├── routes/             # API route definitions
│   │   ├── controllers/        # Request handlers
│   │   ├── services/           # Business logic
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
├── docker-compose.yml          # Production deployment
├── docker-compose.dev.yml      # Development environment
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

| Endpoint | Description |
|----------|-------------|
| `GET /api/accounts` | List all accounts |
| `GET /api/accounts/:id/balance` | Get balances by symbol |
| `GET /api/accounts/:id/pnl` | Get profit/loss |
| `GET /api/ledger` | List ledger entries (with filters) |
| `POST /api/ledger` | Create ledger entry |
| `GET /api/ledger/export/csv` | Export to CSV |

### Example: Add a Trade

```bash
curl -X POST http://localhost:3000/api/ledger \
  -H "Content-Type: application/json" \
  -d '{
    "symbol": "BTC/USD",
    "entryType": "BUY",
    "quantity": "0.5",
    "price": "45000",
    "fee": "22.50"
  }'
```

See [API Reference](docs/API.md) for complete documentation.

---

## Deployment Options

### Self-Hosted

- Runs entirely on your own machine
- No cloud dependencies
- Ideal for users who want full control
- Free to use
- Uses Docker and Docker Compose

### Hosted (Optional)

- Fully managed online version
- No setup required
- Accessible from any browser
- Simple monthly subscription (planned, approximately $5 USD)
- Same core functionality as the self-hosted version

---

## Production Deployment

```bash
# Build and start production containers
docker compose up --build -d
```

The application will be available at http://localhost:80.

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

- Crypto traders who want a clean trade log
- Users who prefer simple profit/loss tracking
- Developers and technical users who like self-hosted tools
- Anyone who wants an easy hosted option without complexity

---

## Roadmap (High-Level)

- [x] Core ledger functionality
- [x] Account management
- [x] P&L calculations (average cost method)
- [x] CSV export
- [x] Light/dark theme
- [ ] Hosted deployment
- [ ] Basic authentication for hosted version
- [ ] Ongoing usability refinements

---

## License

License details will be added prior to the first public release.

---

**MyTradeLedger**
*A simple crypto trade log. Clear data. No noise.*
