#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT"

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
[ -f .env ] && load_env

DB_CONTAINER="${DB_CONTAINER:-merchant-companion_db}"
DB_USER="${DB_USER:-merchant-companion}"
DB_NAME="${DB_NAME:-merchant-companion}"
API_CONTAINER="${API_CONTAINER:-merchant-companion_api}"

# ── Detect legacy setup.sql installs (no migration history) ───────────────────
# If tables exist but _prisma_migrations doesn't, we need to baseline the first
# migration so that prisma migrate deploy doesn't try to re-create existing tables.

NEEDS_BASELINE=false
if docker exec "$DB_CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" \
     -c "SELECT 1 FROM _prisma_migrations LIMIT 1" >/dev/null 2>&1; then
  : # migration history found — nothing special needed
else
  TABLE_COUNT=$(docker exec "$DB_CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" -tAc \
    "SELECT count(*) FROM information_schema.tables WHERE table_schema='public'" \
    2>/dev/null | tr -d ' \n' || echo 0)
  [ "${TABLE_COUNT:-0}" -gt "0" ] && NEEDS_BASELINE=true
fi

# ── Pull and rebuild ──────────────────────────────────────────────────────────

echo "Pulling latest changes..."
git pull

echo "Building and restarting containers..."
docker compose -f docker-compose.prod.yml up --build -d

# ── Wait for database ─────────────────────────────────────────────────────────

echo "Waiting for database..."
until docker exec "$DB_CONTAINER" pg_isready -U "$DB_USER" -q 2>/dev/null; do
  sleep 1
done

# ── Wait for API container ────────────────────────────────────────────────────

until docker exec "$API_CONTAINER" true 2>/dev/null; do
  sleep 1
done

# ── Baseline if upgrading from setup.sql (runs only once) ────────────────────

if $NEEDS_BASELINE; then
  echo "Baselining existing database..."
  FIRST=$(docker exec "$API_CONTAINER" ls /app/prisma/migrations/ 2>/dev/null | sort | head -1 || true)
  if [ -n "$FIRST" ]; then
    docker exec "$API_CONTAINER" pnpm exec prisma migrate resolve --applied "$FIRST"
  fi
fi

# ── Apply pending migrations ──────────────────────────────────────────────────

echo "Applying migrations..."
docker exec "$API_CONTAINER" pnpm prisma:deploy

# ── Seed game data ────────────────────────────────────────────────────────────

echo "Seeding game data..."
docker exec -i "$DB_CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" < seed.sql

echo ""
echo "Done."
