# CLAUDE.md

## Running the app

Everything runs in Docker. Start with:
```bash
docker compose up --build -d
```
- Frontend: http://localhost:5174
- API: http://localhost:3001

After editing `backend/` files, restart the API container:
```bash
docker compose restart api
```

After adding npm packages to either workspace, do a full rebuild:
```bash
docker compose down && docker compose up --build -d
```

Frontend changes (JS/CSS/Vue) are picked up live via Vite's HMR — no restart needed.

## Project layout

This is a monorepo with two build contexts:

```
backend/              Express 5 + Prisma API
  src/
    index.js          All routes except auth
    routes/auth.js    register, login, /me, PATCH /preferences
    auth.js           JWT middleware (req.user = { id, username })
    prisma.js         PrismaClient singleton
  prisma/
    schema.prisma     Full DB schema (11 models)
  Dockerfile

frontend/             Vue 3 + Vite + Pinia SPA
  src/
    App.vue           Root component — startup sequence, provides mapRef
    main.js           createApp, Pinia, mount
    assets/main.css   All styles
    api/index.js      All API calls (fetch, credentials: 'include')
    utils.js          TRIBE_TYPE_ICONS, typeIcon()
    stores/
      auth.js         useAuthStore — user ref, login/register/logout/fetchMe
      region.js       useRegionStore — regions, currentCountry/State, regionKey, currentBounds
      paint.js        usePaintStore — TERRAINS, paintMode, activeTerrain, hiddenTerrains, cellState
      tribes.js       useTribesStore — TRIBES, markers, hiddenTribes/Types, placement state
      settlements.js  useSettlementsStore — STAGES, playerSettlements, hidden filters, placement state
      resources.js    useResourcesStore — resourceData, modal state, filteredResources
      ui.js           useUiStore — sidebarOpen, mode, markerTab, authModalOpen, placementMode
    components/
      TheMap.vue      All Leaflet logic — cells, tribe/settlement markers, paint, watchers
      TheSidebar.vue  Sidebar shell — region dropdowns, mode tabs, ViewPanel/EditPanel
      AppDropdown.vue Reusable dropdown (Teleport to body to escape overflow clipping)
      panels/
        ViewPanel.vue Terrain filters, tribe/settlement filters + marker lists with flyTo
        EditPanel.vue Tribe/settlement placement, terrain paint swatches
      modals/
        AuthModal.vue       Login / register tabs
        ResourceModal.vue   Resource lookup with star ratings
        TribeEditModal.vue  Edit a placed tribe marker
        SettleEditModal.vue Edit a placed settlement
  Dockerfile
```

## Database

Schema is in `setup.sql` (uses `CREATE TABLE IF NOT EXISTS` + `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` for safe re-runs).
Game data is in `seed.sql` (pure upserts — safe to re-run; does not touch `users`, `cell_paints`, `tribe_markers`, or `player_settlements` except when explicitly deleting replaced regions).

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
- **`map_regions`** — countries have `parent_id IS NULL`; US states have `parent_id` pointing to the United States row. Large countries are split into geographic sub-regions rather than using a coarser grid step (e.g. Norway North / Norway South, Alaska Northeast / Alaska Northwest / etc.). When replacing a region in `seed.sql`, explicitly DELETE its dependent `cell_paints`, `tribe_markers`, and `player_settlements` rows first, then DELETE the region, then INSERT the replacements.

### Prisma

Prisma schema is in `backend/prisma/schema.prisma`. All models use `@@map("snake_case_table")` and `@map("snake_case_col")` so Prisma camelCase fields map cleanly to the existing DB schema.

After changing the schema, regenerate the client:
```bash
docker exec terrain_api pnpm prisma:generate
```

The `DATABASE_URL` env var is composed from `DB_USER`, `DB_PASSWORD`, and `DB_NAME` in `docker-compose.yml`.

## Key patterns

### Leaflet isolation
All Leaflet objects (`L.map`, `L.rectangle`, `L.marker`) live **only** in `TheMap.vue`, never in Pinia stores. Stores hold plain data objects. TheMap watches store state and syncs Leaflet instances reactively.

### provide/inject for map access
`App.vue` provides `mapRef` (the TheMap component ref). `ViewPanel.vue` injects it to call `mapRef.panToTribe(id)` / `mapRef.panToSettlement(id)` which are exposed from TheMap via `defineExpose`.

### Custom dropdowns
`AppDropdown.vue` uses `Teleport to="body"` with `position: fixed` and `getBoundingClientRect()` — this avoids clipping by `overflow-y: auto` ancestors (sidebar, resource modal overlay).

It includes a sticky filter input at the top of the list (auto-focused on open) that narrows options as you type. Only one dropdown can be open at a time: opening any instance dispatches `app-dd-close-others` (a `CustomEvent` on `document` with a `Symbol` as `detail`) so other instances close themselves.

For sidebar dropdowns pass `cls="sidebar"` which applies `.sidebar-btn` / `.sidebar-list` CSS.

### Terrain painting
Grid cells are `L.rectangle` instances stored in `cells[cellKey]` inside TheMap. All painting is gated on `paintStore.paintMode === true`. Selecting a terrain or eraser auto-enables paint mode. Map dragging is disabled only while `paintMode` is true and the mouse button is held. Painted cells use `fillOpacity: 0.40`; the `.swatch` CSS matches with `opacity: 0.4`.

### TERRAINS object
`paintStore.TERRAINS` is a `ref({})` populated at startup from `GET /api/terrains`. All terrain-dependent UI (colour swatches, filter rows, resource modal dropdown) is rendered from this reactive object.

### Auth
Auth uses HttpOnly cookies (set by the server). `credentials: 'include'` is passed on every `fetch` call. On login/register the server sends a `Set-Cookie` header; on `/me` it validates the cookie. The JWT middleware sets `req.user = { id, username }`.

### Star ratings in edit mode
Star editing in ResourceModal is behind an `editMode` toggle that requires login. Setting stars to `0` via the PATCH endpoint resets a location to "unknown".

### Circular dep avoidance
- `authStore` imports `regionStore` (to apply server-side prefs on login)
- `regionStore` does NOT import `authStore` (calls `api.savePreferences` unconditionally; fails silently if not logged in)
- `tribesStore` and `settlementsStore` import `authStore` (no cycle since auth → region only)
- `uiStore` is imported by nobody except components (no store imports it)

### Pinia store patterns
- Use `defineStore('name', () => { ... })` (setup store syntax throughout)
- Arrays for filter lists: `ref([])` — NOT `Set` (Vue 3 doesn't track Set mutations)
- Returned `ref` values are auto-unwrapped in components (no `.value` needed in templates)
- Leaflet-bound data (coordinates, ids) comes from plain objects in stores, never from reactive proxies passed into Leaflet

## Environment variables

Copy `backend/.env.dist` → `backend/.env`. Required variables:
- `DATABASE_URL` — full Postgres connection string
- `JWT_SECRET` — generate with `openssl rand -hex 64`
- `NODE_ENV`, `PORT` (default `3001`)

The `docker-compose.yml` composes `DATABASE_URL` from the root `.env` vars (`DB_NAME`, `DB_USER`, `DB_PASSWORD`). Copy `.env.dist` → `.env` at the repo root for Docker usage.
