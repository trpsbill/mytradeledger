.PHONY: help dev up down build rebuild logs clean db-migrate db-push db-studio db-reset shell-server shell-client shell-db

# Default target
help:
	@echo "MyTradeLedger - Docker-first Development"
	@echo ""
	@echo "Usage: make [target]"
	@echo ""
	@echo "Development:"
	@echo "  dev          Start all services (alias for 'up')"
	@echo "  up           Start all services in foreground"
	@echo "  up-d         Start all services in background"
	@echo "  down         Stop all services"
	@echo "  logs         Follow logs from all services"
	@echo "  logs-server  Follow server logs only"
	@echo "  logs-client  Follow client logs only"
	@echo ""
	@echo "Build:"
	@echo "  build        Build all containers"
	@echo "  rebuild      Rebuild all containers (no cache)"
	@echo ""
	@echo "Database:"
	@echo "  db-migrate   Run Prisma migrations"
	@echo "  db-push      Push schema to database (dev)"
	@echo "  db-studio    Open Prisma Studio"
	@echo "  db-reset     Reset database (WARNING: deletes data)"
	@echo ""
	@echo "Shell Access:"
	@echo "  shell-server Open shell in server container"
	@echo "  shell-client Open shell in client container"
	@echo "  shell-db     Open psql in database container"
	@echo ""
	@echo "Cleanup:"
	@echo "  clean        Stop containers and remove volumes"

# Development
dev: up

up:
	docker compose -f docker-compose.dev.yml up

up-d:
	docker compose -f docker-compose.dev.yml up -d

down:
	docker compose -f docker-compose.dev.yml down

logs:
	docker compose -f docker-compose.dev.yml logs -f

logs-server:
	docker compose -f docker-compose.dev.yml logs -f server

logs-client:
	docker compose -f docker-compose.dev.yml logs -f client

# Build
build:
	docker compose -f docker-compose.dev.yml build

rebuild:
	docker compose -f docker-compose.dev.yml build --no-cache

# Database
db-migrate:
	docker compose -f docker-compose.dev.yml exec server npx prisma migrate dev

db-push:
	docker compose -f docker-compose.dev.yml exec server npx prisma db push

db-studio:
	@echo "Starting Prisma Studio on http://localhost:5555"
	docker compose -f docker-compose.dev.yml exec server npx prisma studio

db-reset:
	@echo "WARNING: This will delete all data!"
	@read -p "Are you sure? [y/N] " confirm && [ "$$confirm" = "y" ] || exit 1
	docker compose -f docker-compose.dev.yml exec server npx prisma migrate reset

# Shell access
shell-server:
	docker compose -f docker-compose.dev.yml exec server sh

shell-client:
	docker compose -f docker-compose.dev.yml exec client sh

shell-db:
	docker compose -f docker-compose.dev.yml exec db psql -U postgres -d mytradeledger

# Cleanup
clean:
	docker compose -f docker-compose.dev.yml down -v
