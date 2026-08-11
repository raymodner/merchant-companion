import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../prisma.js'
import { auth, optionalAuth } from '../auth.js'
import { body, uuidParam } from '../lib/validate.js'
import { config } from '../lib/config.js'

const router = Router()

router.get('/resources', optionalAuth, async (req, res) => {
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

    // Ratings are an append-only history (see resource_ratings) — the current
    // value is whichever row is latest. Prisma cannot express DISTINCT ON
    // without loading all rows, so this stays a raw query (mirrors terrain.js).
    let starsByLocation = new Map()
    if (config.sharedRatings) {
      const rows = await prisma.$queryRaw`
        SELECT DISTINCT ON (rr.resource_location_id) rr.resource_location_id, rr.stars
        FROM resource_ratings rr
        ORDER BY rr.resource_location_id, rr.rated_at DESC
      `
      starsByLocation = new Map(rows.map(r => [r.resource_location_id, r.stars]))
    } else if (req.user) {
      const rows = await prisma.$queryRaw`
        SELECT DISTINCT ON (rr.resource_location_id) rr.resource_location_id, rr.stars
        FROM resource_ratings rr
        WHERE rr.user_id = ${req.user.id}::uuid
        ORDER BY rr.resource_location_id, rr.rated_at DESC
      `
      starsByLocation = new Map(rows.map(r => [r.resource_location_id, r.stars]))
    }

    const formatted = resources.map(resource => ({
      id: resource.id,
      name: resource.name,
      type: resource.resourceType.name,
      icon: resource.icon,
      info: resource.info,
      available: resource.available,
      locations: resource.locations.map(location => ({
        id: location.id,
        terrain: location.locationRef.terrain.name,
        location: location.locationRef.name,
        stars: starsByLocation.get(location.id) ?? 0,
      })),
      chain: resource.chain ? {
        processed: resource.chain.processedName,
        processedCategory: resource.chain.processedCategoryRef.name,
        final1: resource.chain.final1Name
          ? { name: resource.chain.final1Name, category: resource.chain.final1CategoryRef?.name ?? null }
          : null,
        final2: resource.chain.final2Name
          ? { name: resource.chain.final2Name, category: resource.chain.final2CategoryRef?.name ?? null }
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
    if (!config.starEditing) return res.status(403).json({ error: 'Star editing is disabled' })
    try {
      const location = await prisma.resourceLocation.findUnique({ where: { id: req.params.id }, select: { id: true } })
      if (!location) return res.status(404).json({ error: 'Not found' })

      // Append-only, like cell_paints: never mutate a rating, just insert a new
      // one. Multiple users can each submit their own — the latest wins.
      await prisma.resourceRating.create({
        data: { resourceLocationId: req.params.id, userId: req.user.id, stars: req.body.stars },
      })
      res.json({ ok: true })
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Internal server error' })
    }
  }
)

export default router
