import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import cookieParser from 'cookie-parser'
import { prisma } from './prisma.js'
import { auth, optionalAuth } from './auth.js'
import authRoutes from './routes/auth.js'

const app = express()
app.use(cors({ origin: (origin, cb) => cb(null, origin || true), credentials: true }))
app.use(express.json())
app.use(cookieParser())

app.get('/api/health', (_req, res) => res.json({ ok: true }))
app.use('/api/auth', authRoutes)

// ── Resources & Terrains ──────────────────────────────────────────────────

app.get('/api/terrains', async (_req, res) => {
  try {
    const terrains = await prisma.terrain.findMany({
      orderBy: { name: 'asc' },
      select: { name: true, color: true, icon: true },
    })
    res.json({ terrains })
  } catch (err) { res.status(500).json({ error: err.message }) }
})

app.patch('/api/resource-locations/:id', auth, async (req, res) => {
  const stars = parseInt(req.body.stars)
  if (isNaN(stars) || stars < 0 || stars > 5) return res.status(400).json({ error: 'stars must be 0–5' })
  try {
    await prisma.resourceLocation.update({
      where: { id: parseInt(req.params.id) },
      data: { stars },
    })
    res.json({ ok: true })
  } catch (err) {
    if (err.code === 'P2025') return res.status(404).json({ error: 'Not found' })
    res.status(500).json({ error: err.message })
  }
})

app.get('/api/resources', async (_req, res) => {
  try {
    const resources = await prisma.resource.findMany({
      include: { locations: true, chain: true },
      orderBy: [{ type: 'asc' }, { name: 'asc' }],
    })
    const formatted = resources.map(r => ({
      id: r.id,
      name: r.name,
      type: r.type,
      icon: r.icon,
      info: r.info,
      available: r.available,
      locations: r.locations.map(l => ({
        id: l.id,
        terrain: l.terrain,
        location: l.location,
        stars: l.stars,
      })),
      chain: r.chain ? {
        processed: r.chain.processedName,
        final1: r.chain.final1Name
          ? { name: r.chain.final1Name, category: r.chain.final1Category }
          : null,
        final2: r.chain.final2Name
          ? { name: r.chain.final2Name, category: r.chain.final2Category }
          : null,
      } : null,
    }))
    res.json({ resources: formatted })
  } catch (err) { res.status(500).json({ error: err.message }) }
})

app.get('/api/regions', async (_req, res) => {
  try {
    const rows = await prisma.mapRegion.findMany({
      orderBy: [{ parent: 'asc' }, { name: 'asc' }],
    })
    const countries = {}, states = {}
    for (const r of rows) {
      const obj = {
        latMin: parseFloat(r.latMin),
        latMax: parseFloat(r.latMax),
        lngMin: parseFloat(r.lngMin),
        lngMax: parseFloat(r.lngMax),
        center: r.centerLat ? [parseFloat(r.centerLat), parseFloat(r.centerLng)] : null,
        zoom: r.zoom,
      }
      if (r.parent === '') countries[r.name] = obj
      else states[r.name] = obj
    }
    res.json({ countries, states })
  } catch (err) { res.status(500).json({ error: err.message }) }
})

// ── Terrain ───────────────────────────────────────────────────────────────

