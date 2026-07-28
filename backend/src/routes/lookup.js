import { Router } from 'express'
import { prisma } from '../prisma.js'

const router = Router()

router.get('/terrains', async (_req, res) => {
  try {
    const terrains = await prisma.terrain.findMany({
      orderBy: { name: 'asc' },
      select: { name: true, color: true, icon: true },
    })
    res.json({ terrains })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Internal server error' })
  }
})

router.get('/tribes', async (_req, res) => {
  try {
    const tribes = await prisma.tribe.findMany({ orderBy: { name: 'asc' } })
    res.json({ tribes })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Internal server error' })
  }
})

router.get('/settlement-stages', async (_req, res) => {
  try {
    const stages = await prisma.settlementStage.findMany({ orderBy: { sortOrder: 'asc' } })
    res.json({
      stages: stages.map(stage => ({
        id: stage.id,
        name: stage.name,
        sort_order: stage.sortOrder,
        tier: stage.tier,
        icon: stage.icon,
        population: stage.population,
        days_building: stage.daysBuilding,
      })),
    })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Internal server error' })
  }
})

export default router
