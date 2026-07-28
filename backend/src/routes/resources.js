import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../prisma.js'
import { auth } from '../auth.js'
import { body, uuidParam } from '../lib/validate.js'

const router = Router()

router.get('/resources', async (_req, res) => {
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

const patchResourceLocationSchema = z.object({
  stars: z.number({
    invalid_type_error: 'stars must be an integer 0–5',
    required_error: 'stars must be an integer 0–5',
  })
    .int({ message: 'stars must be an integer 0–5' })
    .min(0, { message: 'stars must be an integer 0–5' })
    .max(5, { message: 'stars must be an integer 0–5' }),
})

router.patch('/resource-locations/:id',
  auth,
  uuidParam('id'),
  body(patchResourceLocationSchema),
  async (req, res) => {
    try {
      await prisma.resourceLocation.update({
        where: { id: req.params.id },
        data: { stars: req.body.stars },
      })
      res.json({ ok: true })
    } catch (err) {
      if (err.code === 'P2025') return res.status(404).json({ error: 'Not found' })
      console.error(err)
      res.status(500).json({ error: 'Internal server error' })
    }
  }
)

export default router
