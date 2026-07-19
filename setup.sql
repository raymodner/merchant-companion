CREATE TABLE IF NOT EXISTS regions (
  id          SERIAL       PRIMARY KEY,
  region_key  VARCHAR(100) NOT NULL UNIQUE,
  data        JSONB        NOT NULL DEFAULT '{}',
  updated_at  TIMESTAMPTZ  DEFAULT NOW()
);
