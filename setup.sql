CREATE TABLE IF NOT EXISTS users (
  id                UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
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
  id          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  region_key  VARCHAR(100) NOT NULL,
  cell_key    VARCHAR(50)  NOT NULL,
  terrain_key VARCHAR(50),
  user_id     UUID         REFERENCES users(id) ON DELETE SET NULL,
  painted_at  TIMESTAMPTZ  DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS cell_paints_lookup
  ON cell_paints (region_key, cell_key, painted_at DESC);

CREATE TABLE IF NOT EXISTS resources (
  id        UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  name      VARCHAR(100) NOT NULL UNIQUE,
  type      VARCHAR(20)  NOT NULL,
  icon      VARCHAR(20),
  info      TEXT,
  available BOOLEAN NOT NULL DEFAULT true
);

CREATE TABLE IF NOT EXISTS terrains (
  id    UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  name  VARCHAR(50) NOT NULL UNIQUE,
  color VARCHAR(20) NOT NULL,
  icon  VARCHAR(10) NOT NULL
);

CREATE TABLE IF NOT EXISTS resource_locations (
  id          UUID     PRIMARY KEY DEFAULT gen_random_uuid(),
  resource_id UUID     NOT NULL REFERENCES resources(id) ON DELETE CASCADE,
  terrain     VARCHAR(50)  NOT NULL REFERENCES terrains(name),
  location    VARCHAR(100) NOT NULL,
  stars       SMALLINT NOT NULL DEFAULT 0 CHECK (stars BETWEEN 0 AND 5),
  UNIQUE (resource_id, terrain, location)
);

CREATE TABLE IF NOT EXISTS production_chain (
  id              UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  resource_id     UUID    NOT NULL UNIQUE REFERENCES resources(id) ON DELETE CASCADE,
  processed_name  VARCHAR(100) NOT NULL,
  final1_name     VARCHAR(100),
  final1_category VARCHAR(30),
  final2_name     VARCHAR(100),
  final2_category VARCHAR(30)
);

CREATE TABLE IF NOT EXISTS map_regions (
  id         UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
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
  id    UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
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
  id            UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  name          VARCHAR(100) NOT NULL UNIQUE,
  sort_order    INT          NOT NULL DEFAULT 0,
  tier          SMALLINT     NOT NULL DEFAULT 1,
  icon          VARCHAR(10)  NOT NULL,
  population    INT,
  days_building SMALLINT
);

ALTER TABLE settlement_stages
  ADD COLUMN IF NOT EXISTS population    INT,
  ADD COLUMN IF NOT EXISTS days_building SMALLINT;

INSERT INTO settlement_stages (name, sort_order, tier, icon, population, days_building) VALUES
  ('Camp',       1, 1, '🏕', 15,   0),
  ('Hamlet',     2, 2, '🏘', 40,   1),
  ('Steading',   3, 3, '🌾', 90,   1),
  ('Village',    4, 4, '🏘', 165,  2),
  ('Town',       5, 5, '🏙', 315,  2),
  ('City',       6, 6, '🌆', 515,  4),
  ('Metropolis', 7, 7, '🌇', 1000, 2),
  ('Abbey',      8, 7, '⛪', 515,  2),
  ('Castle',     9, 7, '🏯', 515,  2)
ON CONFLICT (name) DO UPDATE SET
  sort_order    = EXCLUDED.sort_order,
  tier          = EXCLUDED.tier,
  icon          = EXCLUDED.icon,
  population    = EXCLUDED.population,
  days_building = EXCLUDED.days_building;

-- Migrate any settlements referencing the removed Homestead stage to Village
UPDATE player_settlements
  SET stage_id = (SELECT id FROM settlement_stages WHERE name = 'Village')
  WHERE stage_id = (SELECT id FROM settlement_stages WHERE name = 'Homestead');

DELETE FROM settlement_stages WHERE name IN ('Selo', 'Burgh', 'Homestead');

-- Drop old merged table if it exists
DROP TABLE IF EXISTS settlements;

-- Tribe markers: where each tribe has a settlement on the map
CREATE TABLE IF NOT EXISTS tribe_markers (
  id         UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  placed_by  UUID         NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tribe_id   UUID         NOT NULL REFERENCES tribes(id),
  type       VARCHAR(10)  NOT NULL CHECK (type IN ('Camp', 'Selo', 'Burgh')),
  region_key VARCHAR(100) NOT NULL,
  lat        NUMERIC(9,6) NOT NULL,
  lng        NUMERIC(9,6) NOT NULL,
  created_at TIMESTAMPTZ  DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS tribe_markers_region ON tribe_markers (region_key);

-- Player settlements: a user's own settlement per product type
CREATE TABLE IF NOT EXISTS player_settlements (
  id            UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID         NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  resource_type VARCHAR(100),
  stage_id      UUID         NOT NULL REFERENCES settlement_stages(id),
  region_key    VARCHAR(100) NOT NULL,
  lat           NUMERIC(9,6) NOT NULL,
  lng           NUMERIC(9,6) NOT NULL,
  name          VARCHAR(200),
  created_at    TIMESTAMPTZ  DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS player_settlements_region ON player_settlements (region_key);

ALTER TABLE player_settlements ADD COLUMN IF NOT EXISTS is_public BOOLEAN NOT NULL DEFAULT FALSE;

-- ══════════════════════════════════════════════════════════════════════════
-- SCHEMA MIGRATION: new lookup tables → FK columns → drop string columns
-- All blocks are idempotent; safe to re-run on an existing database.
-- ══════════════════════════════════════════════════════════════════════════

-- ── New lookup tables ─────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS resource_types (
  id   UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(30) NOT NULL UNIQUE
);
INSERT INTO resource_types (name) VALUES ('Ore'), ('Wood'), ('Stone'), ('Raw Food')
ON CONFLICT (name) DO NOTHING;

CREATE TABLE IF NOT EXISTS tribe_types (
  id   UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(20) NOT NULL UNIQUE
);
INSERT INTO tribe_types (name) VALUES ('Camp'), ('Selo'), ('Burgh')
ON CONFLICT (name) DO NOTHING;

CREATE TABLE IF NOT EXISTS locations (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name       VARCHAR(100) NOT NULL,
  terrain_id UUID NOT NULL REFERENCES terrains(id),
  UNIQUE (name, terrain_id)
);

-- ── Add FK columns (ADD COLUMN IF NOT EXISTS is idempotent) ──────────────

ALTER TABLE resources          ADD COLUMN IF NOT EXISTS resource_type_id  UUID REFERENCES resource_types(id);
ALTER TABLE map_regions        ADD COLUMN IF NOT EXISTS parent_id          UUID REFERENCES map_regions(id);
ALTER TABLE cell_paints        ADD COLUMN IF NOT EXISTS terrain_id         UUID REFERENCES terrains(id);
ALTER TABLE cell_paints        ADD COLUMN IF NOT EXISTS region_id          UUID REFERENCES map_regions(id);
ALTER TABLE resource_locations ADD COLUMN IF NOT EXISTS location_id        UUID REFERENCES locations(id);
ALTER TABLE tribe_markers      ADD COLUMN IF NOT EXISTS tribe_type_id      UUID REFERENCES tribe_types(id);
ALTER TABLE tribe_markers      ADD COLUMN IF NOT EXISTS region_id          UUID REFERENCES map_regions(id);
ALTER TABLE player_settlements ADD COLUMN IF NOT EXISTS region_id          UUID REFERENCES map_regions(id);
ALTER TABLE player_settlements ADD COLUMN IF NOT EXISTS resource_type_id   UUID REFERENCES resource_types(id);

-- ── Populate FK columns from old string columns (guarded by column-exists checks) ──

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='resources' AND column_name='type') THEN
    UPDATE resources r SET resource_type_id = rt.id
    FROM resource_types rt WHERE rt.name = r.type AND r.resource_type_id IS NULL;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='cell_paints' AND column_name='terrain_key') THEN
    UPDATE cell_paints cp SET terrain_id = t.id
    FROM terrains t WHERE t.name = cp.terrain_key AND cp.terrain_id IS NULL;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='tribe_markers' AND column_name='type') THEN
    UPDATE tribe_markers tm SET tribe_type_id = tt.id
    FROM tribe_types tt WHERE tt.name = tm.type AND tm.tribe_type_id IS NULL;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='player_settlements' AND column_name='resource_type') THEN
    UPDATE player_settlements ps SET resource_type_id = rt.id
    FROM resource_types rt WHERE rt.name = ps.resource_type AND ps.resource_type_id IS NULL;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='resource_locations' AND column_name='terrain') THEN
    INSERT INTO locations (name, terrain_id)
    SELECT DISTINCT rl.location, t.id FROM resource_locations rl
    JOIN terrains t ON t.name = rl.terrain
    ON CONFLICT (name, terrain_id) DO NOTHING;

    UPDATE resource_locations rl SET location_id = l.id
    FROM locations l JOIN terrains t ON t.id = l.terrain_id
    WHERE l.name = rl.location AND t.name = rl.terrain AND rl.location_id IS NULL;
  END IF;
