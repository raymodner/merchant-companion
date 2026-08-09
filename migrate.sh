#!/usr/bin/env bash
# Usage: bash migrate.sh <migration_name>
# Creates a new Prisma migration from the current schema.prisma and copies
# the generated files to the host (Docker Desktop doesn't sync new directories).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT"

NAME="${1:-}"
if [ -z "$NAME" ]; then
  echo "Usage: bash migrate.sh <migration_name>"
  echo "Example: bash migrate.sh add_notes_to_settlements"
  exit 1
fi

API_CONTAINER="${API_CONTAINER:-merchant-companion_api}"

echo "Running migration: $NAME"
docker exec "$API_CONTAINER" pnpm exec prisma migrate dev --name "$NAME"

echo "Copying migration files to host..."
docker cp "$API_CONTAINER":/app/prisma/migrations/. backend/prisma/migrations/

echo ""
echo "Migration complete. Commit the new files in backend/prisma/migrations/ and push."
