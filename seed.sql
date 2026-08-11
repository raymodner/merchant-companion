-- ── Static lookup data ────────────────────────────────────────────────────

INSERT INTO resource_types (name, tier) VALUES
  ('Ore',      1), ('Wood',    1), ('Stone',  1), ('Raw Food', 1),
  ('Lumber',   2), ('Metal',   2), ('Bricks', 2), ('Food',     2),
  ('Relic',    3), ('Armor',   3), ('Weapon', 3), ('Ware',     3), ('Luxury',  3)
ON CONFLICT (name) DO UPDATE SET tier = EXCLUDED.tier;

INSERT INTO tribe_types (name, sort_order) VALUES ('Camp', 1), ('Selo', 2), ('Burgh', 3)
ON CONFLICT (name) DO UPDATE SET sort_order = EXCLUDED.sort_order;

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

-- ── Terrains ──────────────────────────────────────────────────────────────

INSERT INTO terrains (name, color, icon) VALUES
  ('Flat',     '#72c24a', '🌾'),
  ('Arid',     '#d4980a', '🌵'),
  ('Desert',   '#f0d040', '🏜️'),
  ('Tropical', '#1a7d38', '🌴'),
  ('Wet',      '#2878c0', '💧'),
  ('Cold',     '#a0d4ee', '❄️'),
  ('Hill',     '#3a9e7a', '⛰️'),
  ('Mountain', '#b86820', '🏔️')
ON CONFLICT (name) DO UPDATE SET color = EXCLUDED.color, icon = EXCLUDED.icon;

-- ── Resources ─────────────────────────────────────────────────────────────

INSERT INTO resources (name, resource_type_id, icon, info, available)
SELECT v.name, rt.id, v.icon, v.info, v.avail
FROM (VALUES
  ('Tin Ore',       'Ore',      '⛏️', 'Used in crafting bronze tools and alloys.',             TRUE),
  ('Copper Ore',    'Ore',      '⛏️', 'Used for early tools, weapons and currency.',            TRUE),
  ('Iron Ore',      'Ore',      '⛏️', 'Essential for crafting iron tools, weapons and armor.',  TRUE),
  ('Alloy Ore',     'Ore',      '⛏️', 'A special ore not found in local settlements.',          FALSE),
  ('Clay',          'Stone',    '🏺', 'Used for pottery, bricks and construction.',             TRUE),
  ('Sandstone',     'Stone',    '🪨', 'A sedimentary rock used in arid region construction.',   TRUE),
  ('Limestone',     'Stone',    '🪨', 'A common building material and source of lime.',         TRUE),
  ('Granite',       'Stone',    '🪨', 'A hard igneous rock used in high-quality construction.',  TRUE),
  ('FieldStone',    'Stone',    '🪨', 'Rough stone not found in local settlements.',             FALSE),
  ('White Oak',     'Wood',     '🌳', 'A durable hardwood prized for furniture and shipbuilding.', TRUE),
  ('Rosewood',      'Wood',     '🌲', 'A fine fragrant hardwood used in luxury goods.',          TRUE),
  ('Palm Tree',     'Wood',     '🌴', 'Provides timber, fiber and food products.',               TRUE),
  ('Mahogany',      'Wood',     '🌲', 'A prized tropical hardwood used in fine furniture.',      TRUE),
  ('Maple',         'Wood',     '🍁', 'A hardwood also used for syrup and charcoal production.', TRUE),
  ('Red Oak',       'Wood',     '🌲', 'A strong hardwood used in construction and barrels.',     TRUE),
  ('Chestnut Wood', 'Wood',     '🌰', 'Rot-resistant wood used for furniture and fencing.',      TRUE),
  ('Pine',          'Wood',     '🌲', 'A versatile softwood used for construction and paper.',   TRUE),
  ('Poplar',        'Wood',     '🌲', 'A fast-growing wood not found in local settlements.',     FALSE),
  ('Milk',          'Raw Food', '🥛', 'Produced by grazing cattle. Used in cheese and butter.',  TRUE),
  ('Rye',           'Raw Food', '🌾', 'A hardy grain used for bread and whiskey.',               TRUE),
  ('Maize',         'Raw Food', '🌽', 'A versatile crop used for flour, oil and animal feed.',   TRUE),
  ('Chickpeas',     'Raw Food', '🫘', 'A protein-rich legume grown in dry climates.',            TRUE),
  ('Pig',           'Raw Food', '🐷', 'Provides pork, lard and leather.',                        TRUE),
  ('Chicken',       'Raw Food', '🐔', 'Provides meat, eggs and feathers.',                       TRUE),
  ('Rice',          'Raw Food', '🌾', 'A staple grain requiring wet conditions.',                 TRUE),
  ('Trout',         'Raw Food', '🐟', 'A prized freshwater fish.',                               TRUE),
  ('Barley',        'Raw Food', '🌾', 'A grain used for bread, beer and animal feed.',           TRUE),
  ('Salmon',        'Raw Food', '🐟', 'A prized fish from cold, fast-moving waters.',            TRUE),
  ('Grapes',        'Raw Food', '🍇', 'Used for wine, raisins and fresh eating.',                TRUE),
  ('Potatoes',      'Raw Food', '🥔', 'A versatile root vegetable for cold climates.',           TRUE)
) AS v(name, type_name, icon, info, avail)
JOIN resource_types rt ON rt.name = v.type_name
ON CONFLICT (name) DO UPDATE SET
  resource_type_id = EXCLUDED.resource_type_id,
  icon = EXCLUDED.icon, info = EXCLUDED.info, available = EXCLUDED.available;

