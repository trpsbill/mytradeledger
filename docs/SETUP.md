# MyTradeLedger - Project Setup

This project uses a **Docker-first** development approach. No local Node.js installation required.

## Prerequisites

- Docker
- Docker Compose
- Make (optional, but recommended)

## Quick Start

```bash
# Start everything
make dev

# Or without make:
docker compose -f docker-compose.dev.yml up
```

Once running:
- **Client:** http://localhost:5173
- **Server:** http://localhost:3000
- **Database:** localhost:5433 (internal: 5432)

## Project Structure

```
mytradeledger/
├── client/                     # React frontend
│   ├── src/
│   │   ├── components/         # Reusable UI components
│   │   ├── pages/              # Page components
│   │   ├── services/           # API client functions
│   │   ├── hooks/              # Custom React hooks
│   │   ├── types/              # TypeScript type definitions
│   │   ├── App.tsx             # Root component
│   │   ├── main.tsx            # Entry point
│   │   └── index.css           # Tailwind imports
│   ├── package.json
│   ├── vite.config.ts
│   ├── tailwind.config.js
│   └── tsconfig.json
│
├── server/                     # Node.js backend
│   ├── src/
│   │   ├── routes/             # API route definitions
│   │   ├── controllers/        # Request handlers
│   │   ├── services/           # Business logic
│   │   ├── middleware/         # Express middleware
│   │   ├── types/              # TypeScript type definitions
│   │   └── index.ts            # Express server entry point
│   ├── prisma/
│   │   └── schema.prisma       # Database schema
│   ├── package.json
│   └── tsconfig.json
│
├── docker/                     # Docker configuration
│   ├── client.Dockerfile       # Production client build
│   ├── client.dev.Dockerfile   # Development client
│   ├── server.Dockerfile       # Production server build
│   ├── server.dev.Dockerfile   # Development server
│   └── nginx.conf              # Production nginx config
│
├── docker-compose.yml          # Production deployment
├── docker-compose.dev.yml      # Development environment
├── Makefile                    # Development commands
└── .gitignore
```

## Tech Stack

- **Frontend:** React + TypeScript + Vite + Tailwind CSS + DaisyUI
- **Backend:** Node.js + Express + TypeScript
- **Database:** PostgreSQL + Prisma ORM
- **Deployment:** Docker + Docker Compose

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

## Initial Setup

1. **Clone and start:**
   ```bash
   git clone <repo-url>
   cd mytradeledger
   make dev
   ```

2. **Push database schema** (first time or after schema changes):
   ```bash
   make db-push
   ```

3. **Open in browser:**
   - Client: http://localhost:5173
   - API: http://localhost:3000/api/health

## Development Workflow

1. Edit source files in `client/src/` or `server/src/`
2. Changes hot-reload automatically
3. For dependency changes, run `make rebuild`
4. For schema changes, run `make db-push`

## Production Deployment

```bash
# Build and start production containers
docker compose up --build -d
```

The application will be available at http://localhost:80.

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Server port | 3000 |
| `NODE_ENV` | Environment | development |
| `DATABASE_URL` | PostgreSQL connection string | (set in docker-compose) |

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/health` | Health check |
| GET | `/api/accounts` | List accounts |
| GET | `/api/ledger` | List ledger entries |
