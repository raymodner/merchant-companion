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
router.use(authLimiter)
const secret = () => process.env.JWT_SECRET
const COOKIE_OPTS = {
  httpOnly: true,
  sameSite: 'lax',
  secure: process.env.NODE_ENV === 'production',
  maxAge: 7 * 24 * 60 * 60 * 1000,
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

router.post('/register', async (req, res) => {
  const { username, email, password } = req.body
  if (!username || !email || !password)
    return res.status(400).json({ error: 'All fields required' })
  const u = username.trim()
  if (u.length < 3 || u.length > 50)
    return res.status(400).json({ error: 'Username must be 3–50 characters' })
  if (!/^[\w\-]+$/.test(u))
    return res.status(400).json({ error: 'Username may only contain letters, numbers, _ and -' })
  if (!isEmail(email.trim()))
    return res.status(400).json({ error: 'Invalid email address' })
  if (password.length < 8)
    return res.status(400).json({ error: 'Password must be at least 8 characters' })
  try {
    const hash = await bcrypt.hash(password, 10)
    const user = await prisma.user.create({
      data: { username, email, password: hash },
    })
    const token = jwt.sign({ id: user.id, username: user.username }, secret(), { expiresIn: '7d' })
    res.cookie('token', token, COOKIE_OPTS).json({ user: toPublicUser(user) })
  } catch (err) {
    if (err.code === 'P2002') return res.status(409).json({ error: 'Username or email already taken' })
    res.status(500).json({ error: err.message })
  }
})

router.post('/login', async (req, res) => {
  const { email, password } = req.body
  if (!email || !password) return res.status(400).json({ error: 'Email and password required' })
  if (!isEmail(email.trim())) return res.status(400).json({ error: 'Invalid email address' })
  try {
    const user = await prisma.user.findUnique({ where: { email } })
    if (!user || !(await bcrypt.compare(password, user.password)))
      return res.status(401).json({ error: 'Invalid credentials' })
    const token = jwt.sign({ id: user.id, username: user.username }, secret(), { expiresIn: '7d' })
    res.cookie('token', token, COOKIE_OPTS).json({ user: toPublicUser(user) })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.get('/me', auth, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.user.id } })
    if (!user) return res.status(404).json({ error: 'User not found' })
    res.json({ user: toPublicUser(user) })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.patch('/preferences', auth, async (req, res) => {
  const { country, state } = req.body
  try {
    await prisma.user.update({
      where: { id: req.user.id },
      data: {
        preferredCountry: country || null,
        preferredState: state || null,
      },
    })
    res.json({ ok: true })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.post('/logout', (_req, res) => {
  res.clearCookie('token', COOKIE_OPTS).json({ ok: true })
})

export default router