-- ── Resource locations ────────────────────────────────────────────────────

DROP TABLE IF EXISTS _rl;
CREATE TEMP TABLE _rl (res_name TEXT, terrain TEXT, location TEXT, stars INT);

INSERT INTO _rl VALUES
  ('Tin Ore','Flat','Plains',0), ('Tin Ore','Flat','Moorland',0),
  ('Tin Ore','Flat','Scrubland',0), ('Tin Ore','Flat','Swamp',0),
  ('Tin Ore','Desert','Desert',0), ('Tin Ore','Desert','Salt Flats',0),
  ('Tin Ore','Desert','Plateau',0), ('Tin Ore','Desert','Savannah',0),
  ('Tin Ore','Desert','Dunes',0), ('Tin Ore','Desert','Scrubland',0),
  ('Tin Ore','Desert','Steppe',0),
  ('Tin Ore','Wet','Delta',0), ('Tin Ore','Wet','Tundra',0),
  ('Tin Ore','Wet','Lake',0), ('Tin Ore','Wet','Moorland',0),
  ('Tin Ore','Wet','Bushes',0), ('Tin Ore','Wet','Swamp',0),
  ('Copper Ore','Arid','Prairie',0), ('Copper Ore','Arid','Savannah',0),
  ('Copper Ore','Arid','Steppe',0), ('Copper Ore','Arid','Dunes',0),
  ('Copper Ore','Arid','Salt Flats',0), ('Copper Ore','Arid','Canyon',0),
  ('Copper Ore','Arid','Rocks',0),
  ('Copper Ore','Mountain','Caves',0), ('Copper Ore','Mountain','Peaks',0),
  ('Copper Ore','Mountain','Rocks',0), ('Copper Ore','Mountain','Canyon',0),
  ('Copper Ore','Mountain','Extinct volcano',0), ('Copper Ore','Mountain','Waterfall',0),
  ('Copper Ore','Mountain','Mountain',0), ('Copper Ore','Mountain','Plateau',0),
  ('Iron Ore','Tropical','Extinct volcano',0), ('Iron Ore','Tropical','Bushes',0),
  ('Iron Ore','Tropical','Lake',0),
  ('Iron Ore','Cold','Arctic Tundra',0), ('Iron Ore','Cold','Glacier',0),
  ('Iron Ore','Cold','Mountain',0), ('Iron Ore','Cold','Tundra',0),
  ('Iron Ore','Hill','Hills',0), ('Iron Ore','Hill','Rocky Plains',0),
  ('Iron Ore','Hill','Forested Hills',0), ('Iron Ore','Hill','River',0),
  ('Iron Ore','Hill','Waterfall',0),
  ('Clay','Flat','Plains',0), ('Clay','Flat','Floodplains',0),
  ('Clay','Flat','Moorland',0), ('Clay','Flat','Swamp',0),
  ('Clay','Wet','Wetland',0), ('Clay','Wet','Marsh',0),
  ('Clay','Wet','Tundra',0), ('Clay','Wet','Lake',0),
  ('Clay','Wet','Moorland',0), ('Clay','Wet','Swamp',0),
  ('Sandstone','Arid','Prairie',0), ('Sandstone','Arid','Volcano',0),
  ('Sandstone','Arid','Savannah',0), ('Sandstone','Arid','Dunes',0),
  ('Sandstone','Arid','Salt Flats',0), ('Sandstone','Arid','Canyon',0),
  ('Sandstone','Arid','Rocks',0),
  ('Sandstone','Desert','Desert',0), ('Sandstone','Desert','Salt Flats',0),
  ('Sandstone','Desert','Plateau',0), ('Sandstone','Desert','Savannah',0),
  ('Sandstone','Desert','Dunes',0),
  ('Limestone','Tropical','Extinct volcano',0), ('Limestone','Tropical','Forested Hills',0),
  ('Limestone','Tropical','Lake',0),
  ('Limestone','Cold','Arctic Tundra',0), ('Limestone','Cold','Glacier',0),
  ('Limestone','Cold','Mountain',0), ('Limestone','Cold','Marsh',0),
  ('Limestone','Cold','Tundra',0), ('Limestone','Cold','River',0),
  ('Granite','Hill','Hills',0), ('Granite','Hill','Rocky Plains',0),
  ('Granite','Hill','Forested Hills',0), ('Granite','Hill','River',0),
  ('Granite','Hill','Waterfall',0),
  ('Granite','Mountain','Caves',0), ('Granite','Mountain','Peaks',0),
  ('Granite','Mountain','Rocks',0), ('Granite','Mountain','Canyon',0),
  ('Granite','Mountain','Extinct volcano',0), ('Granite','Mountain','Waterfall',0),
  ('Granite','Mountain','Mountain',0), ('Granite','Mountain','Plateau',0),
  ('White Oak','Flat','Woods',0), ('White Oak','Flat','Moorland',0),
  ('White Oak','Flat','River',0), ('White Oak','Flat','Forest',0),
  ('White Oak','Flat','Scrubland',0), ('White Oak','Flat','Swamp',0),
  ('Rosewood','Arid','Prairie',0), ('Rosewood','Arid','Volcano',0),
  ('Rosewood','Arid','Savannah',0),
  ('Palm Tree','Desert','Oasis',0), ('Palm Tree','Desert','Savannah',0),
  ('Palm Tree','Desert','Scrubland',0),
  ('Mahogany','Tropical','Rainforest',0), ('Mahogany','Tropical','Jungle',0),
  ('Mahogany','Tropical','Forested Hills',0), ('Mahogany','Tropical','River',0),
  ('Mahogany','Tropical','Forest',0), ('Mahogany','Tropical','Bushes',0),
  ('Maple','Wet','Lake',0), ('Maple','Wet','Moorland',0),
  ('Maple','Wet','Bushes',0), ('Maple','Wet','Swamp',0),
  ('Red Oak','Cold','Dark Forest',0), ('Red Oak','Cold','Mountain',0),
  ('Red Oak','Cold','Taiga',0),
  ('Chestnut Wood','Hill','Dark Forest',0), ('Chestnut Wood','Hill','Forested Hills',0),
  ('Chestnut Wood','Hill','Woods',0), ('Chestnut Wood','Hill','Waterfall',0),
  ('Chestnut Wood','Hill','Taiga',0),
  ('Pine','Mountain','Extinct volcano',0), ('Pine','Mountain','Waterfall',0),
  ('Pine','Mountain','Mountain',0),
  ('Milk','Flat','Plains',0), ('Milk','Flat','Woods',0),
  ('Milk','Flat','Moorland',0), ('Milk','Flat','Forest',0),
  ('Rye','Flat','Floodplains',0), ('Rye','Flat','River',0),
  ('Rye','Arid','Prairie',0), ('Rye','Arid','Steppe',0),
  ('Maize','Arid','Volcano',0), ('Maize','Arid','Savannah',0),
  ('Chickpeas','Desert','Oasis',0),
  ('Pig','Desert','Plateau',0), ('Pig','Desert','Savannah',0),
  ('Pig','Desert','Steppe',0),
  ('Pig','Tropical','Jungle',0), ('Pig','Tropical','Extinct volcano',0),
  ('Pig','Tropical','Forested Hills',0), ('Pig','Tropical','River',0),
  ('Pig','Tropical','Lake',0),
  ('Chicken','Tropical','Rainforest',0), ('Chicken','Tropical','Forest',0),
  ('Chicken','Tropical','Bushes',0),
  ('Rice','Wet','Wetland',0), ('Rice','Wet','Marsh',0),
  ('Rice','Wet','Tundra',0), ('Rice','Wet','Moorland',0),
  ('Trout','Wet','Delta',0), ('Trout','Wet','Lake',0),
  ('Trout','Hill','River',0), ('Trout','Hill','Waterfall',0),
  ('Barley','Cold','Arctic Tundra',0), ('Barley','Cold','Dark Forest',0),
  ('Barley','Cold','Tundra',0), ('Barley','Cold','Taiga',0),
  ('Salmon','Cold','Marsh',0), ('Salmon','Cold','River',0),
  ('Salmon','Mountain','Waterfall',0),
  ('Grapes','Hill','Hills',0), ('Grapes','Hill','Rocky Plains',0),
  ('Grapes','Hill','Dark Forest',0), ('Grapes','Hill','Forested Hills',0),
  ('Grapes','Hill','Woods',0), ('Grapes','Hill','Taiga',0),
  ('Potatoes','Mountain','Extinct volcano',0), ('Potatoes','Mountain','Mountain',0),
  ('Potatoes','Mountain','Plateau',0);

