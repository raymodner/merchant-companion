import jwt from 'jsonwebtoken'
import { prisma } from './prisma.js'

if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32)
  throw new Error('JWT_SECRET must be at least 32 characters')
const secret = process.env.JWT_SECRET

export async function auth(req, res, next) {
  const token = req.cookies?.token
  if (!token) return res.status(401).json({ error: 'Unauthorized' })
  let decoded
  try {
    decoded = jwt.verify(token, secret, { algorithms: ['HS256'] })
  } catch {
    return res.status(401).json({ error: 'Invalid token' })
  }
  try {
    const user = await prisma.user.findUnique({
      where: { id: decoded.id },
      select: { id: true, username: true, tokenVersion: true },
    })
    if (!user || user.tokenVersion !== decoded.tv)
      return res.status(401).json({ error: 'Session expired' })
    req.user = { id: user.id, username: user.username }
    next()
  } catch (err) {
    console.error('auth DB lookup failed', err)
    res.status(503).json({ error: 'Service temporarily unavailable' })
  }
}

export async function optionalAuth(req, res, next) {
  const token = req.cookies?.token
  if (token) {
    let decoded
    try {
      decoded = jwt.verify(token, secret, { algorithms: ['HS256'] })
    } catch {
      return next()
    }
    try {
      const user = await prisma.user.findUnique({
        where: { id: decoded.id },
        select: { id: true, username: true, tokenVersion: true },
      })
      if (user && user.tokenVersion === decoded.tv)
        req.user = { id: user.id, username: user.username }
    } catch (err) {
      console.error('optionalAuth DB lookup failed', err)
    }
  }
  next()
}

export function signToken(user) {
  return jwt.sign(
    { id: user.id, username: user.username, tv: user.tokenVersion },
    secret,
    { expiresIn: '24h', algorithm: 'HS256' },
  )
}
