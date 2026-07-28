import { Router } from 'express'
import { prisma } from '../prisma.js'

const router = Router()

router.get('/regions', async (_req, res) => {
  try {
    const regions = await prisma.mapRegion.findMany({ orderBy: { name: 'asc' } })
    const idToName = {}
    for (const region of regions) if (region.parentId === null) idToName[region.id] = region.name
    const countries = {}, subregions = {}
    for (const region of regions) {
      const obj = {
        id: region.id,
        latMin: parseFloat(region.latMin),
        latMax: parseFloat(region.latMax),
        lngMin: parseFloat(region.lngMin),
        lngMax: parseFloat(region.lngMax),
        center: region.centerLat ? [parseFloat(region.centerLat), parseFloat(region.centerLng)] : null,
        zoom: region.zoom,
      }
      if (region.parentId === null) {
        countries[region.name] = obj
      } else {
        const parent = idToName[region.parentId]
        if (!subregions[parent]) subregions[parent] = {}
        subregions[parent][region.name] = obj
      }
    }
    res.json({ countries, subregions })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Internal server error' })
  }
})

export default router