INSERT INTO locations (name, terrain_id)
SELECT DISTINCT _rl.location, t.id
FROM _rl JOIN terrains t ON t.name = _rl.terrain
ON CONFLICT (name, terrain_id) DO NOTHING;

INSERT INTO resource_locations (resource_id, location_id)
SELECT r.id, l.id
FROM _rl
JOIN resources r ON r.name = _rl.res_name
JOIN terrains  t ON t.name = _rl.terrain
JOIN locations l ON l.name = _rl.location AND l.terrain_id = t.id
ON CONFLICT (resource_id, location_id) DO NOTHING;

DROP TABLE _rl;

-- ── Production chains ─────────────────────────────────────────────────────

INSERT INTO production_chain (resource_id, processed_name, processed_category_id, final1_name, final1_category_id, final2_name, final2_category_id)
SELECT r.id, v.proc, pc_cat.id, v.f1, f1_cat.id, v.f2, f2_cat.id
FROM (VALUES
  ('Rye',           'Rye Bread',        'Rye Beer',          'Luxury', NULL,        NULL),
  ('Salmon',        'Salmon Filet',      'Smoked Salmon',     'Luxury', NULL,        NULL),
  ('Chicken',       'Chicken Meat',      'Smoked Chicken',    'Luxury', NULL,        NULL),
  ('Rice',          'White Rice',        'Sake',              'Luxury', NULL,        NULL),
  ('Pig',           'Pork',              'Sausage',           'Luxury', NULL,        NULL),
  ('Grapes',        'Grape Juice',       'Wine',              'Luxury', NULL,        NULL),
  ('Trout',         'Trout Filet',       'Smoked Trout',      'Luxury', NULL,        NULL),
  ('Barley',        'Malt',              'Whiskey',           'Luxury', NULL,        NULL),
  ('Milk',          'Butter',            'Cheese',            'Luxury', NULL,        NULL),
  ('Potatoes',      'Fries',             'Wodka',             'Luxury', NULL,        NULL),
  ('Maize',         'Maize Flour',       'Tortillas',         'Luxury', NULL,        NULL),
  ('Chickpeas',     'Chickpea Flour',    'Hummus',            'Luxury', NULL,        NULL),
  ('Clay',          'Clay Bricks',       'Monument',          'Relic',  'Pot',       'Ware'),
  ('Granite',       'Granite Blocks',    'Column',            'Relic',  'Mortar',    'Ware'),
  ('Limestone',     'Limestone Blocks',  'Arch',              'Relic',  'Jar',       'Ware'),
  ('Sandstone',     'Sandstone Blocks',  'Vase',              'Relic',  'Glass Bowl','Ware'),
  ('FieldStone',    'Fieldstone Blocks', NULL,                NULL,     NULL,        NULL),
  ('Iron Ore',      'Iron',              'Ironwork',          'Relic',  'Sword',     'Weapon'),
  ('Copper Ore',    'Copper',            'Statue',            'Relic',  'Helmet',    'Armor'),
  ('Tin Ore',       'Tin',               'Chandelier',        'Relic',  'Chainmail', 'Armor'),
  ('Alloy Ore',     'Alloy',             NULL,                NULL,     NULL,        NULL),
  ('White Oak',     'White Oak Planks',  'Logbow',            'Weapon', 'Table',     'Ware'),
  ('Chestnut Wood', 'Chestnut Planks',   'Crossbow',          'Weapon', 'Chest',     'Ware'),
  ('Palm Tree',     'Flywood',           'Spear',             'Weapon', 'Bookcase',  'Ware'),
  ('Red Oak',       'Red Oak Planks',    'Catapult',          'Weapon', 'Chair',     'Ware'),
  ('Rosewood',      'Rosewood Planks',   'Longbow',           'Weapon', 'Hatstand',  'Ware'),
  ('Maple',         'Maple Planks',      'Crossbow',          'Weapon', 'Stool',     'Ware'),
  ('Mahogany',      'Mahogany Planks',   'Catapult',          'Weapon', 'Bench',     'Ware'),
  ('Pine',          'Deal Timber',       'Spear',             'Weapon', 'Desk',      'Ware'),
  ('Poplar',        'Poplar Planks',     NULL,                NULL,     NULL,        NULL)
) AS v(res_name, proc, f1, c1, f2, c2)
JOIN resources r ON r.name = v.res_name
JOIN resource_types raw_rt ON raw_rt.id = r.resource_type_id
JOIN resource_types pc_cat ON pc_cat.name = CASE raw_rt.name
  WHEN 'Ore'      THEN 'Metal'
  WHEN 'Wood'     THEN 'Lumber'
  WHEN 'Stone'    THEN 'Bricks'
  WHEN 'Raw Food' THEN 'Food'
