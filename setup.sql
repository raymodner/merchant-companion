CREATE TABLE IF NOT EXISTS users (
  id                SERIAL       PRIMARY KEY,
  username          VARCHAR(50)  NOT NULL UNIQUE,
  email             VARCHAR(255) NOT NULL UNIQUE,
  password          VARCHAR(255) NOT NULL,
  preferred_country VARCHAR(100),
  preferred_state   VARCHAR(100),
  created_at        TIMESTAMPTZ  DEFAULT NOW()
);
ALTER TABLE users ADD COLUMN IF NOT EXISTS preferred_country VARCHAR(100);
ALTER TABLE users ADD COLUMN IF NOT EXISTS preferred_state   VARCHAR(100);

CREATE TABLE IF NOT EXISTS cell_paints (
  id          SERIAL       PRIMARY KEY,
  region_key  VARCHAR(100) NOT NULL,
  cell_key    VARCHAR(50)  NOT NULL,
  terrain_key VARCHAR(50),
  user_id     INTEGER      REFERENCES users(id) ON DELETE SET NULL,
  painted_at  TIMESTAMPTZ  DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS cell_paints_lookup
  ON cell_paints (region_key, cell_key, painted_at DESC);

CREATE TABLE IF NOT EXISTS resources (
  id        SERIAL PRIMARY KEY,
  name      VARCHAR(100) NOT NULL UNIQUE,
  type      VARCHAR(20)  NOT NULL,
  icon      VARCHAR(20),
  info      TEXT,
  available BOOLEAN NOT NULL DEFAULT true
);

CREATE TABLE IF NOT EXISTS terrains (
  id    SERIAL PRIMARY KEY,
  name  VARCHAR(50) NOT NULL UNIQUE,
  color VARCHAR(20) NOT NULL,
  icon  VARCHAR(10) NOT NULL
);

CREATE TABLE IF NOT EXISTS resource_locations (
  id          SERIAL PRIMARY KEY,
  resource_id INTEGER NOT NULL REFERENCES resources(id) ON DELETE CASCADE,
  terrain     VARCHAR(50)  NOT NULL REFERENCES terrains(name),
  location    VARCHAR(100) NOT NULL,
  stars       SMALLINT NOT NULL DEFAULT 0 CHECK (stars BETWEEN 0 AND 5),
  UNIQUE (resource_id, terrain, location)
);

CREATE TABLE IF NOT EXISTS production_chain (
  id              SERIAL PRIMARY KEY,
  resource_id     INTEGER NOT NULL UNIQUE REFERENCES resources(id) ON DELETE CASCADE,
  processed_name  VARCHAR(100) NOT NULL,
  final1_name     VARCHAR(100),
  final1_category VARCHAR(30),
  final2_name     VARCHAR(100),
  final2_category VARCHAR(30)
);

CREATE TABLE IF NOT EXISTS map_regions (
  id         SERIAL PRIMARY KEY,
  name       VARCHAR(100) NOT NULL,
  parent     VARCHAR(100) NOT NULL DEFAULT '',
  lat_min    DECIMAL(7,4) NOT NULL,
  lat_max    DECIMAL(7,4) NOT NULL,
  lng_min    DECIMAL(8,4) NOT NULL,
  lng_max    DECIMAL(8,4) NOT NULL,
  center_lat DECIMAL(7,4),
  center_lng DECIMAL(8,4),
  zoom       SMALLINT,
  UNIQUE (name, parent)
);

CREATE TABLE IF NOT EXISTS tribes (
  id    SERIAL       PRIMARY KEY,
  name  VARCHAR(100) NOT NULL UNIQUE,
  color VARCHAR(20)  NOT NULL,
  icon  VARCHAR(10)  NOT NULL
);

INSERT INTO tribes (name, color, icon) VALUES
  ('Stonewalkers',    '#8B7355', '🪨'),
  ('Ashbinders',      '#5C5C5C', '🌋'),
  ('Bloodherds',      '#8B1A1A', '🐂'),
  ('Threadkeepers',   '#7B3F8B', '🧵'),
  ('Wayfarers',       '#1E5B8A', '🧭'),
  ('Golden Clan',     '#B8860B', '💰'),
  ('Ironbound',       '#2F4F4F', '⚙'),
  ('The Great Accord','#2E7B57', '🤝')
ON CONFLICT (name) DO NOTHING;

CREATE TABLE IF NOT EXISTS settlement_stages (
  id         SERIAL       PRIMARY KEY,
  name       VARCHAR(100) NOT NULL UNIQUE,
  sort_order INT          NOT NULL DEFAULT 0,
  tier       SMALLINT     NOT NULL DEFAULT 1,
  icon       VARCHAR(10)  NOT NULL
);

-- Player settlement stages (Camp/Selo/Burgh are tribe types, not player stages)
INSERT INTO settlement_stages (name, sort_order, tier, icon) VALUES
  ('Camp',       1, 1, '🏕'),
  ('Town',       2, 2, '🏙'),
  ('Homestead',  3, 2, '🏡'),
  ('City',       4, 3, '🌆'),
  ('Castle',     5, 3, '🏯'),
  ('Metropolis', 6, 4, '🌇'),
  ('Abbey',      7, 3, '⛪')
ON CONFLICT (name) DO NOTHING;

-- Remove tribe types that were incorrectly added as player stages
DELETE FROM settlement_stages WHERE name IN ('Selo', 'Burgh');

-- Drop old merged table if it exists
DROP TABLE IF EXISTS settlements;

-- Tribe markers: where each tribe has a settlement on the map
CREATE TABLE IF NOT EXISTS tribe_markers (
  id         SERIAL      PRIMARY KEY,
  placed_by  INT         NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tribe_id   INT         NOT NULL REFERENCES tribes(id),
  type       VARCHAR(10) NOT NULL CHECK (type IN ('Camp', 'Selo', 'Burgh')),
  region_key VARCHAR(100) NOT NULL,
  lat        NUMERIC(9,6) NOT NULL,
  lng        NUMERIC(9,6) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS tribe_markers_region ON tribe_markers (region_key);

-- Player settlements: a user's own settlement per product type
CREATE TABLE IF NOT EXISTS player_settlements (
  id            SERIAL      PRIMARY KEY,
  user_id       INT         NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  resource_type VARCHAR(100),
  stage_id      INT         NOT NULL REFERENCES settlement_stages(id),
  region_key    VARCHAR(100) NOT NULL,
  lat           NUMERIC(9,6) NOT NULL,
  lng           NUMERIC(9,6) NOT NULL,
  name          VARCHAR(200),
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS player_settlements_region ON player_settlements (region_key);
