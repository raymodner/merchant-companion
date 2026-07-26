# Merchant Companion

A collaborative fantasy/medieval terrain map editor. Users can paint terrain types onto a geographic grid, place tribe markers and player settlements, and look up resource locations with production chains — all shared across accounts.

## Stack

| Layer | Technology |
|---|---|
| Frontend | Vue 3 + Pinia + Vite |
| Map | Leaflet.js |
| Backend | Express 5 + Prisma |
| Database | PostgreSQL 15 |
| Auth | JWT via HttpOnly cookie |
| Package manager | pnpm (monorepo) |
| Container | Docker Compose |

## Quick start

```bash
cp .env.dist .env
# Edit .env — set DB_PASSWORD and JWT_SECRET
docker compose up --build -d
```

- **Frontend** → http://localhost:5174
- **API** → http://localhost:3001

Apply schema and seed game data on first boot:

```bash
docker exec -i terrain_db psql -U terrain -d terrain_map < setup.sql
docker exec -i terrain_db psql -U terrain -d terrain_map < seed.sql
```

## Environment variables

Copy `.env.dist` → `.env` at the repo root.

| Variable | Description |
|---|---|
| `DB_NAME` | PostgreSQL database name |
| `DB_USER` | PostgreSQL user |
| `DB_PASSWORD` | PostgreSQL password |
| `JWT_SECRET` | Signs JWTs — generate with `openssl rand -hex 64` |
| `ALLOWED_ORIGINS` | Comma-separated allowed CORS origins |

## Common operations

```bash
# Restart API after backend code changes
docker compose restart api

# Full rebuild after adding npm packages
docker compose down && docker compose up --build -d

# Apply schema migrations
docker exec -i terrain_db psql -U terrain -d terrain_map < setup.sql

# Re-seed game data (preserves users, cell_paints, markers, settlements)
docker exec -i terrain_db psql -U terrain -d terrain_map < seed.sql
```

## Production deployment

Use `docker-compose.prod.yml` with a host-level Caddy reverse proxy.

```bash
cp .env.dist .env  # fill in production values
docker compose -f docker-compose.prod.yml up -d --build

docker exec -i terrain_db psql -U terrain -d terrain_map < setup.sql
docker exec -i terrain_db psql -U terrain -d terrain_map < seed.sql
```

The prod compose binds the frontend to `127.0.0.1:8080`. Caddy handles TLS termination and proxies public traffic.

## Features

- **Shared terrain painting** — 0.1° grid shared across all users; latest paint per cell wins, full history preserved
- **Paint mode** — explicit toggle prevents accidental edits; selecting a terrain auto-enables it
- **Terrain filters** — show/hide terrain types; hidden cells revert to the empty style
- **Tribe markers** — place and label tribe locations per region, filterable by tribe and type
- **Player settlements** — track settlement stage (Camp → Metropolis, Abbey, Castle), resource focus, and visibility
- **Resource lookup** — search by name, type, terrain, production chain output, and minimum star rating
- **Star ratings** — 0 = unknown (always shown), 1–5 = rated quality; editable when logged in
- **Production chains** — trace raw material → processed good → final products
- **Region selector** — country and US state dropdowns with type-to-filter; preference stored server-side per user
- **Auth** — register/login with HttpOnly JWT cookie; password change in-app
