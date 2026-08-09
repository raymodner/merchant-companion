import { Router } from 'express'
import { z } from 'zod'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken' // used for jwt.decode in logout
import rateLimit from 'express-rate-limit'
import { prisma } from '../prisma.js'
import { auth, signToken } from '../auth.js'
import { body } from '../lib/validate.js'
import { config } from '../lib/config.js'

const router = Router()

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  message: { error: 'Too many attempts, please try again later' },
  standardHeaders: 'draft-7',
  legacyHeaders: false,
})

const DUMMY_HASH = '$2b$12$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA'
const COOKIE_OPTS = {
  httpOnly: true,
  sameSite: 'lax',
  secure: process.env.NODE_ENV === 'production' || process.env.COOKIE_SECURE === 'true',
  maxAge: 24 * 60 * 60 * 1000,
}

function toPublicUser(userRecord) {
  return {
    id: userRecord.id,
    username: userRecord.username,
    email: userRecord.email,
    preferred_country: userRecord.preferredCountry ?? null,
    preferred_state: userRecord.preferredState ?? null,
  }
}

const registerSchema = z.object({
  username: z.string({ required_error: 'All fields required' })
    .trim()
    .min(3, { message: 'Username must be 3–50 characters' })
    .max(50, { message: 'Username must be 3–50 characters' })
    .regex(/^[\w\-]+$/, { message: 'Username may only contain letters, numbers, _ and -' }),
  email: z.string({ required_error: 'All fields required' })
    .trim()
    .email({ message: 'Invalid email address' })
    .max(254, { message: 'Email must be 254 characters or fewer' }),
  password: z.string({ required_error: 'All fields required' })
    .min(8, { message: 'Password must be at least 8 characters' })
    .max(72, { message: 'Password must be 72 characters or fewer' }),
})

router.post('/register', authLimiter, body(registerSchema), async (req, res) => {
  const { username, email, password } = req.body

  if (config.registrationAllowlist) {
    if (!config.registrationAllowlist.has(email.toLowerCase()))
      return res.status(403).json({ error: 'Your email address is not on the registration allowlist' })
  } else if (!config.registrationOpen) {
    return res.status(403).json({ error: 'Registration is currently closed' })
  }

  try {
    const hash = await bcrypt.hash(password, 12)
    const user = await prisma.user.create({ data: { username, email, password: hash } })
    res.cookie('token', signToken(user), COOKIE_OPTS).json({ user: toPublicUser(user) })
  } catch (err) {
    if (err.code === 'P2002') return res.status(409).json({ error: 'Username or email already taken' })
    console.error(err)
    res.status(500).json({ error: 'Internal server error' })
  }
})

const loginSchema = z.object({
  email: z.string({ required_error: 'Email and password required' })
    .trim()
    .email({ message: 'Invalid email address' }),
  password: z.string({ required_error: 'Email and password required' }).max(72),
})

router.post('/login', authLimiter, body(loginSchema), async (req, res) => {
  const { email, password } = req.body
  try {
    const user = await prisma.user.findUnique({ where: { email } })
    const valid = await bcrypt.compare(password, user?.password ?? DUMMY_HASH)
    if (!user || !valid) return res.status(401).json({ error: 'Invalid credentials' })
    res.cookie('token', signToken(user), COOKIE_OPTS).json({ user: toPublicUser(user) })
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

const preferencesSchema = z.object({
  country: z.string().max(100, { message: 'Invalid country' }).nullish(),
  state:   z.string().max(100, { message: 'Invalid state' }).nullish(),
})

router.patch('/preferences', auth, body(preferencesSchema), async (req, res) => {
  const { country, state } = req.body
  try {
    await prisma.user.update({
      where: { id: req.user.id },
      data: {
        ...(country !== undefined && { preferredCountry: country || null }),
        ...(state   !== undefined && { preferredState:   state   || null }),
      },
    })
    res.json({ ok: true })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Internal server error' })
  }
})

const changePasswordSchema = z.object({
  currentPassword: z.string({ required_error: 'currentPassword and newPassword required' }).max(72),
  newPassword: z.string({ required_error: 'currentPassword and newPassword required' })
    .min(8, { message: 'New password must be at least 8 characters' })
    .max(72, { message: 'New password must be 72 characters or fewer' }),
})

router.patch('/password', authLimiter, auth, body(changePasswordSchema), async (req, res) => {
  const { currentPassword, newPassword } = req.body
  try {
    const user = await prisma.user.findUnique({ where: { id: req.user.id } })
    if (!user) return res.status(404).json({ error: 'User not found' })
    const valid = await bcrypt.compare(currentPassword, user.password)
    if (!valid) return res.status(401).json({ error: 'Current password is incorrect' })
    const hash = await bcrypt.hash(newPassword, 12)
    const updated = await prisma.user.update({
      where: { id: req.user.id },
      data: { password: hash, tokenVersion: { increment: 1 } },
    })
    res.cookie('token', signToken(updated), COOKIE_OPTS).json({ ok: true })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Internal server error' })
  }
})

router.post('/logout', authLimiter, async (req, res) => {
  const token = req.cookies?.token
  if (token) {
    try {
      const { id } = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ['HS256'], ignoreExpiration: true })
      if (id) await prisma.user.update({ where: { id }, data: { tokenVersion: { increment: 1 } } })
    } catch (err) {
      if (err.name !== 'JsonWebTokenError' && err.name !== 'TokenExpiredError' && err.name !== 'NotBeforeError')
        console.error('logout tokenVersion update failed', err)
    }
  }
  res.clearCookie('token', COOKIE_OPTS).json({ ok: true })
})

export default router