END
LEFT JOIN resource_types f1_cat ON f1_cat.name = v.c1
LEFT JOIN resource_types f2_cat ON f2_cat.name = v.c2
ON CONFLICT (resource_id) DO UPDATE SET
  processed_name        = EXCLUDED.processed_name,
  processed_category_id = EXCLUDED.processed_category_id,
  final1_name           = EXCLUDED.final1_name,
  final1_category_id    = EXCLUDED.final1_category_id,
  final2_name           = EXCLUDED.final2_name,
  final2_category_id    = EXCLUDED.final2_category_id;

-- ── Map regions ───────────────────────────────────────────────────────────

INSERT INTO map_regions (name, parent_id, lat_min, lat_max, lng_min, lng_max, center_lat, center_lng, zoom) VALUES
  ('Netherlands',    NULL, 50.7, 53.6,   3.3,   7.3, 52.3,   5.3, 8),
  ('Belgium',        NULL, 49.5, 51.5,   2.5,   6.4, 50.6,   4.5, 8),
  ('Luxembourg',     NULL, 49.4, 50.2,   5.7,   6.5, 49.8,   6.1, 9),
  ('Germany',        NULL, 47.3, 55.1,   5.9,  15.1, 51.2,  10.5, 6),
  ('France',         NULL, 41.3, 51.1,  -5.1,   9.6, 46.5,   2.3, 6),
  ('United Kingdom', NULL, 49.9, 60.9,  -8.2,   1.8, 54.5,  -3.5, 6),
  ('Ireland',        NULL, 51.4, 55.4, -10.5,  -5.9, 53.2,  -8.2, 7),
  ('Spain',          NULL, 35.9, 43.8,  -9.3,   4.3, 40.4,  -3.7, 6),
  ('Portugal',       NULL, 36.9, 42.2,  -9.5,  -6.2, 39.6,  -8.0, 7),
  ('Italy',          NULL, 35.5, 47.1,   6.6,  18.5, 42.5,  12.5, 6),
  ('Switzerland',    NULL, 45.8, 47.8,   5.9,  10.5, 46.8,   8.2, 8),
  ('Austria',        NULL, 46.4, 49.0,   9.5,  17.2, 47.7,  13.3, 7),
  ('Denmark',        NULL, 54.6, 57.8,   8.1,  15.2, 56.2,  11.7, 7),
  ('Norway',         NULL, 57.9, 71.2,   4.5,  31.2, 64.6,  15.0, 5),
  ('Sweden',         NULL, 55.3, 69.1,  11.0,  24.2, 62.2,  17.5, 5),
  ('Finland',        NULL, 59.8, 70.1,  20.0,  31.6, 64.5,  26.0, 5),
  ('Poland',         NULL, 49.0, 54.9,  14.1,  24.2, 52.0,  19.1, 6),
  ('Czech Republic', NULL, 48.6, 51.1,  12.1,  18.9, 49.8,  15.5, 7),
  ('United States',  NULL, 24.5, 49.4,-124.8, -66.9, 39.5, -98.5, 5)
