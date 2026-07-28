import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../prisma.js'
import { auth } from '../auth.js'
import { body, uuidParam, uuid, lat, lng } from '../lib/validate.js'
import { resolveTribeType } from '../lib/resolvers.js'

const router = Router()

router.get('/tribe-markers/:regionId', auth, uuidParam('regionId'), async (req, res) => {
  const { regionId } = req.params
  try {
    const rows = await prisma.tribeMarker.findMany({
      where: { regionId, placedBy: req.user.id },
      include: { user: true, tribe: true, tribeType: true },
      orderBy: { createdAt: 'asc' },
    })
    res.json({
      markers: rows.map(m => ({
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
      })),
    })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Internal server error' })
  }
})

const postTribeMarkerSchema = z.object({
  tribe_id: uuid,
  type: z.enum(['Camp', 'Selo', 'Burgh']),
  region_id: uuid,
  lat,
  lng,
})

router.post('/tribe-markers', auth, body(postTribeMarkerSchema), async (req, res) => {
  const { tribe_id, type, region_id, lat: latVal, lng: lngVal } = req.body
  try {
    // 1. Enforce per-user tribe marker limit
    const tribeCount = await prisma.tribeMarker.count({ where: { placedBy: req.user.id } })
    if (tribeCount >= 50) return res.status(400).json({ error: 'Tribe marker limit reached (50 max)' })

    // 2. Verify region exists
    const region = await prisma.mapRegion.findUnique({ where: { id: region_id }, select: { id: true } })
    if (!region) return res.status(400).json({ error: 'Invalid region_id' })

    // 3. Verify tribe exists
    const tribe = await prisma.tribe.findUnique({ where: { id: tribe_id }, select: { id: true } })
    if (!tribe) return res.status(400).json({ error: 'Invalid tribe_id' })

    const tribeTypeId = await resolveTribeType(type)
    const marker = await prisma.tribeMarker.create({
      data: { placedBy: req.user.id, tribeId: tribe_id, tribeTypeId, regionId: region_id, lat: latVal, lng: lngVal },
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
    console.error(err)
    res.status(500).json({ error: 'Internal server error' })
  }
})

const patchTribeMarkerSchema = z.object({
  type: z.enum(['Camp', 'Selo', 'Burgh']).optional(),
  tribe_id: uuid.optional(),
  lat: lat.optional(),
  lng: lng.optional(),
})

router.patch('/tribe-markers/:id', auth, uuidParam('id'), body(patchTribeMarkerSchema), async (req, res) => {
  const { type, tribe_id, lat: latVal, lng: lngVal } = req.body
  try {
    const tribeTypeId = type !== undefined ? await resolveTribeType(type) : undefined
    const { count } = await prisma.tribeMarker.updateMany({
      where: { id: req.params.id, placedBy: req.user.id },
      data: {
        ...(tribeTypeId !== undefined && { tribeTypeId }),
        ...(tribe_id !== undefined && { tribeId: tribe_id }),
        ...(latVal !== undefined && { lat: latVal }),
        ...(lngVal !== undefined && { lng: lngVal }),
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

router.delete('/tribe-markers/:id', auth, uuidParam('id'), async (req, res) => {
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

export default router
