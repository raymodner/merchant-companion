import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../prisma.js'
import { auth, optionalAuth } from '../auth.js'
import { body, uuidParam } from '../lib/validate.js'
import { resolveTerrain } from '../lib/resolvers.js'
import { config } from '../lib/config.js'

const router = Router()

// Cell keys look like "52.5,13.5" — one decimal place each
const CELL_KEY_RE = /^-?\d{1,3}\.\d,-?\d{1,4}\.\d$/
const isBounded = (key) => {
  const [lat, lng] = key.split(',').map(Number)
  return lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180
}

// GET uses raw SQL with DISTINCT ON to get the latest paint per cell.
// Prisma cannot express DISTINCT ON without loading all rows and filtering in JS,
// so we keep the raw query here for correctness and performance.
router.get('/:regionId', optionalAuth, uuidParam('regionId'), async (req, res) => {
  const { regionId } = req.params
  try {
    // Explicit existence check so we return 404 instead of an empty result for bad IDs
    const region = await prisma.mapRegion.findUnique({ where: { id: regionId }, select: { id: true } })
    if (!region) return res.status(404).json({ error: 'Region not found' })

    // Private mode has no shared canvas to fall back to — anonymous visitors see nothing
    if (!config.sharedPaint && !req.user) return res.json({ data: {} })

    const rows = config.sharedPaint
      ? await prisma.$queryRaw`
          SELECT DISTINCT ON (cp.cell_key) cp.cell_key, t.name AS terrain_name
          FROM cell_paints cp
          LEFT JOIN terrains t ON t.id = cp.terrain_id
          WHERE cp.region_id = ${regionId}::uuid
          ORDER BY cp.cell_key, cp.painted_at DESC
        `
      : await prisma.$queryRaw`
          SELECT DISTINCT ON (cp.cell_key) cp.cell_key, t.name AS terrain_name
          FROM cell_paints cp
          LEFT JOIN terrains t ON t.id = cp.terrain_id
          WHERE cp.region_id = ${regionId}::uuid AND cp.user_id = ${req.user.id}::uuid
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

const cellSchema = z.object({
  cellKey: z.string().regex(CELL_KEY_RE, { message: 'Invalid cellKey' })
    .refine(isBounded, { message: 'Cell coordinates out of bounds' }),
  terrainKey: z.string().max(50).nullish(),
})

router.post('/:regionId/cell',
  auth,
  uuidParam('regionId'),
  body(cellSchema),
  async (req, res) => {
    const { regionId } = req.params
    const { cellKey, terrainKey } = req.body
    try {
      const region = await prisma.mapRegion.findUnique({ where: { id: regionId }, select: { id: true } })
      if (!region) return res.status(400).json({ error: 'Region not found' })
      const terrainId = await resolveTerrain(terrainKey)
      if (terrainKey != null && terrainId == null) return res.status(400).json({ error: 'Invalid terrainKey' })
      await prisma.cellPaint.create({
        data: { regionId, cellKey, terrainId, userId: req.user.id },
      })
      res.json({ ok: true })
    } catch (err) {
      if (err.code === 'P2003') return res.status(400).json({ error: 'Invalid reference' })
      console.error(err)
      res.status(500).json({ error: 'Internal server error' })
    }
  }
)

export default router