ON CONFLICT (name, COALESCE(parent_id, '00000000-0000-0000-0000-000000000000'::uuid)) DO UPDATE SET
  lat_min = EXCLUDED.lat_min, lat_max = EXCLUDED.lat_max,
  lng_min = EXCLUDED.lng_min, lng_max = EXCLUDED.lng_max,
  center_lat = EXCLUDED.center_lat, center_lng = EXCLUDED.center_lng,
  zoom = EXCLUDED.zoom;

INSERT INTO map_regions (name, parent_id, lat_min, lat_max, lng_min, lng_max, center_lat, center_lng, zoom)
SELECT v.name, p.id, v.lat_min, v.lat_max, v.lng_min, v.lng_max, v.center_lat, v.center_lng, v.zoom
FROM (VALUES
  ('Norway',  'South', 57.9, 64.5,  4.5, 31.2, 61.2,  8.0, 7),
  ('Norway',  'North', 64.5, 71.2,  4.5, 31.2, 67.8, 15.0, 6),
  ('Sweden',  'South', 55.3, 62.5, 11.0, 24.2, 58.8, 17.5, 7),
  ('Sweden',  'North', 62.5, 69.1, 11.0, 24.2, 65.5, 17.5, 6),
  ('Finland', 'South', 59.8, 65.0, 20.0, 31.6, 62.4, 25.0, 7),
  ('Finland', 'North', 65.0, 70.1, 20.0, 31.6, 67.5, 26.0, 6)
) AS v(country, name, lat_min, lat_max, lng_min, lng_max, center_lat, center_lng, zoom)
JOIN map_regions p ON p.name = v.country AND p.parent_id IS NULL
ON CONFLICT (name, COALESCE(parent_id, '00000000-0000-0000-0000-000000000000'::uuid)) DO UPDATE SET
  lat_min = EXCLUDED.lat_min, lat_max = EXCLUDED.lat_max,
  lng_min = EXCLUDED.lng_min, lng_max = EXCLUDED.lng_max,
  center_lat = EXCLUDED.center_lat, center_lng = EXCLUDED.center_lng,
  zoom = EXCLUDED.zoom;

