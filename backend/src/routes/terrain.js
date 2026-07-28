import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../prisma.js'
import { auth } from '../auth.js'
import { body, uuidParam } from '../lib/validate.js'
import { resolveTerrain } from '../lib/resolvers.js'

const router = Router()

// Cell keys look like "52.5,13.5" — one decimal place each
const CELL_KEY_RE = /^-?\d{1,3}\.\d,-?\d{1,4}\.\d$/

// GET uses raw SQL with DISTINCT ON to get the latest paint per cell.
// Prisma cannot express DISTINCT ON without loading all rows and filtering in JS,
// so we keep the raw query here for correctness and performance.
router.get('/:regionId', uuidParam('regionId'), async (req, res) => {
  const { regionId } = req.params
  try {
    // Explicit existence check so we return 404 instead of an empty result for bad IDs
    const region = await prisma.mapRegion.findUnique({ where: { id: regionId }, select: { id: true } })
    if (!region) return res.status(404).json({ error: 'Region not found' })

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

const cellSchema = z.object({
  cellKey: z.string().regex(CELL_KEY_RE, { message: 'Invalid cellKey' }),
  terrainKey: z.string().optional(),
})

router.post('/:regionId/cell',
  auth,
  uuidParam('regionId'),
  body(cellSchema),
  async (req, res) => {
    const { regionId } = req.params
    const { cellKey, terrainKey } = req.body
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
  }
)

const importSchema = z.object({
  data: z.any()
    .refine(v => typeof v === 'object' && v !== null && !Array.isArray(v), {
      message: 'data must be an object',
    })
    .refine(v => Object.keys(v).length <= 50_000, {
      message: 'Too many cells in import (max 50 000)',
    }),
})

router.post('/:regionId/import',
  auth,
  uuidParam('regionId'),
  body(importSchema),
  async (req, res) => {
    const { regionId } = req.params
    const { data } = req.body
    try {
      const terrains = await prisma.terrain.findMany({ select: { id: true, name: true } })
      const terrainMap = Object.fromEntries(terrains.map(terrain => [terrain.name, terrain.id]))
      const records = []
      for (const [cellKey, terrainKey] of Object.entries(data)) {
        if (!terrainKey || !CELL_KEY_RE.test(cellKey)) continue
        records.push({
          regionId,
          cellKey,
          terrainId: terrainMap[terrainKey] ?? null,
          userId: req.user.id,
        })
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
  }
)

router.delete('/:regionId', auth, uuidParam('regionId'), async (req, res) => {
  try {
    await prisma.cellPaint.deleteMany({ where: { regionId: req.params.regionId } })
    res.json({ ok: true })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Internal server error' })
  }
})

export default router
