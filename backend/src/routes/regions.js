import { Router } from 'express'
import { prisma } from '../prisma.js'

const router = Router()

router.get('/regions', async (_req, res) => {
  try {
    const rows = await prisma.mapRegion.findMany({ orderBy: { name: 'asc' } })
    const idToName = {}
    for (const r of rows) if (r.parentId === null) idToName[r.id] = r.name
    const countries = {}, subregions = {}
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
      if (r.parentId === null) {
        countries[r.name] = obj
      } else {
        const parent = idToName[r.parentId]
        if (!subregions[parent]) subregions[parent] = {}
        subregions[parent][r.name] = obj
      }
    }
    res.json({ countries, subregions })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Internal server error' })
  }
})

export default router
