CREATE TABLE IF NOT EXISTS users (
  id         SERIAL       PRIMARY KEY,
  username   VARCHAR(50)  NOT NULL UNIQUE,
  email      VARCHAR(255) NOT NULL UNIQUE,
  password   VARCHAR(255) NOT NULL,
  created_at TIMESTAMPTZ  DEFAULT NOW()
);

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