END $$;

-- Populate map_regions.parent_id and region_id FKs on user tables.
-- Uses old parent string column if available, otherwise uses parent_id.
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='map_regions' AND column_name='parent') THEN
    UPDATE map_regions child SET parent_id = p.id
    FROM map_regions p WHERE child.parent = p.name AND child.parent != '' AND child.parent_id IS NULL;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='cell_paints' AND column_name='region_key') THEN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='map_regions' AND column_name='parent') THEN
      UPDATE cell_paints cp SET region_id = mr.id FROM map_regions mr
      WHERE cp.region_id IS NULL AND (
        (mr.parent = '' AND lower(replace(mr.name,' ','-')) = cp.region_key)
        OR (mr.parent = 'United States' AND 'us-'||lower(replace(mr.name,' ','-')) = cp.region_key)
      );
    ELSE
      UPDATE cell_paints cp SET region_id = mr.id FROM map_regions mr
      WHERE cp.region_id IS NULL AND (
        (mr.parent_id IS NULL AND lower(replace(mr.name,' ','-')) = cp.region_key)
        OR (EXISTS(SELECT 1 FROM map_regions u WHERE u.name='United States' AND u.id=mr.parent_id)
            AND 'us-'||lower(replace(mr.name,' ','-')) = cp.region_key)
      );
    END IF;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='tribe_markers' AND column_name='region_key') THEN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='map_regions' AND column_name='parent') THEN
      UPDATE tribe_markers tm SET region_id = mr.id FROM map_regions mr
      WHERE tm.region_id IS NULL AND (
        (mr.parent = '' AND lower(replace(mr.name,' ','-')) = tm.region_key)
        OR (mr.parent = 'United States' AND 'us-'||lower(replace(mr.name,' ','-')) = tm.region_key)
      );
    ELSE
      UPDATE tribe_markers tm SET region_id = mr.id FROM map_regions mr
      WHERE tm.region_id IS NULL AND (
        (mr.parent_id IS NULL AND lower(replace(mr.name,' ','-')) = tm.region_key)
        OR (EXISTS(SELECT 1 FROM map_regions u WHERE u.name='United States' AND u.id=mr.parent_id)
            AND 'us-'||lower(replace(mr.name,' ','-')) = tm.region_key)
      );
    END IF;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='player_settlements' AND column_name='region_key') THEN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='map_regions' AND column_name='parent') THEN
      UPDATE player_settlements ps SET region_id = mr.id FROM map_regions mr
      WHERE ps.region_id IS NULL AND (
        (mr.parent = '' AND lower(replace(mr.name,' ','-')) = ps.region_key)
        OR (mr.parent = 'United States' AND 'us-'||lower(replace(mr.name,' ','-')) = ps.region_key)
      );
    ELSE
      UPDATE player_settlements ps SET region_id = mr.id FROM map_regions mr
      WHERE ps.region_id IS NULL AND (
        (mr.parent_id IS NULL AND lower(replace(mr.name,' ','-')) = ps.region_key)
        OR (EXISTS(SELECT 1 FROM map_regions u WHERE u.name='United States' AND u.id=mr.parent_id)
            AND 'us-'||lower(replace(mr.name,' ','-')) = ps.region_key)
      );
    END IF;
  END IF;
