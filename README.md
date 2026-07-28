# Merchant Community Map

A collaborative map tool for tracking terrain, tribes, settlements, and resources. Built with Vue 3, Express 5, and PostgreSQL, running fully in Docker.

## Getting started

### Prerequisites

- Docker + Docker Compose

### Local development

```bash
cp .env.dist .env
cp backend/.env.dist backend/.env
# Edit .env and backend/.env with your values

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

| Variable | Where | Required | Notes |
|---|---|---|---|
| `DB_NAME` | root `.env` | yes | Postgres database name |
| `DB_USER` | root `.env` | yes | Postgres user |
| `DB_PASSWORD` | root `.env` | yes | Postgres password |
| `JWT_SECRET` | `backend/.env` | yes | Generate: `openssl rand -hex 64` |
| `ALLOWED_ORIGINS` | `backend/.env` / root `.env` | yes | Comma-separated allowed origins, e.g. `http://localhost:5174` |
| `APP_URL` | root `.env` | prod only | Public URL, used by prod compose |

## Deploying to production

```bash
cp .env.dist .env
# Fill in all values including ALLOWED_ORIGINS=https://yourdomain.com and APP_URL

git pull
docker compose -f docker-compose.prod.yml up --build -d
```

The production compose builds the Vue app and serves it through nginx on port 8080. The API is not exposed directly; nginx reverse-proxies it.

### Database migrations

Schema changes are in `setup.sql` (idempotent — safe to re-run):
```bash
docker exec -i terrain_db psql -U terrain -d terrain_map < setup.sql
```

Game data is in `seed.sql` (pure upserts — safe to re-run):
```bash
docker exec -i terrain_db psql -U terrain -d terrain_map < seed.sql
```

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
    validate.js       Zod middleware helpers: body(), uuidParam()
    resolvers.js      Cached DB lookups for terrain/tribe/resource types
    cleanup.js        Monthly job: removes superseded cell_paint rows
  routes/
    auth.js           register, login, /me, preferences, password, logout
    lookup.js         GET /terrains, /tribes, /settlement-stages
    regions.js        GET /regions
    resources.js      GET /resources, PATCH /resource-locations/:id
    terrain.js        Cell paint history (read/write/delete)
    tribes.js         Tribe marker CRUD
    settlements.js    Settlement CRUD
```

### Key design decisions

- **Terrain painting is append-only** — new rows are inserted per paint action; the latest paint per cell is queried with `DISTINCT ON`. A background job cleans up superseded rows monthly.
- **User limits** enforced in serializable transactions to prevent race conditions: 50 tribe markers, 50 settlements, 10 public settlements per user.
- **Auth via HttpOnly cookies** — no tokens in JS; `credentials: 'include'` on every fetch.
- **All Leaflet objects stay in `TheMap.vue`** — stores hold plain data; TheMap syncs Leaflet reactively.

## Features

- **Terrain painting** — paint grid cells with terrain types; shared across all users per region
- **Tribe markers** — place and label tribe camp/settlement markers on the map (up to 50)
- **Player settlements** — track your own settlements with stage and visibility (up to 50 total, 10 public)
- **Resource lookup** — find resources by name, type, or chain; filter by min-stars rating
- **Region navigation** — country + state/sub-region dropdown with server-side preference saving
- **Dark / light theme** — system preference + manual toggle, no flash on load
- **Account management** — register, login, change password

## Development notes

After changing `backend/prisma/schema.prisma`, regenerate the Prisma client:
```bash
docker exec terrain_api pnpm prisma:generate
```

Run ad-hoc SQL:
```bash
docker exec -i terrain_db psql -U terrain -d terrain_map -c "SELECT ..."
```
