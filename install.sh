#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT"

# ── Prerequisites ─────────────────────────────────────────────────────────────

command -v docker >/dev/null 2>&1 || { echo "Error: Docker is not installed."; exit 1; }
docker compose version >/dev/null 2>&1 || { echo "Error: Docker Compose plugin is not installed."; exit 1; }

# ── Environment ───────────────────────────────────────────────────────────────

if [ ! -f .env ]; then
  cp .env.dist .env
  echo "Created .env from .env.dist."
  echo ""
  echo "Fill in the required values before continuing:"
  echo "  DB_PASSWORD   — database password"
  echo "  JWT_SECRET    — run: openssl rand -hex 64"
  echo "  ALLOWED_ORIGINS — e.g. https://yourdomain.com"
  echo "  APP_URL         — e.g. https://yourdomain.com"
  echo ""
  echo "Then re-run: bash install.sh"
  exit 0
fi

set -a; source .env; set +a

error=0
for var in DB_PASSWORD JWT_SECRET; do
  val="${!var:-}"
  if [ -z "$val" ] || [ "$val" = "change_me" ]; then
    echo "Error: $var is not configured in .env"
    error=1
  fi
done
for var in ALLOWED_ORIGINS APP_URL; do
  val="${!var:-}"
  if [ -z "$val" ]; then
    echo "Error: $var is not configured in .env"
    error=1
  fi
done
[ "$error" -eq 1 ] && exit 1

DB_CONTAINER="${DB_CONTAINER:-merchant-companion_db}"
DB_USER="${DB_USER:-merchant-companion}"
DB_NAME="${DB_NAME:-merchant-companion}"

# ── Build and start ───────────────────────────────────────────────────────────

echo "Building and starting containers..."
docker compose -f docker-compose.prod.yml up --build -d

# ── Wait for DB ───────────────────────────────────────────────────────────────

echo "Waiting for database..."
until docker exec "$DB_CONTAINER" pg_isready -U "$DB_USER" -q 2>/dev/null; do
  sleep 1
done

# ── Wait for migrations (API runs prisma migrate deploy on startup) ────────────

echo "Waiting for migrations..."
until docker exec "$DB_CONTAINER" \
  psql -U "$DB_USER" -d "$DB_NAME" -c "SELECT 1 FROM _prisma_migrations LIMIT 1" >/dev/null 2>&1; do
  sleep 2
done

# ── Seed game data ────────────────────────────────────────────────────────────

echo "Seeding game data..."
docker exec -i "$DB_CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" < seed.sql

echo ""
echo "Installation complete. App is running at: ${APP_URL}"
