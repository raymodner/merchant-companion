#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT"

# ── Prerequisites ──────────────────────────────────────────────────────────────

command -v docker >/dev/null 2>&1 || { echo "Error: Docker is not installed."; exit 1; }
docker compose version >/dev/null 2>&1 || { echo "Error: Docker Compose plugin is not installed."; exit 1; }

# ── Helpers ────────────────────────────────────────────────────────────────────

ask() {
  local prompt="$1" val
  if [ "${2+set}" = "set" ]; then
    local default="${2:-}"
    read -rp "$prompt${default:+ [$default]}: " val
    echo "${val:-$default}"
  else
    while true; do
      read -rp "$prompt: " val
      [ -n "$val" ] && break
      echo "  This field is required." >&2
    done
    echo "$val"
  fi
}

ask_secret() {
  local prompt="$1" var
  while true; do
    read -rsp "$prompt: " var; echo >&2
    [ -n "$var" ] && break
    echo "  This field is required." >&2
  done
  echo "$var"
}

ask_bool() {
  local prompt="$1" default="${2:-y}"
  local val
  read -rp "$prompt [${default}]: " val
  val="${val:-$default}"
  [[ "$val" =~ ^[Yy] ]] && echo "true" || echo "false"
}

write_env() {
  local key="$1" val="$2"
  if grep -q "^${key}=" .env 2>/dev/null; then
    sed -i.bak "s|^${key}=.*|${key}=${val}|" .env && rm -f .env.bak
  else
    echo "${key}=${val}" >> .env
  fi
}

# ── Existing .env ──────────────────────────────────────────────────────────────

if [ -f .env ]; then
  echo ""
  echo "An .env file already exists."
  read -rp "Reconfigure it? [y/N]: " reconfigure
  if [[ ! "$reconfigure" =~ ^[Yy] ]]; then
    echo "Keeping existing .env. Proceeding with install..."
    echo ""
  else
    rm .env
  fi
fi

# ── Interactive setup ──────────────────────────────────────────────────────────

