# Merchant Terrain Map

A collaborative fantasy/medieval terrain map editor. Users can paint terrain types onto a geographic grid, look up resource locations, and track production chains — all shared in real time across accounts.

## Stack

| Layer | Technology |
|---|---|
| Frontend | Vanilla JS, Leaflet.js, Vite |
| Backend | Node.js, Express 5 |
| Database | PostgreSQL 15 |
| Auth | JWT (jsonwebtoken + bcryptjs) |
| Package manager | pnpm |
| Container | Docker Compose |

## Quick start

```bash
cp .env.dist .env
# Edit .env — set a strong DB_PASSWORD and JWT_SECRET
docker compose up --build -d
```

- **Frontend** → http://localhost:5174
- **API** → http://localhost:3001
- **DB** → localhost:5432

The database is initialised automatically on first boot: `setup.sql` creates the schema and `seed.sql` populates terrains, resources, locations, production chains, and map regions.

## Environment variables

Copy `.env.dist` to `.env` and fill in:

| Variable | Description |
|---|---|
| `DB_NAME` | PostgreSQL database name |
| `DB_USER` | PostgreSQL user |
| `DB_PASSWORD` | PostgreSQL password |
| `JWT_SECRET` | Secret used to sign JWTs — generate with `openssl rand -hex 64` |
| `NODE_ENV` | `development` or `production` |
| `PORT` | API port (default `3001`) |

## Project structure

```
├── index.html          # Single-page app shell
├── main.js             # All frontend logic (Leaflet map, UI, API calls)
├── main.css            # All styles
├── vite.config.js      # Vite dev server — proxies /api → Express
├── server/
│   ├── index.js        # Express app & all API routes
│   ├── routes/auth.js  # Register, login, /me, preferences
│   ├── auth.js         # JWT middleware
│   └── db.js           # pg.Pool
├── setup.sql           # Schema (CREATE TABLE IF NOT EXISTS + ALTER TABLE migrations)
├── seed.sql            # Game data — re-runnable (TRUNCATEs then re-inserts)
├── Dockerfile          # API container (node:20-slim)
├── Dockerfile.frontend # Frontend container (node:20-alpine)
└── docker-compose.yml  # Orchestrates db, api, frontend
```

## Database schema

| Table | Purpose |
|---|---|
| `users` | Accounts, bcrypt passwords, preferred region |
| `cell_paints` | Full paint history — `DISTINCT ON (cell_key)` returns latest |
| `terrains` | 8 terrain types with colour and icon |
| `resources` | Raw materials (Ore, Stone, Wood, Raw Food) |
| `resource_locations` | Where each resource appears (terrain × location × star rating 0–5) |
| `production_chain` | Raw → Processed → Final product mappings |
| `map_regions` | Countries and US states with bounding boxes |

## Common operations

**Re-seed game data** (does not touch `users` or `cell_paints`):
```bash
docker exec -i terrain_db psql -U terrain -d terrain_map < seed.sql
```

**Apply schema changes**:
```bash
docker exec -i terrain_db psql -U terrain -d terrain_map < setup.sql
```

**Restart API after code changes**:
```bash
docker compose restart api
```

**Full rebuild** (e.g. after adding npm packages):
```bash
docker compose down && docker compose up --build -d
```

## Planned

- **Registration whitelist** — restrict sign-ups to a list of allowed email addresses or domains, so the app can be shared privately without being open to anyone
- **Forgot password / reset flow** — email-based password reset: request a time-limited token, receive a link, set a new password

## Features

- **Shared terrain painting** — grid is shared across all users; latest paint per cell wins, full history is preserved
- **Paint mode** — explicit toggle prevents accidental edits; selecting a terrain auto-enables it
- **Terrain filters** — show/hide terrain types on the map; hidden cells revert to the empty grid style rather than disappearing
- **Resource lookup** — search by resource name, type, terrain, production chain output, and minimum star rating
- **Star ratings** — 0 means unknown (always shown regardless of filter), 1–5 are known quality ratings; editable in edit mode
- **Production chains** — trace raw material → processed good → final products (Armour, Weapons, Luxury, etc.)
- **Per-user region preference** — selected country/state is stored server-side and restored on next login
