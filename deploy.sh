#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT"

echo "Pulling latest changes..."
git pull

echo "Building and restarting containers..."
docker compose -f docker-compose.prod.yml up --build -d

echo "Done. Pending migrations will apply automatically on API startup."
