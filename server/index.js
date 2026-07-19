import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { pool } from './db.js';

const app = express();
app.use(cors());
app.use(express.json());

// ── Health ────────────────────────────────────────────────────────────────
app.get('/api/health', (_req, res) => res.json({ ok: true }));

// ── Load terrain for a region ─────────────────────────────────────────────
app.get('/api/terrain/:region', async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT data FROM regions WHERE region_key = $1',
      [req.params.region]
    );
    // pg auto-parses JSONB columns into JS objects
    res.json({ data: rows[0]?.data ?? {} });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Save (upsert) terrain for a region ───────────────────────────────────
app.post('/api/terrain/:region', async (req, res) => {
  try {
    await pool.query(
      `INSERT INTO regions (region_key, data)
       VALUES ($1, $2)
       ON CONFLICT (region_key)
       DO UPDATE SET data = EXCLUDED.data, updated_at = NOW()`,
      [req.params.region, req.body.data]
    );
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Delete terrain for a region ───────────────────────────────────────────
app.delete('/api/terrain/:region', async (req, res) => {
  try {
    await pool.query('DELETE FROM regions WHERE region_key = $1', [req.params.region]);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`API server → http://localhost:${PORT}`));
