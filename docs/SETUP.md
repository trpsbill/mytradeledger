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

## Running Without Docker

If you prefer to run the application locally without Docker, you'll need Node.js 18+ and a PostgreSQL database.

### Prerequisites

- Node.js 18+
- PostgreSQL 16+ (running on port 5432 or 5433)
- npm or yarn

### Setup

1. **Start PostgreSQL** and create the database:
   ```bash
   createdb mytradeledger
   ```

2. **Set up the server:**
   ```bash
   cd server
   cp ../.env.example .env
   # Edit .env to set DATABASE_URL to your PostgreSQL connection string
   npm install
   npx prisma db push
   npm run dev
   ```

3. **Set up the client** (in a new terminal):
   ```bash
   cd client
   npm install
   npm run dev
   ```

4. **Access the application:**
   - Client: http://localhost:5173
   - API: http://localhost:3000

The client defaults to proxying API requests to `http://localhost:3000`. If your server runs on a different port, set `VITE_API_URL` before starting the client:
```bash
VITE_API_URL=http://localhost:4000 npm run dev
```

## Production Deployment

```bash
# Build and start production containers
docker compose up --build -d
```

The application will be available at http://localhost:80.

## Environment Variables

### Server Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection string | (required) |
| `PORT` | Server port | `3000` |
| `NODE_ENV` | Environment mode | `development` |

### Client Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `VITE_API_URL` | API server URL for dev proxy | `http://localhost:3000` |

### Configuration by Environment

**Docker (recommended):** Environment variables are pre-configured in `docker-compose.dev.yml`. No manual setup required.

**Local development (without Docker):**

1. Copy the example environment file:
   ```bash
   cp .env.example server/.env
   ```

2. For the client, the default `VITE_API_URL` is `http://localhost:3000`, which works for local development. If you need to override it, create `client/.env`:
   ```bash
   echo "VITE_API_URL=http://localhost:3000" > client/.env
   ```

See `.env.example` for all available options with detailed comments.

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/health` | Health check |
| GET | `/api/accounts` | List accounts |
| GET | `/api/ledger` | List ledger entries |
