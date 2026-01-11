# MyTradeLedger

MyTradeLedger is a simple, local-first crypto trade logging application. It allows you to record buy and sell trades, view them chronologically, and see cumulative profit or loss over time without unnecessary complexity.

The project is designed for traders who want a clear record of what trades were made and how their account is performing, while keeping full control over their data.

---

## Key Features

- Log crypto **BUY** and **SELL** trades
- Track quantity, price, fees, and timestamps
- View cumulative profit or loss over time
- Clean, table-first interface
- Export all trade data to CSV
- Support for multiple accounts or portfolios
- Runs locally with Docker
- Optional hosted version for convenience

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
- **Client:** http://localhost:5173
- **Server:** http://localhost:3000
- **Database:** localhost:5433

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
│   │   ├── components/         # Reusable UI components
│   │   ├── pages/              # Page components
│   │   ├── services/           # API client functions
│   │   ├── hooks/              # Custom React hooks
│   │   └── types/              # TypeScript type definitions
│   ├── package.json
│   ├── vite.config.ts
│   └── tailwind.config.js
│
├── server/                     # Node.js backend
│   ├── src/
│   │   ├── routes/             # API route definitions
│   │   ├── controllers/        # Request handlers
│   │   ├── services/           # Business logic
│   │   └── middleware/         # Express middleware
│   ├── prisma/
│   │   └── schema.prisma       # Database schema
│   └── package.json
│
├── docker/                     # Docker configuration
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

- Initial self-hosted release
- CSV export improvements
- Hosted deployment
- Basic authentication for hosted version
- Ongoing usability refinements

---

## License

License details will be added prior to the first public release.

---

**MyTradeLedger**
*A simple crypto trade log. Clear data. No noise.*
