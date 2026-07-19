# CLAUDE.md

## Running the app

Everything runs in Docker. Start with:
```bash
docker compose up --build -d
```
- Frontend: http://localhost:5174
- API: http://localhost:3001

After editing `server/` files, restart the API container:
```bash
docker compose restart api
```

After adding npm packages, do a full rebuild:
```bash
docker compose down && docker compose up --build -d
```

Frontend changes (JS/CSS/HTML) are picked up live via Vite's HMR — no restart needed.

## Project layout

Single-page app. All frontend code lives in three root files:
- `main.js` — map logic, all UI, all API calls
- `main.css` — all styles
- `index.html` — HTML shell

Backend is a plain Express 5 app:
- `server/index.js` — all routes except auth
- `server/routes/auth.js` — register, login, /me, PATCH /preferences
- `server/auth.js` — JWT middleware (`req.user` is set from the token)
- `server/db.js` — `pg.Pool` exported as `pool`

## Database

Schema is in `setup.sql` (uses `CREATE TABLE IF NOT EXISTS` + `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` for safe re-runs).
Game data is in `seed.sql` (TRUNCATEs and re-inserts — safe to re-run, does not touch `users` or `cell_paints`).

Apply schema changes:
```bash
docker exec -i terrain_db psql -U terrain -d terrain_map < setup.sql
```

Re-seed game data:
```bash
docker exec -i terrain_db psql -U terrain -d terrain_map < seed.sql
```

Run ad-hoc SQL:
```bash
docker exec -i terrain_db psql -U terrain -d terrain_map -c "SELECT ..."
```

### Key tables

- **`cell_paints`** — append-only paint history. Latest paint per cell is retrieved with `DISTINCT ON (cell_key) ORDER BY cell_key, painted_at DESC`. Never update rows, only insert.
- **`resource_locations.stars`** — `0` means unknown (always shown in filters regardless of min-stars setting); `1–5` are actual ratings. The DB constraint is `CHECK (stars BETWEEN 0 AND 5)`.
- **`users.preferred_country / preferred_state`** — stored server-side, applied when the user logs in if different from the current view.

## Key patterns

### Custom dropdowns
`makeDropdown(container, opts, onChange, cls?)` in `main.js` builds a styled dropdown inside any container element. It uses `position: fixed` with JS-calculated coordinates from `getBoundingClientRect()` — this avoids clipping by `overflow-y: auto` ancestors (sidebar, resource modal overlay). All dropdown lists carry `data-dd-list="1"` so the document-level click handler can close all of them at once.

For sidebar dropdowns pass `cls = 'sidebar'` which applies `.sidebar-btn` / `.sidebar-list` CSS.

### Terrain painting
Grid cells are `L.rectangle` instances stored in `cells[cellKey]`. All painting is gated on `paintMode === true`. Selecting a terrain or eraser auto-enables paint mode. The map's dragging is disabled only when `paintMode` is true — previously it was always disabled (bug fixed).

### TERRAINS object
`let TERRAINS = {}` is populated at startup from `GET /api/terrains`. All terrain-dependent code (colour swatches, filter rows, resource modal dropdown) runs inside `initTerrainUI()` which is called after the API response arrives. Do not hard-code terrain data in JS.

### Auth
JWT token is stored in `localStorage` as `auth-token`. `authHeaders()` adds `Authorization: Bearer <token>` to any request that needs it. The auth middleware (`server/auth.js`) decodes the token into `req.user = { id, username }`.

### Star ratings in edit mode
Star editing is behind a toggle (`editMode`). The edit button in the resource modal must be clicked first (and requires login). This prevents accidental edits when browsing. Setting stars to 0 via the PATCH endpoint resets a location to "unknown".

## Environment variables

Copy `.env.dist` → `.env`. Required variables:
- `DB_NAME`, `DB_USER`, `DB_PASSWORD`
- `JWT_SECRET` — generate with `openssl rand -hex 64`
- `NODE_ENV`, `PORT` (default `3001`)
