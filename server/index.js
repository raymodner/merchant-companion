import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { pool } from './db.js';
import { auth } from './auth.js';
import authRoutes from './routes/auth.js';

const app = express();
app.use(cors());
app.use(express.json());

app.get('/api/health', (_req, res) => res.json({ ok: true }));

app.use('/api/auth', authRoutes);

// ── Resources & Terrains ──────────────────────────────────────────────────

app.get('/api/terrains', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT name, color, icon FROM terrains ORDER BY name');
    res.json({ terrains: rows });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.patch('/api/resource-locations/:id', auth, async (req, res) => {
  const stars = parseInt(req.body.stars);
  if (isNaN(stars) || stars < 0 || stars > 5) return res.status(400).json({ error: 'stars must be 0–5' });
  try {
    const { rowCount } = await pool.query(
      'UPDATE resource_locations SET stars = $1 WHERE id = $2',
      [stars, req.params.id]
    );
    if (!rowCount) return res.status(404).json({ error: 'Not found' });
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/resources', async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT
        r.id, r.name, r.type, r.icon, r.info, r.available,
        COALESCE(
          json_agg(DISTINCT jsonb_build_object('id', l.id, 'terrain', l.terrain, 'location', l.location, 'stars', l.stars))
          FILTER (WHERE l.id IS NOT NULL), '[]'
        ) AS locations,
        CASE WHEN pc.id IS NOT NULL THEN jsonb_build_object(
          'processed', pc.processed_name,
          'final1', CASE WHEN pc.final1_name IS NOT NULL THEN jsonb_build_object('name', pc.final1_name, 'category', pc.final1_category) END,
          'final2', CASE WHEN pc.final2_name IS NOT NULL THEN jsonb_build_object('name', pc.final2_name, 'category', pc.final2_category) END
        ) END AS chain
      FROM resources r
      LEFT JOIN resource_locations l ON l.resource_id = r.id
      LEFT JOIN production_chain pc ON pc.resource_id = r.id
      GROUP BY r.id, r.name, r.type, r.icon, r.info, r.available,
               pc.id, pc.processed_name, pc.final1_name, pc.final1_category, pc.final2_name, pc.final2_category
      ORDER BY r.type, r.name
    `);
    res.json({ resources: rows });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/regions', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM map_regions ORDER BY parent, name');
    const countries = {}, states = {};
    for (const r of rows) {
      const obj = {
        latMin: parseFloat(r.lat_min), latMax: parseFloat(r.lat_max),
        lngMin: parseFloat(r.lng_min), lngMax: parseFloat(r.lng_max),
        center: r.center_lat ? [parseFloat(r.center_lat), parseFloat(r.center_lng)] : null,
        zoom: r.zoom,
      };
      if (r.parent === '') countries[r.name] = obj;
      else states[r.name] = obj;
    }
    res.json({ countries, states });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── Terrain ───────────────────────────────────────────────────────────────

// Public: latest paint per cell for a region
app.get('/api/terrain/:region', async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT DISTINCT ON (cell_key) cell_key, terrain_key
      FROM cell_paints
      WHERE region_key = $1
      ORDER BY cell_key, painted_at DESC
    `, [req.params.region]);
    const data = {};
    for (const row of rows) {
      if (row.terrain_key) data[row.cell_key] = row.terrain_key;
    }
    res.json({ data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Auth required: record a single cell paint (or erase when terrainKey is null)
app.post('/api/terrain/:region/cell', auth, async (req, res) => {
  const { cellKey, terrainKey } = req.body;
  if (!cellKey) return res.status(400).json({ error: 'cellKey required' });
  try {
    await pool.query(
      'INSERT INTO cell_paints (region_key, cell_key, terrain_key, user_id) VALUES ($1, $2, $3, $4)',
      [req.params.region, cellKey, terrainKey || null, req.user.id]
    );
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Auth required: bulk import — clears history for region and inserts new data
app.post('/api/terrain/:region/import', auth, async (req, res) => {
  const { data } = req.body;
  if (!data || typeof data !== 'object') return res.status(400).json({ error: 'data required' });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('DELETE FROM cell_paints WHERE region_key = $1', [req.params.region]);
    for (const [cellKey, terrainKey] of Object.entries(data)) {
      if (!terrainKey) continue;
      await client.query(
        'INSERT INTO cell_paints (region_key, cell_key, terrain_key, user_id) VALUES ($1, $2, $3, $4)',
        [req.params.region, cellKey, terrainKey, req.user.id]
      );
    }
    await client.query('COMMIT');
    res.json({ ok: true });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

// Auth required: hard reset — deletes all paint history for the region
app.delete('/api/terrain/:region', auth, async (req, res) => {
  try {
    await pool.query('DELETE FROM cell_paints WHERE region_key = $1', [req.params.region]);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`API server → http://localhost:${PORT}`));
