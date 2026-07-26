import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import cookieParser from 'cookie-parser'
import { prisma } from './prisma.js'
import { auth, optionalAuth } from './auth.js'
import authRoutes from './routes/auth.js'
import { isUuid, isLat, isLng } from './validate.js'

const ALLOWED_ORIGINS = new Set(
  (process.env.ALLOWED_ORIGINS || 'http://localhost:5174').split(',').map(s => s.trim())
)

const app = express()
app.use(helmet())
app.use(cors({
  origin: (origin, cb) =>
    (!origin || ALLOWED_ORIGINS.has(origin)) ? cb(null, true) : cb(new Error('CORS not allowed')),
  credentials: true,
}))
app.use(express.json({ limit: '100kb' }))
app.use(cookieParser())

app.get('/api/health', (_req, res) => res.json({ ok: true }))
app.use('/api/auth', authRoutes)

const terrainCache = new Map()
async function resolveTerrain(name) {
  if (!name) return null
  if (terrainCache.has(name)) return terrainCache.get(name)
  const t = await prisma.terrain.findUnique({ where: { name }, select: { id: true } })
  if (t) terrainCache.set(name, t.id)
  return t?.id ?? null
}

const tribeTypeCache = new Map()
async function resolveTribeType(name) {
  if (tribeTypeCache.has(name)) return tribeTypeCache.get(name)
  const tt = await prisma.tribeType.findUnique({ where: { name }, select: { id: true } })
  if (tt) tribeTypeCache.set(name, tt.id)
  return tt?.id ?? null
}

const resourceTypeCache = new Map()
async function resolveResourceType(name) {
  if (!name) return null
  if (resourceTypeCache.has(name)) return resourceTypeCache.get(name)
  const rt = await prisma.resourceType.findUnique({ where: { name }, select: { id: true } })
  if (rt) resourceTypeCache.set(name, rt.id)
  return rt?.id ?? null
}

// ── Resources & Terrains ──────────────────────────────────────────────────

app.get('/api/terrains', async (_req, res) => {
  try {
    const terrains = await prisma.terrain.findMany({
      orderBy: { name: 'asc' },
      select: { name: true, color: true, icon: true },
    })
    res.json({ terrains })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Internal server error' })
  }
})

app.patch('/api/resource-locations/:id', auth, async (req, res) => {
  if (!isUuid(req.params.id)) return res.status(400).json({ error: 'Invalid id' })
  const stars = req.body.stars
  if (!Number.isInteger(stars) || stars < 0 || stars > 5)
    return res.status(400).json({ error: 'stars must be an integer 0–5' })
  try {
    await prisma.resourceLocation.update({
      where: { id: req.params.id },
      data: { stars },
    })
    res.json({ ok: true })
  } catch (err) {
    if (err.code === 'P2025') return res.status(404).json({ error: 'Not found' })
    console.error(err)
    res.status(500).json({ error: 'Internal server error' })
  }
})

app.get('/api/resources', async (_req, res) => {
  try {
    const resources = await prisma.resource.findMany({
      include: {
        resourceType: true,
        locations: { include: { locationRef: { include: { terrain: true } } } },
        chain: {
          include: {
            processedCategoryRef: true,
            final1CategoryRef: true,
            final2CategoryRef: true,
          },
        },
      },
      orderBy: [{ resourceType: { name: 'asc' } }, { name: 'asc' }],
    })
    const formatted = resources.map(r => ({
      id: r.id,
      name: r.name,
      type: r.resourceType.name,
      icon: r.icon,
      info: r.info,
      available: r.available,
      locations: r.locations.map(l => ({
        id: l.id,
        terrain: l.locationRef.terrain.name,
        location: l.locationRef.name,
        stars: l.stars,
      })),
      chain: r.chain ? {
        processed: r.chain.processedName,
        processedCategory: r.chain.processedCategoryRef.name,
        final1: r.chain.final1Name
          ? { name: r.chain.final1Name, category: r.chain.final1CategoryRef?.name ?? null }
          : null,
        final2: r.chain.final2Name
          ? { name: r.chain.final2Name, category: r.chain.final2CategoryRef?.name ?? null }
          : null,
      } : null,
    }))
    res.json({ resources: formatted })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Internal server error' })
  }
})