INSERT INTO map_regions (name, parent_id, lat_min, lat_max, lng_min, lng_max)
SELECT v.name, us.id, v.lat_min, v.lat_max, v.lng_min, v.lng_max
FROM (VALUES
  ('Alabama',        30.2, 35.0,  -88.5,  -84.9),
  ('Arizona',        31.3, 37.0, -114.8, -109.0),
  ('Arkansas',       33.0, 36.5,  -94.6,  -89.6),
  ('California',     32.5, 42.0, -124.5, -114.1),
  ('Colorado',       37.0, 41.0, -109.1, -102.0),
  ('Connecticut',    41.0, 42.1,  -73.7,  -71.8),
  ('Delaware',       38.5, 39.8,  -75.8,  -75.0),
  ('Florida',        24.5, 31.0,  -87.6,  -80.0),
  ('Georgia',        30.4, 35.0,  -85.6,  -80.8),
  ('Hawaii',         18.9, 22.2, -160.3, -154.8),
  ('Idaho',          42.0, 49.0, -117.2, -111.0),
  ('Illinois',       37.0, 42.5,  -91.5,  -87.5),
  ('Indiana',        37.8, 41.8,  -88.1,  -84.8),
  ('Iowa',           40.4, 43.5,  -96.6,  -90.1),
  ('Kansas',         37.0, 40.0, -102.1,  -94.6),
  ('Kentucky',       36.5, 39.1,  -89.6,  -81.9),
  ('Louisiana',      29.0, 33.0,  -94.1,  -89.0),
  ('Maine',          43.1, 47.5,  -71.1,  -66.9),
  ('Maryland',       37.9, 39.7,  -79.5,  -75.1),
  ('Massachusetts',  41.2, 42.9,  -73.5,  -69.9),
  ('Michigan',       41.7, 48.3,  -90.4,  -82.4),
  ('Minnesota',      43.5, 49.4,  -97.2,  -89.5),
  ('Mississippi',    30.2, 35.0,  -91.7,  -88.1),
  ('Missouri',       36.0, 40.6,  -95.8,  -89.1),
  ('Montana',        44.4, 49.0, -116.1, -104.0),
  ('Nebraska',       40.0, 43.0, -104.1,  -95.3),
  ('Nevada',         35.0, 42.0, -120.0, -114.0),
  ('New Hampshire',  42.7, 45.3,  -72.6,  -70.7),
  ('New Jersey',     38.9, 41.4,  -75.6,  -73.9),
  ('New Mexico',     31.3, 37.0, -109.1, -103.0),
  ('New York',       40.5, 45.0,  -79.8,  -71.9),
  ('North Carolina', 33.8, 36.6,  -84.3,  -75.5),
  ('North Dakota',   45.9, 49.0, -104.1,  -96.6),
  ('Ohio',           38.4, 42.3,  -84.8,  -80.5),
  ('Oklahoma',       33.6, 37.0, -103.0,  -94.4),
  ('Oregon',         42.0, 46.3, -124.6, -116.5),
  ('Pennsylvania',   39.7, 42.3,  -80.5,  -74.7),
  ('Rhode Island',   41.1, 42.0,  -71.9,  -71.1),
  ('South Carolina', 32.0, 35.2,  -83.4,  -78.5),
  ('South Dakota',   42.5, 45.9, -104.1,  -96.4),
  ('Tennessee',      35.0, 36.7,  -90.3,  -81.6),
  ('Texas',          25.8, 36.5, -106.7,  -93.5),
  ('Utah',           37.0, 42.0, -114.1, -109.0),
  ('Vermont',        42.7, 45.0,  -73.4,  -71.5),
  ('Virginia',       36.5, 39.5,  -83.7,  -75.2),
  ('Washington',     45.5, 49.0, -124.8, -116.9),
  ('West Virginia',  37.2, 40.6,  -82.6,  -77.7),
  ('Wisconsin',      42.5, 47.1,  -92.9,  -86.8),
  ('Wyoming',        41.0, 45.0, -111.1, -104.1)
) AS v(name, lat_min, lat_max, lng_min, lng_max)
JOIN map_regions us ON us.name = 'United States' AND us.parent_id IS NULL
ON CONFLICT (name, COALESCE(parent_id, '00000000-0000-0000-0000-000000000000'::uuid)) DO UPDATE SET
  lat_min = EXCLUDED.lat_min, lat_max = EXCLUDED.lat_max,
  lng_min = EXCLUDED.lng_min, lng_max = EXCLUDED.lng_max;

