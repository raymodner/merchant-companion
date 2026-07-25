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

// ── Region slug helpers ───────────────────────────────────────────────────

function slugToName(slug) {
  return slug.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

function regionToSlug(region) {
  const s = region.name.toLowerCase().replace(/\s+/g, '-')
  return region.parentId ? 'us-' + s : s
}

const regionCache = new Map()
async function resolveRegion(slug) {
  if (regionCache.has(slug)) return regionCache.get(slug)
  let id = null
  if (slug.startsWith('us-')) {
    const stateName = slugToName(slug.slice(3))
    const us = await prisma.mapRegion.findFirst({
      where: { name: 'United States', parentId: null },
      select: { id: true },
    })
    if (us) {
      const state = await prisma.mapRegion.findFirst({
        where: { name: stateName, parentId: us.id },
        select: { id: true },
      })
      id = state?.id ?? null
    }
  } else {
    const region = await prisma.mapRegion.findFirst({
      where: { name: slugToName(slug), parentId: null },
      select: { id: true },
    })
    id = region?.id ?? null
  }
  if (id) regionCache.set(slug, id)
  return id
}

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
  } catch (err) { res.status(500).json({ error: err.message }) }
})

app.get('/api/regions', async (_req, res) => {
  try {
    const rows = await prisma.mapRegion.findMany({ orderBy: { name: 'asc' } })
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
      if (r.parentId === null) countries[r.name] = obj
      else states[r.name] = obj
    }
    res.json({ countries, states })
  } catch (err) { res.status(500).json({ error: err.message }) }
})

// ── Terrain painting ──────────────────────────────────────────────────────

app.get('/api/terrain/:region', async (req, res) => {
  try {
    const regionId = await resolveRegion(req.params.region)
    if (!regionId) return res.json({ data: {} })
    const rows = await prisma.$queryRaw`
      SELECT DISTINCT ON (cp.cell_key) cp.cell_key, t.name AS terrain_name
      FROM cell_paints cp
      LEFT JOIN terrains t ON t.id = cp.terrain_id
      WHERE cp.region_id = ${regionId}
      ORDER BY cp.cell_key, cp.painted_at DESC
    `
    const data = {}
    for (const row of rows) {
      if (row.terrain_name) data[row.cell_key] = row.terrain_name
    }
    res.json({ data })
  } catch (err) { res.status(500).json({ error: err.message }) }
})

app.post('/api/terrain/:region/cell', auth, async (req, res) => {
  const { cellKey, terrainKey } = req.body
  if (!cellKey) return res.status(400).json({ error: 'cellKey required' })
  try {
    const regionId = await resolveRegion(req.params.region)
    if (!regionId) return res.status(404).json({ error: 'Region not found' })
    const terrainId = await resolveTerrain(terrainKey)
    await prisma.cellPaint.create({
      data: { regionId, cellKey, terrainId, userId: req.user.id },
    })
    res.json({ ok: true })
  } catch (err) { res.status(500).json({ error: err.message }) }
})

app.post('/api/terrain/:region/import', auth, async (req, res) => {
  const { data } = req.body
  if (!data || typeof data !== 'object') return res.status(400).json({ error: 'data required' })
  try {
    const regionId = await resolveRegion(req.params.region)
    if (!regionId) return res.status(404).json({ error: 'Region not found' })
    const terrains = await prisma.terrain.findMany({ select: { id: true, name: true } })
    const terrainMap = Object.fromEntries(terrains.map(t => [t.name, t.id]))
    await prisma.$transaction(async (tx) => {
      await tx.cellPaint.deleteMany({ where: { regionId } })
      for (const [cellKey, terrainKey] of Object.entries(data)) {
        if (!terrainKey) continue
        await tx.cellPaint.create({
          data: { regionId, cellKey, terrainId: terrainMap[terrainKey] ?? null, userId: req.user.id },
        })
      }
    })
    res.json({ ok: true })
  } catch (err) { res.status(500).json({ error: err.message }) }
})

app.delete('/api/terrain/:region', auth, async (req, res) => {
  try {
    const regionId = await resolveRegion(req.params.region)
    if (!regionId) return res.status(404).json({ error: 'Region not found' })
    await prisma.cellPaint.deleteMany({ where: { regionId } })
    res.json({ ok: true })
  } catch (err) { res.status(500).json({ error: err.message }) }
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
    const regionId = await resolveRegion(region)
    if (!regionId) return res.json({ markers: [] })
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
      region_key: region,
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
    const regionId = await resolveRegion(region_key)
    if (!regionId) return res.status(404).json({ error: 'Region not found' })
    const tribeTypeId = await resolveTribeType(type)
    const marker = await prisma.tribeMarker.create({
      data: {
        placedBy: req.user.id,
        tribeId: parseInt(tribe_id),
        tribeTypeId,
        regionId,
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
    const tribeTypeId = type ? await resolveTribeType(type) : undefined
    await prisma.tribeMarker.update({
      where: { id: parseInt(req.params.id) },
      data: {
        ...(tribeTypeId !== undefined && { tribeTypeId }),
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
    const regionId = await resolveRegion(region)
    if (!regionId) return res.json({ settlements: [] })
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
      region_key: region,
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
    const regionId = await resolveRegion(region_key)
    if (!regionId) return res.status(404).json({ error: 'Region not found' })
    const resourceTypeId = await resolveResourceType(resource_type)
    const settlement = await prisma.playerSettlement.create({
      data: {
        userId: req.user.id,
        stageId: parseInt(stage_id),
        resourceTypeId,
        regionId,
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
    const resourceTypeId = resource_type !== undefined
      ? await resolveResourceType(resource_type)
      : undefined
    await prisma.playerSettlement.update({
      where: { id: parseInt(req.params.id) },
      data: {
        ...(stage_id && { stageId: parseInt(stage_id) }),
        ...(resourceTypeId !== undefined && { resourceTypeId }),
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
