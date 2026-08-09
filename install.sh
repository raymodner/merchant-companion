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
  echo "  DB_PASSWORD     — database password"
  echo "  JWT_SECRET      — run: openssl rand -hex 64"
  echo "  ALLOWED_ORIGINS — e.g. https://yourdomain.com"
  echo "  APP_URL         — e.g. https://yourdomain.com"
  echo ""
  echo "Then re-run: bash install.sh"
  exit 0
fi

load_env() {
  while IFS= read -r line || [ -n "$line" ]; do
    line="${line#"${line%%[![:space:]]*}"}"
    [[ -z "$line" || "$line" == \#* ]] && continue
    line="${line%%[[:space:]]#*}"
    [[ "$line" == *=* ]] || continue
    local key="${line%%=*}"
    local val="${line#*=}"
    if [[ "$val" == '"'*'"' ]]; then val="${val:1:${#val}-2}"
    elif [[ "$val" == "'"*"'" ]]; then val="${val:1:${#val}-2}"; fi
    export "$key=$val"
  done < .env
}
load_env

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
API_CONTAINER="${API_CONTAINER:-merchant-companion_api}"

# ── Build and start ───────────────────────────────────────────────────────────

echo "Building and starting containers..."
docker compose -f docker-compose.prod.yml up --build -d

# ── Wait for database ─────────────────────────────────────────────────────────

echo "Waiting for database..."
until docker exec "$DB_CONTAINER" pg_isready -U "$DB_USER" -q 2>/dev/null; do
  sleep 1
done

# ── Wait for API container ────────────────────────────────────────────────────

echo "Waiting for API..."
until docker exec "$API_CONTAINER" true 2>/dev/null; do
  sleep 1
done

# ── Apply schema via migrations ───────────────────────────────────────────────

echo "Applying migrations..."
docker exec "$API_CONTAINER" pnpm prisma:deploy

# ── Seed game data ────────────────────────────────────────────────────────────

echo "Seeding game data..."
docker exec -i "$DB_CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" < seed.sql

echo ""
echo "Installation complete. App is running at: ${APP_URL}"
