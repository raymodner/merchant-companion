CREATE TABLE IF NOT EXISTS users (
  id                UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  username          VARCHAR(50)  NOT NULL UNIQUE,
  email             VARCHAR(255) NOT NULL UNIQUE,
  password          VARCHAR(255) NOT NULL,
  preferred_country VARCHAR(100),
  preferred_state   VARCHAR(100),
  token_version     INT          NOT NULL DEFAULT 0,
  created_at        TIMESTAMPTZ  DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS terrains (
  id    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name  VARCHAR(50) NOT NULL UNIQUE,
  color VARCHAR(20) NOT NULL,
  icon  VARCHAR(10) NOT NULL
);

CREATE TABLE IF NOT EXISTS resource_types (
  id   UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(30) NOT NULL UNIQUE,
  tier INT         NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS resources (
  id               UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  name             VARCHAR(100) NOT NULL UNIQUE,
  resource_type_id UUID         NOT NULL REFERENCES resource_types(id),
  icon             VARCHAR(20),
  info             TEXT,
  available        BOOLEAN      NOT NULL DEFAULT true
);

CREATE TABLE IF NOT EXISTS locations (
  id         UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  name       VARCHAR(100) NOT NULL,
  terrain_id UUID         NOT NULL REFERENCES terrains(id),
  UNIQUE (name, terrain_id)
);

CREATE TABLE IF NOT EXISTS resource_locations (
  id          UUID     PRIMARY KEY DEFAULT gen_random_uuid(),
  resource_id UUID     NOT NULL REFERENCES resources(id) ON DELETE CASCADE,
  location_id UUID     NOT NULL REFERENCES locations(id),
  UNIQUE (resource_id, location_id)
);

-- Append-only rating history, same pattern as cell_paints: never updated, only
-- inserted; the current rating is whichever row is latest (see resources.js).
CREATE TABLE IF NOT EXISTS resource_ratings (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  resource_location_id  UUID        NOT NULL REFERENCES resource_locations(id) ON DELETE CASCADE,
  user_id               UUID        REFERENCES users(id) ON DELETE SET NULL,
  stars                 SMALLINT    NOT NULL CHECK (stars BETWEEN 0 AND 5),
  rated_at              TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS resource_ratings_lookup ON resource_ratings (resource_location_id, rated_at DESC);

CREATE TABLE IF NOT EXISTS production_chain (
  id                    UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  resource_id           UUID         NOT NULL UNIQUE REFERENCES resources(id) ON DELETE CASCADE,
  processed_name        VARCHAR(100) NOT NULL,
  processed_category_id UUID         REFERENCES resource_types(id),
  final1_name           VARCHAR(100),
  final1_category_id    UUID         REFERENCES resource_types(id),
  final2_name           VARCHAR(100),
  final2_category_id    UUID         REFERENCES resource_types(id)
);

CREATE TABLE IF NOT EXISTS map_regions (
  id         UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  name       VARCHAR(100) NOT NULL,
  parent_id  UUID         REFERENCES map_regions(id),
  lat_min    DECIMAL(7,4) NOT NULL,
  lat_max    DECIMAL(7,4) NOT NULL,
  lng_min    DECIMAL(8,4) NOT NULL,
  lng_max    DECIMAL(8,4) NOT NULL,
  center_lat DECIMAL(7,4),
  center_lng DECIMAL(8,4),
  zoom       SMALLINT
);
CREATE UNIQUE INDEX IF NOT EXISTS map_regions_name_parent_id_key
  ON map_regions (name, COALESCE(parent_id, '00000000-0000-0000-0000-000000000000'::uuid));

CREATE TABLE IF NOT EXISTS tribes (
  id    UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  name  VARCHAR(100) NOT NULL UNIQUE,
  color VARCHAR(20)  NOT NULL,
  icon  VARCHAR(10)  NOT NULL
);

CREATE TABLE IF NOT EXISTS tribe_types (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name       VARCHAR(20) NOT NULL UNIQUE,
  sort_order INT         NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS tribe_markers (
  id            UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  placed_by     UUID         NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tribe_id      UUID         NOT NULL REFERENCES tribes(id),
  tribe_type_id UUID         NOT NULL REFERENCES tribe_types(id),
  region_id     UUID         NOT NULL REFERENCES map_regions(id),
  lat           NUMERIC(9,6) NOT NULL,
  lng           NUMERIC(9,6) NOT NULL,
  created_at    TIMESTAMPTZ  DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS tribe_markers_region ON tribe_markers (region_id);

CREATE TABLE IF NOT EXISTS settlement_stages (
  id            UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  name          VARCHAR(100) NOT NULL UNIQUE,
  sort_order    INT          NOT NULL DEFAULT 0,
  tier          SMALLINT     NOT NULL DEFAULT 1,
  icon          VARCHAR(10)  NOT NULL,
  population    INT,
  days_building SMALLINT
);

CREATE TABLE IF NOT EXISTS player_settlements (
  id               UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID         NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  stage_id         UUID         NOT NULL REFERENCES settlement_stages(id),
  region_id        UUID         NOT NULL REFERENCES map_regions(id),
  resource_type_id UUID         REFERENCES resource_types(id),
  lat              NUMERIC(9,6) NOT NULL,
  lng              NUMERIC(9,6) NOT NULL,
  name             VARCHAR(200),
  created_at       TIMESTAMPTZ  DEFAULT NOW(),
  is_public        BOOLEAN      NOT NULL DEFAULT FALSE
);
CREATE INDEX IF NOT EXISTS player_settlements_region ON player_settlements (region_id);

CREATE TABLE IF NOT EXISTS cell_paints (
  id         UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  cell_key   VARCHAR(50)  NOT NULL,
  user_id    UUID         REFERENCES users(id) ON DELETE SET NULL,
  painted_at TIMESTAMPTZ  DEFAULT NOW(),
  terrain_id UUID         REFERENCES terrains(id),
  region_id  UUID         NOT NULL REFERENCES map_regions(id)
);
CREATE INDEX IF NOT EXISTS cell_paints_lookup ON cell_paints (region_id, cell_key, painted_at DESC);