app.get('/api/terrain/:region', async (req, res) => {
  try {
    const region = req.params.region
    const rows = await prisma.$queryRaw`
      SELECT DISTINCT ON (cell_key) cell_key, terrain_key
      FROM cell_paints
      WHERE region_key = ${region}
      ORDER BY cell_key, painted_at DESC
    `
    const data = {}
    for (const row of rows) {
      if (row.terrain_key) data[row.cell_key] = row.terrain_key
    }
    res.json({ data })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

app.post('/api/terrain/:region/cell', auth, async (req, res) => {
  const { cellKey, terrainKey } = req.body
  if (!cellKey) return res.status(400).json({ error: 'cellKey required' })
  try {
    await prisma.cellPaint.create({
      data: {
        regionKey: req.params.region,
        cellKey,
        terrainKey: terrainKey || null,
        userId: req.user.id,
      },
    })
    res.json({ ok: true })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

app.post('/api/terrain/:region/import', auth, async (req, res) => {
  const { data } = req.body
  if (!data || typeof data !== 'object') return res.status(400).json({ error: 'data required' })
  const region = req.params.region
  try {
    await prisma.$transaction(async (tx) => {
      await tx.cellPaint.deleteMany({ where: { regionKey: region } })
      for (const [cellKey, terrainKey] of Object.entries(data)) {
        if (!terrainKey) continue
        await tx.cellPaint.create({
          data: { regionKey: region, cellKey, terrainKey, userId: req.user.id },
        })
      }
    })
    res.json({ ok: true })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

app.delete('/api/terrain/:region', auth, async (req, res) => {
  try {
    await prisma.cellPaint.deleteMany({ where: { regionKey: req.params.region } })
    res.json({ ok: true })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ── Tribes & lookup data ──────────────────────────────────────────────────

app.get('/api/tribes', async (_req, res) => {
  try {
    const tribes = await prisma.tribe.findMany({ orderBy: { name: 'asc' } })
    res.json({ tribes })
  } catch (err) { res.status(500).json({ error: err.message }) }
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
  } catch (err) { res.status(500).json({ error: err.message }) }
})

// ── Tribe markers ─────────────────────────────────────────────────────────

app.get('/api/tribe-markers', auth, async (req, res) => {
  const { region } = req.query
  if (!region) return res.status(400).json({ error: 'region required' })
  try {
    const rows = await prisma.tribeMarker.findMany({
      where: { regionKey: region, placedBy: req.user.id },
      include: { user: true, tribe: true },
      orderBy: { createdAt: 'asc' },
    })
    const markers = rows.map(m => ({
      id: m.id,
      lat: m.lat,
      lng: m.lng,
      type: m.type,
      region_key: m.regionKey,
      placed_by: m.placedBy,
      username: m.user.username,
      tribe_id: m.tribeId,
      tribe_name: m.tribe.name,
      tribe_color: m.tribe.color,
      tribe_icon: m.tribe.icon,
    }))
    res.json({ markers })
  } catch (err) { res.status(500).json({ error: err.message }) }
})

app.post('/api/tribe-markers', auth, async (req, res) => {
  const { tribe_id, type, region_key, lat, lng } = req.body
  if (!tribe_id || !type || !region_key || lat == null || lng == null)
    return res.status(400).json({ error: 'tribe_id, type, region_key, lat, lng required' })
  if (!['Camp', 'Selo', 'Burgh'].includes(type))
    return res.status(400).json({ error: 'type must be Camp, Selo, or Burgh' })
  try {
    const marker = await prisma.tribeMarker.create({
      data: {
        placedBy: req.user.id,
        tribeId: parseInt(tribe_id),
        type,
        regionKey: region_key,
        lat,
        lng,
      },
    })
    res.json({ id: marker.id })
  } catch (err) { res.status(500).json({ error: err.message }) }
})

app.patch('/api/tribe-markers/:id', auth, async (req, res) => {
  const { type, tribe_id } = req.body
  if (type && !['Camp', 'Selo', 'Burgh'].includes(type))
    return res.status(400).json({ error: 'type must be Camp, Selo, or Burgh' })
  try {
    const existing = await prisma.tribeMarker.findFirst({
      where: { id: parseInt(req.params.id), placedBy: req.user.id },
    })
    if (!existing) return res.status(404).json({ error: 'Not found or not yours' })
    await prisma.tribeMarker.update({
      where: { id: parseInt(req.params.id) },
      data: {
        ...(type && { type }),
        ...(tribe_id && { tribeId: parseInt(tribe_id) }),
      },
    })
    res.json({ ok: true })
  } catch (err) { res.status(500).json({ error: err.message }) }
})

app.delete('/api/tribe-markers/:id', auth, async (req, res) => {
  try {
    const { count } = await prisma.tribeMarker.deleteMany({
      where: { id: parseInt(req.params.id), placedBy: req.user.id },
    })
    if (!count) return res.status(404).json({ error: 'Not found or not yours' })
    res.json({ ok: true })
  } catch (err) { res.status(500).json({ error: err.message }) }
})

// ── Player settlements ────────────────────────────────────────────────────

app.get('/api/player-settlements', optionalAuth, async (req, res) => {
  const { region } = req.query
  if (!region) return res.status(400).json({ error: 'region required' })
  try {
    const userId = req.user?.id ?? null
    const rows = await prisma.playerSettlement.findMany({
      where: {
        regionKey: region,
        OR: userId
          ? [{ isPublic: true }, { userId }]
          : [{ isPublic: true }],
      },
      include: { user: true, stage: true },
      orderBy: { createdAt: 'asc' },
    })
    const settlements = rows.map(s => ({
      id: s.id,
      lat: s.lat,
      lng: s.lng,
      name: s.name,
      resource_type: s.resourceType,
      region_key: s.regionKey,
      user_id: s.userId,
      is_public: s.isPublic,
      username: s.user.username,
      stage_id: s.stageId,
      stage_name: s.stage.name,
      tier: s.stage.tier,
      stage_icon: s.stage.icon,
    }))
    res.json({ settlements })
  } catch (err) { res.status(500).json({ error: err.message }) }
})

app.post('/api/player-settlements', auth, async (req, res) => {
  const { stage_id, resource_type, region_key, lat, lng, name, is_public } = req.body
  if (!stage_id || !region_key || lat == null || lng == null)
    return res.status(400).json({ error: 'stage_id, region_key, lat, lng required' })
  try {
    const settlement = await prisma.playerSettlement.create({
      data: {
        userId: req.user.id,
        stageId: parseInt(stage_id),
        resourceType: resource_type || null,
        regionKey: region_key,
        lat,
        lng,
        name: name || null,
        isPublic: is_public === true,
      },
    })
    res.json({ id: settlement.id })
  } catch (err) { res.status(500).json({ error: err.message }) }
})

app.patch('/api/player-settlements/:id', auth, async (req, res) => {
  const { stage_id, resource_type, name, is_public } = req.body
  try {
    const existing = await prisma.playerSettlement.findFirst({
      where: { id: parseInt(req.params.id), userId: req.user.id },
    })
    if (!existing) return res.status(404).json({ error: 'Not found or not yours' })
    await prisma.playerSettlement.update({
      where: { id: parseInt(req.params.id) },
      data: {
        ...(stage_id && { stageId: parseInt(stage_id) }),
        resourceType: resource_type || null,
        name: name || null,
        ...(is_public != null && { isPublic: Boolean(is_public) }),
      },
    })
    res.json({ ok: true })
  } catch (err) { res.status(500).json({ error: err.message }) }
})

app.delete('/api/player-settlements/:id', auth, async (req, res) => {
  try {
    const { count } = await prisma.playerSettlement.deleteMany({
      where: { id: parseInt(req.params.id), userId: req.user.id },
    })
    if (!count) return res.status(404).json({ error: 'Not found or not yours' })
    res.json({ ok: true })
  } catch (err) { res.status(500).json({ error: err.message }) }
})

const PORT = process.env.PORT || 3001
app.listen(PORT, () => console.log(`API server → http://localhost:${PORT}`))