INSERT INTO map_regions (name, parent_id, lat_min, lat_max, lng_min, lng_max, center_lat, center_lng, zoom)
SELECT v.name, us.id, v.lat_min, v.lat_max, v.lng_min, v.lng_max, v.center_lat, v.center_lng, v.zoom
FROM (VALUES
  ('Alaska Southwest', 54.6, 63.0, -168.0, -149.0, 58.8, -158.5, 6),
  ('Alaska Southeast', 54.6, 63.0, -149.0, -129.9, 58.8, -139.5, 6),
  ('Alaska Northwest', 63.0, 71.4, -168.0, -149.0, 67.2, -158.5, 6),
  ('Alaska Northeast', 63.0, 71.4, -149.0, -129.9, 67.2, -139.5, 6)
) AS v(name, lat_min, lat_max, lng_min, lng_max, center_lat, center_lng, zoom)
JOIN map_regions us ON us.name = 'United States' AND us.parent_id IS NULL
ON CONFLICT (name, COALESCE(parent_id, '00000000-0000-0000-0000-000000000000'::uuid)) DO UPDATE SET
  lat_min = EXCLUDED.lat_min, lat_max = EXCLUDED.lat_max,
  lng_min = EXCLUDED.lng_min, lng_max = EXCLUDED.lng_max,
  center_lat = EXCLUDED.center_lat, center_lng = EXCLUDED.center_lng,
  zoom = EXCLUDED.zoom;
