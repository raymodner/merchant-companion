# Merchant Companion

A collaborative map tool for tracking terrain, tribes, settlements, and resources. Built with Vue 3, Express 5, and PostgreSQL, running fully in Docker.

## Getting started

### Prerequisites

- Docker + Docker Compose

### Local development

```bash
cp .env.dist .env
# Edit .env with your values

docker compose up --build -d
```

- **Frontend**: http://localhost:5174
- **API**: http://localhost:3001

Frontend changes reload automatically via Vite HMR. After changing backend files:
```bash
docker compose restart api
```

After adding npm packages to either workspace:
```bash
docker compose down && docker compose up --build -d
```

### Environment variables

| Variable | Required | Default | Notes |
|---|---|---|---|
| `DB_NAME` | yes | — | Postgres database name |
| `DB_USER` | yes | — | Postgres user |
| `DB_PASSWORD` | yes | — | Postgres password |
| `JWT_SECRET` | yes | — | Generate: `openssl rand -hex 64` |
| `ALLOWED_ORIGINS` | yes | `http://localhost:5174` | Comma-separated allowed origins |
| `APP_URL` | prod only | — | Public URL, used by the prod compose |
| `MAX_TRIBE_MARKERS` | no | `50` | Tribe markers per user |
| `MAX_SETTLEMENTS` | no | `50` | Total settlements per user |
| `MAX_PUBLIC_SETTLEMENTS` | no | `10` | Public settlements per user |
| `STAR_EDITING` | no | `true` | Set to `false` to disable community star ratings |
| `PUBLIC_SETTLEMENTS_REQUIRE_AUTH` | no | `false` | Set to `true` to hide public settlements from guests |
| `REGISTRATION_OPEN` | no | `true` | Set to `false` to close registration |
| `REGISTRATION_ALLOWLIST` | no | — | Comma-separated emails; overrides `REGISTRATION_OPEN` |
| `CONTACT_NAME` | no | — | Shown in privacy policy |
| `CONTACT_DISCORD` | no | — | Discord invite URL, shown in privacy policy |
| `CONTACT_EMAIL` | no | — | Email address, shown in privacy policy |

## Running without Docker

### Prerequisites

- Node.js 20+
- pnpm 11+ (`npm install -g pnpm`)
- PostgreSQL 15+

### 1. Create a database

```sql
CREATE USER "merchant-companion" WITH PASSWORD 'yourpassword';
CREATE DATABASE "merchant-companion" OWNER "merchant-companion";
```

### 2. Configure the backend

```bash
cp backend/.env.dist backend/.env
# Edit backend/.env — set DATABASE_URL, JWT_SECRET, and ALLOWED_ORIGINS at minimum
```

### 3. Install dependencies

```bash
cd backend && pnpm install
```

### 4. Apply migrations and seed

```bash
pnpm prisma:generate
pnpm prisma:deploy
psql -U merchant-companion -d merchant-companion < ../seed.sql
```

### 5. Start the backend

```bash
pnpm start          # production
# or
pnpm dev            # development (restarts on file changes)
```

The API listens on port 3001 by default (set `PORT` in `.env` to change it).

### 6. Start the frontend

For **development**:

```bash
cd frontend && pnpm install && pnpm dev
```

Frontend is available at http://localhost:5173. Set `ALLOWED_ORIGINS=http://localhost:5173` in `backend/.env`.

For **production**, build the static files and serve them with any web server (nginx, Caddy, etc.):

```bash
cd frontend && pnpm install && pnpm build
# Output is in frontend/dist/
```

Point your web server at `frontend/dist/` and proxy `/api/` requests to the backend. See `frontend/nginx.conf` for a reference nginx configuration.

---

## Deploying to production

**First-time install:**
```bash
bash install.sh
```
Creates `.env` from `.env.dist` if it doesn't exist, guides you through required values, builds and starts all containers, waits for migrations, and seeds game data.

**Subsequent updates:**
```bash
bash deploy.sh
```
Pulls latest changes, rebuilds containers, applies any schema changes, and re-seeds game data. All idempotent — safe to run repeatedly.

The production compose builds the Vue app and serves it through nginx on port 8080. The API is not exposed directly; nginx reverse-proxies it.

### Schema changes

Schema is managed with Prisma Migrate. Migration files live in `backend/prisma/migrations/` and are applied automatically when `bash deploy.sh` runs.

**To make a schema change** (run on your dev machine, not the server):
```bash
# 1. Edit backend/prisma/schema.prisma
# 2. Generate, apply, and copy the migration files to the host
bash migrate.sh describe_your_change
# 3. Commit the generated migration file
git add backend/prisma/migrations/ && git commit -m "migration: describe_your_change"
```

`bash deploy.sh` on the server will pick it up and apply it.

## Architecture

```
frontend/    Vue 3 + Pinia + Vite SPA
backend/     Express 5 + Prisma + PostgreSQL
```

### Backend structure

```
backend/src/
  index.js            Middleware (helmet, cors, rate limiting) + route mounts
  auth.js             JWT cookie middleware
  prisma.js           PrismaClient singleton
  lib/
    config.js         Centralised config from env vars (limits, features, contact)
    validate.js       Zod middleware helpers: body(), uuidParam()
    resolvers.js      Cached DB lookups for terrain/tribe/resource types
    cleanup.js        Monthly job: removes superseded cell_paint rows
  routes/
    auth.js           register, login, /me, preferences, password, logout
    config.js         GET /config — public feature flags and limits
    lookup.js         GET /terrains, /tribes, /settlement-stages
    regions.js        GET /regions
    resources.js      GET /resources, PATCH /resource-locations/:id
    terrain.js        Cell paint history (read/write/delete)
    tribes.js         Tribe marker CRUD
    settlements.js    Settlement CRUD
```

### Key design decisions

- **Terrain painting is append-only** — new rows are inserted per paint action; the latest paint per cell is queried with `DISTINCT ON`. A background job cleans up superseded rows monthly.
- **User limits** enforced in serializable transactions to prevent race conditions: 50 tribe markers, 50 settlements, 10 public settlements per user (all configurable via env).
- **Auth via HttpOnly cookies** — no tokens in JS; `credentials: 'include'` on every fetch.
- **All Leaflet objects stay in `TheMap.vue`** — stores hold plain data; TheMap syncs Leaflet reactively.

## Features

- **Terrain painting** — paint grid cells with terrain types; shared across all users per region
- **Tribe markers** — place and label tribe markers on the map
- **Player settlements** — track your own settlements with stage, resource type, and public/private visibility
- **Resource lookup** — find resources by name, type, or production chain; filter by star rating
- **Region navigation** — country + state/sub-region dropdown with server-side preference saving
- **Dark / light theme** — system preference + manual toggle, no flash on load
- **Account management** — register, login, change password
- **Cookie notice** — GDPR-friendly dismissible notice linking to Terms and Privacy Policy
- **Configurable registration** — open, closed, or allowlist-only via env vars