if [ ! -f .env ]; then
  cp .env.dist .env
  chmod 600 .env

  echo ""
  echo "╔══════════════════════════════════════╗"
  echo "║     Merchant Companion — Setup       ║"
  echo "╚══════════════════════════════════════╝"
  echo ""

  # Domain
  echo "── Server ───────────────────────────────"
  APP_URL=$(ask "Public URL of your site (e.g. https://yourdomain.com)")
  APP_URL="${APP_URL%/}"
  write_env "APP_URL" "$APP_URL"
  write_env "ALLOWED_ORIGINS" "$APP_URL"
  write_env "NODE_ENV" "production"
  if [[ "$APP_URL" == https://* ]]; then
    write_env "COOKIE_SECURE" "true"
  else
    write_env "COOKIE_SECURE" "false"
    echo "  Note: APP_URL isn't https:// — login cookies will be set as non-secure."
  fi

  # Database
  echo ""
  echo "── Database ─────────────────────────────"
  DB_PASSWORD=$(ask_secret "Database password (choose a strong password)")
  write_env "DB_PASSWORD" "$DB_PASSWORD"

  # JWT
  echo ""
  echo "── Security ─────────────────────────────"
  JWT_SECRET=$(openssl rand -hex 64 2>/dev/null || cat /dev/urandom | tr -dc 'a-f0-9' | head -c 128)
  write_env "JWT_SECRET" "$JWT_SECRET"
  echo "  JWT secret auto-generated."

  # Registration
  echo ""
  echo "── Registration ─────────────────────────"
  REGISTRATION_OPEN=$(ask_bool "Allow public registration? (anyone can sign up)" "y")
  write_env "REGISTRATION_OPEN" "$REGISTRATION_OPEN"

  if [ "$REGISTRATION_OPEN" = "false" ]; then
    echo "  You can restrict sign-ups to specific emails:"
    ALLOWLIST=$(ask "Allowlist emails (comma-separated, or leave blank to disable all registration)" "")
    [ -n "$ALLOWLIST" ] && write_env "REGISTRATION_ALLOWLIST" "$ALLOWLIST"
  fi

  # Features
  echo ""
  echo "── Features ─────────────────────────────"
  STAR_EDITING=$(ask_bool "Allow users to edit community star ratings?" "y")
  write_env "STAR_EDITING" "$STAR_EDITING"

  PUBLIC_SETTLEMENTS_REQUIRE_AUTH=$(ask_bool "Require login to see public settlements?" "n")
  write_env "PUBLIC_SETTLEMENTS_REQUIRE_AUTH" "$PUBLIC_SETTLEMENTS_REQUIRE_AUTH"

  # Visibility modes
  echo ""
  echo "── Visibility modes ─────────────────────"
  SHARED_PAINT=$(ask_bool "Terrain paint: one shared map for everyone?" "y")
  write_env "SHARED_PAINT" "$SHARED_PAINT"

  SHARED_TRIBE_MARKERS=$(ask_bool "Tribe markers: visible to everyone (not just their placer)?" "n")
  write_env "SHARED_TRIBE_MARKERS" "$SHARED_TRIBE_MARKERS"

  SHARED_RATINGS=$(ask_bool "Resource star ratings: one shared rating for everyone?" "y")
  write_env "SHARED_RATINGS" "$SHARED_RATINGS"

  # Contact (optional)
  echo ""
  echo "── Contact info (shown in Terms & Privacy) ──"
  echo "  Press Enter to skip any of these."
  CONTACT_NAME=$(ask "Your name or handle" "")
  [ -n "$CONTACT_NAME" ] && write_env "CONTACT_NAME" "$CONTACT_NAME"

  CONTACT_DISCORD=$(ask "Discord URL" "https://discord.gg/ytmhADQZP5")
  [ -n "$CONTACT_DISCORD" ] && write_env "CONTACT_DISCORD" "$CONTACT_DISCORD"

  CONTACT_EMAIL=$(ask "Contact email" "")
  [ -n "$CONTACT_EMAIL" ] && write_env "CONTACT_EMAIL" "$CONTACT_EMAIL"

  if [ -z "$CONTACT_DISCORD" ] && [ -z "$CONTACT_EMAIL" ]; then
    echo "  Warning: no contact method set. At least one is recommended for the Terms & Privacy pages."
  fi

  echo ""
  echo "Configuration saved to .env"
  echo ""
fi

# ── Load env ───────────────────────────────────────────────────────────────────

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
for var in DB_PASSWORD JWT_SECRET ALLOWED_ORIGINS APP_URL; do
  val="${!var:-}"
  if [ -z "$val" ] || [ "$val" = "change_me" ]; then
    echo "Error: $var is not set in .env"
    error=1
  fi
done
[ "$error" -eq 1 ] && exit 1

DB_CONTAINER="${DB_CONTAINER:-merchant-companion_db}"
DB_USER="${DB_USER:-merchant-companion}"
DB_NAME="${DB_NAME:-merchant-companion}"
API_CONTAINER="${API_CONTAINER:-merchant-companion_api}"

# ── Build and start ────────────────────────────────────────────────────────────

echo "Building and starting containers..."
docker compose -f docker-compose.prod.yml up --build -d

# ── Wait for database ──────────────────────────────────────────────────────────

echo "Waiting for database..."
until docker exec "$DB_CONTAINER" pg_isready -U "$DB_USER" -q 2>/dev/null; do
  sleep 1
done

# ── Wait for API ───────────────────────────────────────────────────────────────

echo "Waiting for API..."
until docker exec "$API_CONTAINER" true 2>/dev/null; do
  sleep 1
done

# ── Migrations ─────────────────────────────────────────────────────────────────

echo "Applying migrations..."
docker exec "$API_CONTAINER" pnpm prisma:deploy

# ── Seed ──────────────────────────────────────────────────────────────────────

echo "Seeding game data..."
docker exec -i "$DB_CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" < seed.sql

echo ""
echo "✓ Installation complete. App is running at: ${APP_URL}"