END $$;

-- ── Remove replaced string columns ────────────────────────────────────────

-- Drop orphaned rows that could not be resolved before making columns NOT NULL
DELETE FROM cell_paints       WHERE region_id IS NULL;
DELETE FROM tribe_markers     WHERE tribe_type_id IS NULL OR region_id IS NULL;
DELETE FROM player_settlements WHERE region_id IS NULL;

-- resources: drop type string, make resource_type_id NOT NULL
ALTER TABLE resources ALTER COLUMN resource_type_id SET NOT NULL;
ALTER TABLE resources DROP COLUMN IF EXISTS type;

-- resource_locations: drop terrain + location strings, make location_id NOT NULL
ALTER TABLE resource_locations ALTER COLUMN location_id SET NOT NULL;
ALTER TABLE resource_locations DROP CONSTRAINT IF EXISTS resource_locations_resource_id_terrain_location_key;
ALTER TABLE resource_locations DROP COLUMN IF EXISTS terrain;
ALTER TABLE resource_locations DROP COLUMN IF EXISTS location;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name='resource_locations_resource_id_location_id_key' AND table_name='resource_locations'
  ) THEN
    ALTER TABLE resource_locations ADD CONSTRAINT resource_locations_resource_id_location_id_key UNIQUE (resource_id, location_id);
  END IF;
