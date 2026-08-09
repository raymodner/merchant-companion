#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"

# Load root .env
if [ -f "$ROOT/.env" ]; then
  set -a; source "$ROOT/.env"; set +a
fi

CONTAINER="${DB_CONTAINER:-merchant-companion_db}"
DB_USER="${DB_USER:?DB_USER not set — copy .env.dist to .env}"
DB_NAME="${DB_NAME:?DB_NAME not set — copy .env.dist to .env}"
MIGRATIONS_DIR="$ROOT/migrations"

run_sql() {
  docker exec -i "$CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" "$@"
}

# Create migrations tracking table if it doesn't exist
run_sql -c "CREATE TABLE IF NOT EXISTS schema_migrations (
  name       TEXT        PRIMARY KEY,
  applied_at TIMESTAMPTZ DEFAULT NOW()
);" > /dev/null

# Collect all migration files in sorted order
shopt -s nullglob
files=("$MIGRATIONS_DIR"/*.sql)
shopt -u nullglob

if [ ${#files[@]} -eq 0 ]; then
  echo "No migration files found in migrations/."
  exit 0
fi

pending=()
for file in "${files[@]}"; do
  name=$(basename "$file")
  applied=$(run_sql -tAc "SELECT 1 FROM schema_migrations WHERE name = '$name'" 2>/dev/null || true)
  [ "$applied" != "1" ] && pending+=("$file")
done

if [ ${#pending[@]} -eq 0 ]; then
  echo "Nothing to migrate — all $(( ${#files[@]} )) migration(s) already applied."
  exit 0
fi

echo "Applying ${#pending[@]} of ${#files[@]} migration(s)..."
for file in "${pending[@]}"; do
  name=$(basename "$file")
  printf "  %-50s" "$name"
  run_sql < "$file" > /dev/null
  run_sql -c "INSERT INTO schema_migrations (name) VALUES ('$name');" > /dev/null
  echo "done"
done
echo "Migration complete."
