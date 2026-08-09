import { Router } from 'express'
import { config } from '../lib/config.js'

const router = Router()

router.get('/config', (_req, res) => {
  res.json({
    maxTribeMarkers:      config.maxTribeMarkers,
    maxSettlements:       config.maxSettlements,
    maxPublicSettlements: config.maxPublicSettlements,
    starEditing:          config.starEditing,
    contact:              config.contact,
  })
})

export default router