END $$;

-- map_regions: drop parent string, add functional unique index on (name, COALESCE(parent_id, nil-uuid))
ALTER TABLE map_regions DROP CONSTRAINT IF EXISTS map_regions_name_parent_key;
ALTER TABLE map_regions DROP COLUMN IF EXISTS parent;
CREATE UNIQUE INDEX IF NOT EXISTS map_regions_name_parent_id_key
  ON map_regions (name, COALESCE(parent_id, '00000000-0000-0000-0000-000000000000'::uuid));

-- cell_paints: drop region_key + terrain_key, replace index
ALTER TABLE cell_paints ALTER COLUMN region_id SET NOT NULL;
DROP INDEX IF EXISTS cell_paints_lookup;
ALTER TABLE cell_paints DROP COLUMN IF EXISTS region_key;
ALTER TABLE cell_paints DROP COLUMN IF EXISTS terrain_key;
CREATE INDEX IF NOT EXISTS cell_paints_lookup ON cell_paints (region_id, cell_key, painted_at DESC);

-- tribe_markers: drop type + region_key, replace index
ALTER TABLE tribe_markers ALTER COLUMN tribe_type_id SET NOT NULL;
ALTER TABLE tribe_markers ALTER COLUMN region_id     SET NOT NULL;
DROP INDEX IF EXISTS tribe_markers_region;
ALTER TABLE tribe_markers DROP COLUMN IF EXISTS type;
ALTER TABLE tribe_markers DROP COLUMN IF EXISTS region_key;
CREATE INDEX IF NOT EXISTS tribe_markers_region ON tribe_markers (region_id);

-- player_settlements: drop resource_type + region_key, replace index
ALTER TABLE player_settlements ALTER COLUMN region_id SET NOT NULL;
DROP INDEX IF EXISTS player_settlements_region;
ALTER TABLE player_settlements DROP COLUMN IF EXISTS resource_type;
ALTER TABLE player_settlements DROP COLUMN IF EXISTS region_key;
CREATE INDEX IF NOT EXISTS player_settlements_region ON player_settlements (region_id);

-- ── Resource type tiers & production chain category FKs ───────────────────

ALTER TABLE resource_types ADD COLUMN IF NOT EXISTS tier INT NOT NULL DEFAULT 1;
UPDATE resource_types SET tier = 1 WHERE name IN ('Ore', 'Wood', 'Stone', 'Raw Food') AND tier != 1;

INSERT INTO resource_types (name, tier) VALUES
  ('Lumber', 2), ('Metal',   2), ('Bricks', 2), ('Food',    2),
  ('Relic',  3), ('Armor',   3), ('Weapon', 3), ('Ware',    3), ('Luxury',  3)
ON CONFLICT (name) DO UPDATE SET tier = EXCLUDED.tier;

ALTER TABLE production_chain ADD COLUMN IF NOT EXISTS processed_category_id UUID REFERENCES resource_types(id);
ALTER TABLE production_chain ADD COLUMN IF NOT EXISTS final1_category_id    UUID REFERENCES resource_types(id);
ALTER TABLE production_chain ADD COLUMN IF NOT EXISTS final2_category_id    UUID REFERENCES resource_types(id);

-- Populate final category FKs from the old string columns (guarded for idempotency)
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_name='production_chain' AND column_name='final1_category') THEN
    UPDATE production_chain pc SET final1_category_id = rt.id
    FROM resource_types rt WHERE rt.name = pc.final1_category AND pc.final1_category_id IS NULL;

    UPDATE production_chain pc SET final2_category_id = rt.id
    FROM resource_types rt WHERE rt.name = pc.final2_category AND pc.final2_category_id IS NULL;
  END IF;
END $$;

-- processed_category_id is always derivable from the resource's raw material type
UPDATE production_chain pc SET processed_category_id = rt.id
FROM resources r
JOIN resource_types raw_rt ON raw_rt.id = r.resource_type_id
JOIN resource_types rt ON rt.name = CASE raw_rt.name
  WHEN 'Ore'      THEN 'Metal'
  WHEN 'Wood'     THEN 'Lumber'
  WHEN 'Stone'    THEN 'Bricks'
  WHEN 'Raw Food' THEN 'Food'
END
WHERE pc.resource_id = r.id AND pc.processed_category_id IS NULL;

ALTER TABLE production_chain DROP COLUMN IF EXISTS final1_category;
ALTER TABLE production_chain DROP COLUMN IF EXISTS final2_category;
