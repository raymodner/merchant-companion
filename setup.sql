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
