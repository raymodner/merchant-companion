import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { pool } from '../db.js';
import { auth } from '../auth.js';

const router = Router();
const secret = () => process.env.JWT_SECRET;
const COOKIE_OPTS = {
  httpOnly: true,
  sameSite: 'lax',
  secure: process.env.NODE_ENV === 'production',
  maxAge: 7 * 24 * 60 * 60 * 1000,
};

const PUBLIC_FIELDS = 'id, username, email, preferred_country, preferred_state';

router.post('/register', async (req, res) => {
  const { username, email, password } = req.body;
  if (!username || !email || !password)
    return res.status(400).json({ error: 'All fields required' });
  try {
    const hash = await bcrypt.hash(password, 10);
    const { rows } = await pool.query(
      `INSERT INTO users (username, email, password) VALUES ($1, $2, $3) RETURNING ${PUBLIC_FIELDS}`,
      [username, email, hash]
    );
    const token = jwt.sign({ id: rows[0].id, username: rows[0].username }, secret(), { expiresIn: '7d' });
    res.cookie('token', token, COOKIE_OPTS).json({ user: rows[0] });
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Username or email already taken' });
    res.status(500).json({ error: err.message });
  }
});

router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email and password required' });
  try {
    const { rows } = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    if (!rows.length || !(await bcrypt.compare(password, rows[0].password)))
      return res.status(401).json({ error: 'Invalid credentials' });
    const token = jwt.sign({ id: rows[0].id, username: rows[0].username }, secret(), { expiresIn: '7d' });
    res.cookie('token', token, COOKIE_OPTS).json({ user: { id: rows[0].id, username: rows[0].username, email: rows[0].email, preferred_country: rows[0].preferred_country, preferred_state: rows[0].preferred_state } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/me', auth, async (req, res) => {
  try {
    const { rows } = await pool.query(`SELECT ${PUBLIC_FIELDS} FROM users WHERE id = $1`, [req.user.id]);
    if (!rows.length) return res.status(404).json({ error: 'User not found' });
    res.json({ user: rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.patch('/preferences', auth, async (req, res) => {
  const { country, state } = req.body;
  try {
    await pool.query(
      'UPDATE users SET preferred_country = $1, preferred_state = $2 WHERE id = $3',
      [country || null, state || null, req.user.id]
    );
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/logout', (_req, res) => {
  res.clearCookie('token', COOKIE_OPTS).json({ ok: true });
});

export default router;
