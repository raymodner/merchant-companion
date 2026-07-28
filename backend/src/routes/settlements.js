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
      settlements: rows.map(settlement => ({
        id: settlement.id,
        lat: settlement.lat,
        lng: settlement.lng,
        name: settlement.name,
        resource_type: settlement.resourceTypeRef?.name ?? null,
        region_id: regionId,
        is_own: userId != null && settlement.userId === userId,
        is_public: settlement.isPublic,
        username: settlement.user.username,
        stage_id: settlement.stageId,
        stage_name: settlement.stage.name,
        tier: settlement.stage.tier,
        stage_icon: settlement.stage.icon,
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
    // Verify region and stage exist before opening the transaction
    const region = await prisma.mapRegion.findUnique({ where: { id: region_id }, select: { id: true } })
    if (!region) return res.status(400).json({ error: 'Invalid region_id' })

    const stage = await prisma.settlementStage.findUnique({ where: { id: stage_id }, select: { id: true } })
    if (!stage) return res.status(400).json({ error: 'Invalid stage_id' })

    if (resource_type != null) {
      const resourceType = await prisma.resourceType.findUnique({ where: { name: resource_type }, select: { id: true } })
      if (!resourceType) return res.status(400).json({ error: 'Invalid resource_type' })
    }

    const resourceTypeId = await resolveResourceType(resource_type)

    // Count checks and insert in a serializable transaction to prevent races
    const settlement = await prisma.$transaction(async (tx) => {
      const totalCount = await tx.playerSettlement.count({ where: { userId: req.user.id } })
      if (totalCount >= 50) throw Object.assign(new Error('Settlement limit reached (50 max)'), { code: 'LIMIT' })

      if (is_public === true) {
        const publicCount = await tx.playerSettlement.count({ where: { userId: req.user.id, isPublic: true } })
        if (publicCount >= 10) throw Object.assign(new Error('Public settlement limit reached (10 max)'), { code: 'LIMIT' })
      }

      return tx.playerSettlement.create({
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
    }, { isolationLevel: 'Serializable' })

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
    if (err.code === 'LIMIT') return res.status(400).json({ error: err.message })
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
    // Enforce public settlement limit when making a settlement public
    if (is_public === true) {
      const publicCount = await prisma.playerSettlement.count({
        where: { userId: req.user.id, isPublic: true, NOT: { id: req.params.id } },
      })
      if (publicCount >= 10) return res.status(400).json({ error: 'Public settlement limit reached (10 max)' })
    }

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