app.get('/api/regions', async (_req, res) => {
  try {
    const rows = await prisma.mapRegion.findMany({ orderBy: { name: 'asc' } })
    const countries = {}, states = {}
    for (const r of rows) {
      const obj = {
        id: r.id,
        latMin: parseFloat(r.latMin),
        latMax: parseFloat(r.latMax),
        lngMin: parseFloat(r.lngMin),
        lngMax: parseFloat(r.lngMax),
        center: r.centerLat ? [parseFloat(r.centerLat), parseFloat(r.centerLng)] : null,
        zoom: r.zoom,
      }
      if (r.parentId === null) countries[r.name] = obj
      else states[r.name] = obj
    }
    res.json({ countries, states })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// ── Terrain painting ──────────────────────────────────────────────────────

app.get('/api/terrain/:regionId', async (req, res) => {
  const regionId = req.params.regionId
  if (!isUuid(regionId)) return res.status(400).json({ error: 'Invalid region ID' })
  try {
    const rows = await prisma.$queryRaw`
      SELECT DISTINCT ON (cp.cell_key) cp.cell_key, t.name AS terrain_name
      FROM cell_paints cp
      LEFT JOIN terrains t ON t.id = cp.terrain_id
      WHERE cp.region_id = ${regionId}::uuid
      ORDER BY cp.cell_key, cp.painted_at DESC
    `
    const data = {}
    for (const row of rows) {
      if (row.terrain_name) data[row.cell_key] = row.terrain_name
    }
    res.json({ data })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Internal server error' })
  }
})

const CELL_KEY_RE = /^-?\d{1,3}\.\d,-?\d{1,4}\.\d$/

app.post('/api/terrain/:regionId/cell', auth, async (req, res) => {
  const { cellKey, terrainKey } = req.body
  const regionId = req.params.regionId
  if (!isUuid(regionId)) return res.status(400).json({ error: 'Invalid region ID' })
  if (!cellKey || !CELL_KEY_RE.test(cellKey))
    return res.status(400).json({ error: 'Invalid cellKey' })
  try {
    const terrainId = await resolveTerrain(terrainKey)
    await prisma.cellPaint.create({
      data: { regionId, cellKey, terrainId, userId: req.user.id },
    })
    res.json({ ok: true })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Internal server error' })
  }
})

app.post('/api/terrain/:regionId/import', auth, async (req, res) => {
  const { data } = req.body
  const regionId = req.params.regionId
  if (!isUuid(regionId)) return res.status(400).json({ error: 'Invalid region ID' })
  if (!data || typeof data !== 'object' || Array.isArray(data))
    return res.status(400).json({ error: 'data must be an object' })
  if (Object.keys(data).length > 50_000)
    return res.status(400).json({ error: 'Too many cells in import (max 50 000)' })
  try {
    const terrains = await prisma.terrain.findMany({ select: { id: true, name: true } })
    const terrainMap = Object.fromEntries(terrains.map(t => [t.name, t.id]))
    const records = []
    for (const [cellKey, terrainKey] of Object.entries(data)) {
      if (!terrainKey || !CELL_KEY_RE.test(cellKey)) continue
      records.push({ regionId, cellKey, terrainId: terrainMap[terrainKey] ?? null, userId: req.user.id })
    }
    await prisma.$transaction(async (tx) => {
      await tx.cellPaint.deleteMany({ where: { regionId } })
      if (records.length) await tx.cellPaint.createMany({ data: records })
    })
    res.json({ ok: true })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Internal server error' })
  }
})

app.delete('/api/terrain/:regionId', auth, async (req, res) => {
  const regionId = req.params.regionId
  if (!isUuid(regionId)) return res.status(400).json({ error: 'Invalid region ID' })
  try {
    await prisma.cellPaint.deleteMany({ where: { regionId } })
    res.json({ ok: true })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// ── Tribes & lookup data ──────────────────────────────────────────────────

app.get('/api/tribes', async (_req, res) => {
  try {
    const tribes = await prisma.tribe.findMany({ orderBy: { name: 'asc' } })
    res.json({ tribes })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Internal server error' })
  }
})

app.get('/api/settlement-stages', async (_req, res) => {
  try {
    const stages = await prisma.settlementStage.findMany({ orderBy: { sortOrder: 'asc' } })
    res.json({
      stages: stages.map(s => ({
        id: s.id,
        name: s.name,
        sort_order: s.sortOrder,
        tier: s.tier,
        icon: s.icon,
      })),
    })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// ── Tribe markers ─────────────────────────────────────────────────────────

app.get('/api/tribe-markers/:regionId', auth, async (req, res) => {
  const regionId = req.params.regionId
  if (!isUuid(regionId)) return res.status(400).json({ error: 'Invalid region ID' })
  try {
    const rows = await prisma.tribeMarker.findMany({
      where: { regionId, placedBy: req.user.id },
      include: { user: true, tribe: true, tribeType: true },
      orderBy: { createdAt: 'asc' },
    })
    const markers = rows.map(m => ({
      id: m.id,
      lat: m.lat,
      lng: m.lng,
      type: m.tribeType.name,
      region_id: regionId,
      is_own: true,
      username: m.user.username,
      tribe_id: m.tribeId,
      tribe_name: m.tribe.name,
      tribe_color: m.tribe.color,
      tribe_icon: m.tribe.icon,
    }))
    res.json({ markers })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Internal server error' })
  }
})

app.post('/api/tribe-markers', auth, async (req, res) => {
  const { tribe_id, type, region_id, lat, lng } = req.body
  if (!tribe_id || !type || !region_id || lat == null || lng == null)
    return res.status(400).json({ error: 'tribe_id, type, region_id, lat, lng required' })
  if (!isUuid(tribe_id))   return res.status(400).json({ error: 'Invalid tribe_id' })
  if (!isUuid(region_id))  return res.status(400).json({ error: 'Invalid region_id' })
  if (!['Camp', 'Selo', 'Burgh'].includes(type))
    return res.status(400).json({ error: 'type must be Camp, Selo, or Burgh' })
  if (!isLat(lat)) return res.status(400).json({ error: 'lat must be a number between -90 and 90' })
  if (!isLng(lng)) return res.status(400).json({ error: 'lng must be a number between -180 and 180' })
  try {
    const tribeTypeId = await resolveTribeType(type)
    const marker = await prisma.tribeMarker.create({
      data: {
        placedBy: req.user.id,
        tribeId: tribe_id,
        tribeTypeId,
        regionId: region_id,
        lat,
        lng,
      },
      include: { user: true, tribe: true, tribeType: true },
    })
    res.json({
      id: marker.id,
      lat: marker.lat,
      lng: marker.lng,
      type: marker.tribeType.name,
      region_id,
      is_own: true,
      username: marker.user.username,
      tribe_id: marker.tribeId,
      tribe_name: marker.tribe.name,
      tribe_color: marker.tribe.color,
      tribe_icon: marker.tribe.icon,
    })
  } catch (err) {
    if (err.code === 'P2003') return res.status(400).json({ error: 'Invalid reference' })
    console.error(err)
    res.status(500).json({ error: 'Internal server error' })
  }
})

app.patch('/api/tribe-markers/:id', auth, async (req, res) => {
  if (!isUuid(req.params.id)) return res.status(400).json({ error: 'Invalid id' })
  const { type, tribe_id } = req.body
  if (type && !['Camp', 'Selo', 'Burgh'].includes(type))
    return res.status(400).json({ error: 'type must be Camp, Selo, or Burgh' })
  if (tribe_id && !isUuid(tribe_id)) return res.status(400).json({ error: 'Invalid tribe_id' })
  try {
    const tribeTypeId = type ? await resolveTribeType(type) : undefined
    const { count } = await prisma.tribeMarker.updateMany({
      where: { id: req.params.id, placedBy: req.user.id },
      data: {
        ...(tribeTypeId !== undefined && { tribeTypeId }),
        ...(tribe_id && { tribeId: tribe_id }),
      },
    })
    if (!count) return res.status(404).json({ error: 'Not found or not yours' })
    res.json({ ok: true })
  } catch (err) {
    if (err.code === 'P2003') return res.status(400).json({ error: 'Invalid reference' })
    console.error(err)
    res.status(500).json({ error: 'Internal server error' })
  }
})

app.delete('/api/tribe-markers/:id', auth, async (req, res) => {
  if (!isUuid(req.params.id)) return res.status(400).json({ error: 'Invalid id' })
  try {
    const { count } = await prisma.tribeMarker.deleteMany({
      where: { id: req.params.id, placedBy: req.user.id },
    })
    if (!count) return res.status(404).json({ error: 'Not found or not yours' })
    res.json({ ok: true })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// ── Player settlements ────────────────────────────────────────────────────

app.get('/api/player-settlements/:regionId', optionalAuth, async (req, res) => {
  const regionId = req.params.regionId
  if (!isUuid(regionId)) return res.status(400).json({ error: 'Invalid region ID' })
  try {
    const userId = req.user?.id ?? null
    const rows = await prisma.playerSettlement.findMany({
      where: {
        regionId,
        OR: userId
          ? [{ isPublic: true }, { userId }]
          : [{ isPublic: true }],
      },
      include: { user: true, stage: true, resourceTypeRef: true },
      orderBy: { createdAt: 'asc' },
    })
    const settlements = rows.map(s => ({
      id: s.id,
      lat: s.lat,
      lng: s.lng,
      name: s.name,
      resource_type: s.resourceTypeRef?.name ?? null,
      region_id: regionId,
      is_own: userId != null && s.userId === userId,
      is_public: s.isPublic,
      username: s.user.username,
      stage_id: s.stageId,
      stage_name: s.stage.name,
      tier: s.stage.tier,
      stage_icon: s.stage.icon,
    }))
    res.json({ settlements })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Internal server error' })
  }
})

app.post('/api/player-settlements', auth, async (req, res) => {
  const { stage_id, resource_type, region_id, lat, lng, name, is_public } = req.body
  if (!stage_id || !region_id || lat == null || lng == null)
    return res.status(400).json({ error: 'stage_id, region_id, lat, lng required' })
  if (!isUuid(stage_id))  return res.status(400).json({ error: 'Invalid stage_id' })
  if (!isUuid(region_id)) return res.status(400).json({ error: 'Invalid region_id' })
  if (!isLat(lat)) return res.status(400).json({ error: 'lat must be a number between -90 and 90' })
  if (!isLng(lng)) return res.status(400).json({ error: 'lng must be a number between -180 and 180' })
  if (name != null && String(name).length > 200)
    return res.status(400).json({ error: 'Name must be 200 characters or fewer' })
  if (resource_type != null && String(resource_type).length > 30)
    return res.status(400).json({ error: 'Invalid resource_type' })
  try {
    const resourceTypeId = await resolveResourceType(resource_type)
    const settlement = await prisma.playerSettlement.create({
      data: {
        userId: req.user.id,
        stageId: stage_id,
        resourceTypeId,
        regionId: region_id,
        lat,
        lng,
        name: name || null,
        isPublic: is_public === true,
      },
      include: { user: true, stage: true, resourceTypeRef: true },
    })
    res.json({
      id: settlement.id,
      lat: settlement.lat,
      lng: settlement.lng,
      name: settlement.name,
      resource_type: settlement.resourceTypeRef?.name ?? null,
      region_id,
      is_own: true,
      is_public: settlement.isPublic,
      username: settlement.user.username,
      stage_id: settlement.stageId,
      stage_name: settlement.stage.name,
      tier: settlement.stage.tier,
      stage_icon: settlement.stage.icon,
    })
  } catch (err) {
    if (err.code === 'P2003') return res.status(400).json({ error: 'Invalid reference' })
    console.error(err)
    res.status(500).json({ error: 'Internal server error' })
  }
})

app.patch('/api/player-settlements/:id', auth, async (req, res) => {
  if (!isUuid(req.params.id)) return res.status(400).json({ error: 'Invalid id' })
  const { stage_id, resource_type, name, is_public } = req.body
  if (stage_id != null && !isUuid(stage_id)) return res.status(400).json({ error: 'Invalid stage_id' })
  if (name != null && String(name).length > 200)
    return res.status(400).json({ error: 'Name must be 200 characters or fewer' })
  if (resource_type != null && String(resource_type).length > 30)
    return res.status(400).json({ error: 'Invalid resource_type' })
  try {
    const resourceTypeId = resource_type !== undefined
      ? await resolveResourceType(resource_type)
      : undefined
    const { count } = await prisma.playerSettlement.updateMany({
      where: { id: req.params.id, userId: req.user.id },
      data: {
        ...(stage_id && { stageId: stage_id }),
        ...(resourceTypeId !== undefined && { resourceTypeId }),
        ...(name !== undefined && { name: name || null }),
        ...(is_public != null && { isPublic: is_public === true }),
      },
    })
    if (!count) return res.status(404).json({ error: 'Not found or not yours' })
    res.json({ ok: true })
  } catch (err) {
    if (err.code === 'P2003') return res.status(400).json({ error: 'Invalid reference' })
    console.error(err)
    res.status(500).json({ error: 'Internal server error' })
  }
})

app.delete('/api/player-settlements/:id', auth, async (req, res) => {
  if (!isUuid(req.params.id)) return res.status(400).json({ error: 'Invalid id' })
  try {
    const { count } = await prisma.playerSettlement.deleteMany({
      where: { id: req.params.id, userId: req.user.id },
    })
    if (!count) return res.status(404).json({ error: 'Not found or not yours' })
    res.json({ ok: true })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Internal server error' })
  }
})

app.use((_req, res) => res.status(404).json({ error: 'Not found' }))

// eslint-disable-next-line no-unused-vars
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
app.listen(PORT, () => console.log(`API server → http://localhost:${PORT}`))
