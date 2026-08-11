import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import cookieParser from 'cookie-parser'
import rateLimit from 'express-rate-limit'

import configRoutes      from './routes/config.js'
import authRoutes        from './routes/auth.js'
import lookupRoutes      from './routes/lookup.js'
import regionsRoutes     from './routes/regions.js'
import resourcesRoutes   from './routes/resources.js'
import terrainRoutes     from './routes/terrain.js'
import tribesRoutes      from './routes/tribes.js'
import settlementsRoutes from './routes/settlements.js'

const ALLOWED_ORIGINS = new Set(
  (process.env.ALLOWED_ORIGINS || 'http://localhost:5174').split(',').map(s => s.trim())
)

const app = express()

if (process.env.NODE_ENV === 'production') app.set('trust proxy', 1)
app.use(helmet())
app.use(cors({
  origin: (origin, cb) =>
    (!origin || ALLOWED_ORIGINS.has(origin)) ? cb(null, true) : cb(new Error('CORS not allowed')),
  credentials: true,
}))
app.use(express.json({ limit: '100kb' }))
app.use(cookieParser())

const readLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 120,
  message: { error: 'Too many requests, please slow down' },
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  skip: (req) => req.method !== 'GET' && req.method !== 'HEAD',
})

const writeLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 60,
  message: { error: 'Too many requests, please slow down' },
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  skip: (req) => req.method === 'GET' || req.method === 'HEAD',
})

app.use('/api', readLimiter)
app.use('/api', writeLimiter)

app.get('/api/health', (_req, res) => res.json({ ok: true }))
app.use('/api',              configRoutes)
app.use('/api/auth',         authRoutes)
app.use('/api',              lookupRoutes)
app.use('/api',              regionsRoutes)
app.use('/api',              resourcesRoutes)
app.use('/api/terrain',      terrainRoutes)
app.use('/api',              tribesRoutes)
app.use('/api',              settlementsRoutes)

app.use((_req, res) => res.status(404).json({ error: 'Not found' }))
app.use((err, _req, res, _next) => {
  if (err.status === 413 || err.type === 'entity.too.large')
    return res.status(413).json({ error: 'Request body too large' })
  if (err.type === 'entity.parse.failed')
    return res.status(400).json({ error: 'Invalid JSON in request body' })
  if (err.message === 'CORS not allowed')
    return res.status(403).json({ error: 'CORS not allowed' })
  console.error(err)
  res.status(err.status || 500).json({ error: 'Internal server error' })
})

const PORT = process.env.PORT || 3001
app.listen(PORT, () => {
  console.log(`API server → http://localhost:${PORT}`)
})
