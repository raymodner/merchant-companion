# Installation

- [With Docker (recommended)](#with-docker-recommended)
  - [Production](#production)
  - [Development](#development)
- [Without Docker](#without-docker)
- [Configuration](#configuration)
- [Updates and migrations](#updates-and-migrations)

---

## With Docker (recommended)

### Production

**Requirements:** Docker with the Compose plugin.

```bash
git clone <your-repo-url>
cd map
bash install.sh
```

`install.sh` will:
1. Copy `.env.dist` to `.env` and walk you through the required (and optional) values
2. Build all containers, wait for the database, apply migrations, and seed game data — all in the same run

If `.env` already exists, it'll ask whether to reconfigure it or keep it as-is before continuing.

The app is available on port **8080**. Put nginx or Caddy in front to handle TLS.

**Updating:**
```bash
bash deploy.sh
```
Pulls the latest code, rebuilds containers, applies any new migrations, and re-seeds game data. Safe to run repeatedly.

---

### Development

```bash
cp .env.dist .env
# Fill in .env (DB_PASSWORD and JWT_SECRET at minimum)

docker compose up --build -d
```

| Service | URL |
|---|---|
| Frontend (Vite HMR) | http://localhost:5174 |
| API | http://localhost:3001 |

Frontend changes (Vue/CSS) reload automatically. After changing backend files:
```bash
docker compose restart api
```

After adding npm packages to either workspace:
```bash
docker compose down && docker compose up --build -d
```

---

## Without Docker

**Requirements:** Node.js 20+, pnpm 11+, PostgreSQL 15+

### 1. Create a database

```sql
CREATE USER "merchant-companion" WITH PASSWORD 'yourpassword';
CREATE DATABASE "merchant-companion" OWNER "merchant-companion";
```

### 2. Configure the backend

```bash
cp backend/.env.dist backend/.env
```

Edit `backend/.env` — set `DATABASE_URL`, `JWT_SECRET`, and `ALLOWED_ORIGINS` at minimum:

```env
DATABASE_URL=postgresql://merchant-companion:yourpassword@localhost:5432/merchant-companion
JWT_SECRET=<output of: openssl rand -hex 64>
ALLOWED_ORIGINS=http://localhost:5173
```

### 3. Install dependencies and apply migrations

```bash
cd backend
pnpm install
pnpm prisma:generate
pnpm prisma:deploy
psql -U merchant-companion -d merchant-companion < ../seed.sql
```

### 4. Start the backend

```bash
pnpm start        # production
pnpm dev          # development (auto-restarts on file changes)
```

API listens on port 3001 by default. Set `PORT` in `backend/.env` to change it.

### 5. Start the frontend

**Development:**
```bash
cd frontend
pnpm install
pnpm dev
```
Frontend available at http://localhost:5173.

**Production build:**
```bash
cd frontend
pnpm install
pnpm build
# Output is in frontend/dist/
```

Point your web server at `frontend/dist/` and proxy `/api/` requests to the backend. See `frontend/nginx.conf` for a reference nginx configuration.

---

## Configuration

All options go in `.env` (root, for Docker) or `backend/.env` (for non-Docker).

### Required

| Variable | Notes |
|---|---|
| `DB_NAME` | Postgres database name |
| `DB_USER` | Postgres user |
| `DB_PASSWORD` | Postgres password |
| `JWT_SECRET` | Min 32 chars — generate with `openssl rand -hex 64` |
| `ALLOWED_ORIGINS` | Comma-separated frontend origins, e.g. `https://yourdomain.com` |

### Production only

| Variable | Notes |
|---|---|
| `APP_URL` | Public URL, used for Open Graph metadata |

### Optional

| Variable | Default | Notes |
|---|---|---|
| `MAX_TRIBE_MARKERS` | `50` | Tribe markers per user |
| `MAX_SETTLEMENTS` | `50` | Total settlements per user |
| `MAX_PUBLIC_SETTLEMENTS` | `10` | Public settlements per user |
| `STAR_EDITING` | `true` | Set to `false` to disable community star ratings |
| `PUBLIC_SETTLEMENTS_REQUIRE_AUTH` | `false` | Set to `true` to hide public settlements from guests |
| `SHARED_PAINT` | `true` | Terrain paint is one shared map; set to `false` for a private map per user |
| `SHARED_TRIBE_MARKERS` | `false` | Tribe markers are private to their placer; set to `true` so everyone sees everyone's |
| `SHARED_RATINGS` | `true` | Resource star ratings are one shared value; set to `false` for a personal rating per user |
| `REGISTRATION_OPEN` | `true` | Set to `false` to close registration |
| `REGISTRATION_ALLOWLIST` | — | Comma-separated emails; only these addresses can register (overrides `REGISTRATION_OPEN`) |
| `CONTACT_NAME` | — | Shown in the privacy policy |
| `CONTACT_DISCORD` | — | Discord invite URL, shown in the privacy policy |
| `CONTACT_EMAIL` | — | Contact email, shown in the privacy policy |

### Map tiles

The map uses CARTO's Voyager tiles by default. CARTO requires a free API key for these: without one, every tile shows "API KEY REQUIRED". Set it in the root `.env`:

| Variable | Default | Notes |
|---|---|---|
| `TILE_API_KEY` | — | Your tile provider key. Required for the default CARTO tiles |
| `TILE_URL` | CARTO Voyager | Leaflet tile URL template for a different provider. Put `{apikey}` where the provider expects the key |
| `TILE_ATTRIBUTION` | `© OpenStreetMap contributors, © CARTO` | Attribution shown in the map corner. Most providers require it |

These are baked into the frontend at **build time**, so rebuild after changing them: `bash deploy.sh` in production, or `docker compose up --build -d frontend` in development. Without Docker, export them as `VITE_TILE_URL`, `VITE_TILE_API_KEY` and `VITE_TILE_ATTRIBUTION` before `pnpm build` / `pnpm dev`.

The key ends up in the public JavaScript bundle. That's normal for tile keys.

**Getting a key**

- **CARTO (default)**: request one at [carto.com/basemaps/apikey](https://carto.com/basemaps/apikey/). It's emailed straight back and you don't need a CARTO account. Only `TILE_API_KEY` is needed; leave `TILE_URL` empty. The free tier covers 5 million tile requests per month and is meant for non-commercial use.
  ```env
  TILE_API_KEY=your-carto-key
  ```
- **MapTiler** — sign up at [cloud.maptiler.com](https://cloud.maptiler.com/), copy the default key under **API keys**, and add your domain under the key's **Allowed HTTP origins**.
  ```env
  TILE_URL=https://api.maptiler.com/maps/streets-v2/256/{z}/{x}/{y}.png?key={apikey}
  TILE_API_KEY=your-maptiler-key
  TILE_ATTRIBUTION=© MapTiler © OpenStreetMap contributors
  ```
- **Stadia Maps** — sign up at [client.stadiamaps.com](https://client.stadiamaps.com/), create a property, and either add your domain to it (domain auth, no key needed) or create an API key there.
  ```env
  TILE_URL=https://tiles.stadiamaps.com/tiles/alidade_smooth/{z}/{x}/{y}{r}.png?api_key={apikey}
  TILE_API_KEY=your-stadia-key
  TILE_ATTRIBUTION=© Stadia Maps © OpenMapTiles © OpenStreetMap contributors
  ```

Check your provider's free-tier limits and terms. Any provider with a standard `{z}/{x}/{y}` raster URL works.

---

## Updates and migrations

### Updating the app (Docker)

```bash
bash deploy.sh
```

This pulls the latest code, rebuilds containers, and runs `prisma migrate deploy` which applies any new migration files automatically.

### Making a schema change (developers)

Schema is managed with Prisma Migrate. Always create migrations on your development machine, not on the server.

```bash
# 1. Edit backend/prisma/schema.prisma
# 2. Generate and apply the migration
bash migrate.sh describe_your_change
# 3. Commit the generated migration file
git add backend/prisma/migrations/
git commit -m "migration: describe_your_change"
```

The next `bash deploy.sh` on the server will pick it up and apply it.
