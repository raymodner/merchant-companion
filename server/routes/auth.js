import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { pool } from '../db.js';
import { auth } from '../auth.js';

const router = Router();
const secret = () => process.env.JWT_SECRET || 'dev-secret-change-me';

router.post('/register', async (req, res) => {
  const { username, email, password } = req.body;
  if (!username || !email || !password)
    return res.status(400).json({ error: 'All fields required' });
  try {
    const hash = await bcrypt.hash(password, 10);
    const { rows } = await pool.query(
      'INSERT INTO users (username, email, password) VALUES ($1, $2, $3) RETURNING id, username, email',
      [username, email, hash]
    );
    const token = jwt.sign({ id: rows[0].id, username: rows[0].username }, secret(), { expiresIn: '7d' });
    res.json({ token, user: rows[0] });
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
    res.json({ token, user: { id: rows[0].id, username: rows[0].username, email: rows[0].email } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/me', auth, (req, res) => res.json({ user: req.user }));

export default router;
