import { Router } from 'express'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import rateLimit from 'express-rate-limit'
import { prisma } from '../prisma.js'
import { auth } from '../auth.js'
import { isEmail } from '../validate.js'

const router = Router()

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { error: 'Too many attempts, please try again later' },
  standardHeaders: true,
  legacyHeaders: false,
})

const secret = () => process.env.JWT_SECRET
const DUMMY_HASH = '$2a$10$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA'
const COOKIE_OPTS = {
  httpOnly: true,
  sameSite: 'lax',
  secure: process.env.NODE_ENV === 'production' || process.env.COOKIE_SECURE === 'true',
  maxAge: 24 * 60 * 60 * 1000,
}

function toPublicUser(u) {
  return {
    id: u.id,
    username: u.username,
    email: u.email,
    preferred_country: u.preferredCountry ?? null,
    preferred_state: u.preferredState ?? null,
  }
}

router.post('/register', authLimiter, async (req, res) => {
  const { username, email, password } = req.body
  if (!username || !email || !password)
    return res.status(400).json({ error: 'All fields required' })
  const u = username.trim()
  const e = email.trim()
  if (u.length < 3 || u.length > 50)
    return res.status(400).json({ error: 'Username must be 3–50 characters' })
  if (!/^[\w\-]+$/.test(u))
    return res.status(400).json({ error: 'Username may only contain letters, numbers, _ and -' })
  if (!isEmail(e))
    return res.status(400).json({ error: 'Invalid email address' })
  if (e.length > 254)
    return res.status(400).json({ error: 'Email must be 254 characters or fewer' })
  if (password.length < 8)
    return res.status(400).json({ error: 'Password must be at least 8 characters' })
  if (password.length > 72)
    return res.status(400).json({ error: 'Password must be 72 characters or fewer' })
  try {
    const hash = await bcrypt.hash(password, 10)
    const user = await prisma.user.create({
      data: { username: u, email: e, password: hash },
    })
    const token = jwt.sign({ id: user.id, username: user.username }, secret(), { expiresIn: '24h' })
    res.cookie('token', token, COOKIE_OPTS).json({ user: toPublicUser(user) })
  } catch (err) {
    if (err.code === 'P2002') return res.status(409).json({ error: 'Username or email already taken' })
    console.error(err)
    res.status(500).json({ error: 'Internal server error' })
  }
})

router.post('/login', authLimiter, async (req, res) => {
  const { email, password } = req.body
  if (!email || !password) return res.status(400).json({ error: 'Email and password required' })
  const e = email.trim()
  if (!isEmail(e)) return res.status(400).json({ error: 'Invalid email address' })
  try {
    const user = await prisma.user.findUnique({ where: { email: e } })
    const valid = await bcrypt.compare(password, user?.password ?? DUMMY_HASH)
    if (!user || !valid) return res.status(401).json({ error: 'Invalid credentials' })
    const token = jwt.sign({ id: user.id, username: user.username }, secret(), { expiresIn: '24h' })
    res.cookie('token', token, COOKIE_OPTS).json({ user: toPublicUser(user) })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Internal server error' })
  }
})

router.get('/me', auth, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.user.id } })
    if (!user) return res.status(404).json({ error: 'User not found' })
    res.json({ user: toPublicUser(user) })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Internal server error' })
  }
})

router.patch('/preferences', auth, async (req, res) => {
  const { country, state } = req.body
  if (country != null && (typeof country !== 'string' || country.length > 100))
    return res.status(400).json({ error: 'Invalid country' })
  if (state != null && (typeof state !== 'string' || state.length > 100))
    return res.status(400).json({ error: 'Invalid state' })
  try {
    await prisma.user.update({
      where: { id: req.user.id },
      data: {
        ...(country !== undefined && { preferredCountry: country || null }),
        ...(state !== undefined && { preferredState: state || null }),
      },
    })
    res.json({ ok: true })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Internal server error' })
  }
})

router.patch('/password', auth, async (req, res) => {
  const { currentPassword, newPassword } = req.body
  if (!currentPassword || !newPassword)
    return res.status(400).json({ error: 'currentPassword and newPassword required' })
  if (typeof currentPassword !== 'string' || typeof newPassword !== 'string')
    return res.status(400).json({ error: 'Invalid input' })
  if (newPassword.length < 8)
    return res.status(400).json({ error: 'New password must be at least 8 characters' })
  if (newPassword.length > 72)
    return res.status(400).json({ error: 'New password must be 72 characters or fewer' })
  try {
    const user = await prisma.user.findUnique({ where: { id: req.user.id } })
    if (!user) return res.status(404).json({ error: 'User not found' })
    const valid = await bcrypt.compare(currentPassword, user.password)
    if (!valid) return res.status(401).json({ error: 'Current password is incorrect' })
    const hash = await bcrypt.hash(newPassword, 10)
    await prisma.user.update({ where: { id: req.user.id }, data: { password: hash } })
    res.json({ ok: true })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Internal server error' })
  }
})

router.post('/logout', (_req, res) => {
  res.clearCookie('token', COOKIE_OPTS).json({ ok: true })
})

export default router
