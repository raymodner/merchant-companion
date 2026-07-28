import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../prisma.js'
import { auth, optionalAuth } from '../auth.js'
import { body, uuidParam, uuid, lat, lng } from '../lib/validate.js'
import { resolveResourceType } from '../lib/resolvers.js'

const router = Router()

router.get('/player-settlements/:regionId', optionalAuth, uuidParam('regionId'), async (req, res) => {
  const { regionId } = req.params
  try {
    const userId = req.user?.id ?? null
    const rows = await prisma.playerSettlement.findMany({
      where: {
        regionId,
        OR: userId ? [{ isPublic: true }, { userId }] : [{ isPublic: true }],
      },
      include: { user: true, stage: true, resourceTypeRef: true },
      orderBy: { createdAt: 'asc' },
    })
    res.json({
      settlements: rows.map(s => ({
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
      })),
    })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Internal server error' })
  }
})

const postSettlementSchema = z.object({
  stage_id: uuid,
  region_id: uuid,
  lat,
  lng,
  name: z.string().max(200, { message: 'Name must be 200 characters or fewer' }).nullish(),
  resource_type: z.string().max(30, { message: 'Invalid resource_type' }).nullish(),
  is_public: z.boolean().optional(),
})

router.post('/player-settlements', auth, body(postSettlementSchema), async (req, res) => {
  const { stage_id, region_id, lat: latVal, lng: lngVal, name, resource_type, is_public } = req.body
  try {
    // 1. Enforce per-user settlement limit
    const settleCount = await prisma.playerSettlement.count({ where: { userId: req.user.id } })
    if (settleCount >= 50) return res.status(400).json({ error: 'Settlement limit reached (50 max)' })

    // 2. Verify region exists
    const region = await prisma.mapRegion.findUnique({ where: { id: region_id }, select: { id: true } })
    if (!region) return res.status(400).json({ error: 'Invalid region_id' })

    // 3. Verify stage exists
    const stage = await prisma.settlementStage.findUnique({ where: { id: stage_id }, select: { id: true } })
    if (!stage) return res.status(400).json({ error: 'Invalid stage_id' })

    // 4. Verify resource_type exists if provided
    if (resource_type != null) {
      const rt = await prisma.resourceType.findUnique({ where: { name: resource_type }, select: { id: true } })
      if (!rt) return res.status(400).json({ error: 'Invalid resource_type' })
    }

    const resourceTypeId = await resolveResourceType(resource_type)
    const settlement = await prisma.playerSettlement.create({
      data: {
        userId: req.user.id,
        stageId: stage_id,
        resourceTypeId,
        regionId: region_id,
        lat: latVal,
        lng: lngVal,
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
    console.error(err)
    res.status(500).json({ error: 'Internal server error' })
  }
})

const patchSettlementSchema = z.object({
  stage_id: uuid.optional(),
  resource_type: z.string().max(30, { message: 'Invalid resource_type' }).nullish(),
  name: z.string().max(200, { message: 'Name must be 200 characters or fewer' }).nullish(),
  is_public: z.boolean().nullish(),
  lat: lat.optional(),
  lng: lng.optional(),
})

router.patch('/player-settlements/:id', auth, uuidParam('id'), body(patchSettlementSchema), async (req, res) => {
  const { stage_id, resource_type, name, is_public, lat: latVal, lng: lngVal } = req.body
  try {
    // Verify stage exists if provided
    if (stage_id !== undefined) {
      const stage = await prisma.settlementStage.findUnique({ where: { id: stage_id }, select: { id: true } })
      if (!stage) return res.status(400).json({ error: 'Invalid stage_id' })
    }

    const resourceTypeId = resource_type !== undefined ? await resolveResourceType(resource_type) : undefined
    const { count } = await prisma.playerSettlement.updateMany({
      where: { id: req.params.id, userId: req.user.id },
      data: {
        ...(stage_id !== undefined && { stageId: stage_id }),
        ...(resourceTypeId !== undefined && { resourceTypeId }),
        ...(name !== undefined && { name: name || null }),
        ...(is_public != null && { isPublic: is_public === true }),
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

router.delete('/player-settlements/:id', auth, uuidParam('id'), async (req, res) => {
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

export default router
