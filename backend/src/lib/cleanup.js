import { prisma } from '../prisma.js'

async function cleanCellPaints() {
  try {
    const deleted = await prisma.$executeRaw`
      DELETE FROM cell_paints cp
      WHERE cp.painted_at < NOW() - INTERVAL '1 month'
        AND NOT EXISTS (
          SELECT 1 FROM (
            SELECT DISTINCT ON (region_id, cell_key) id
            FROM cell_paints
            ORDER BY region_id, cell_key, painted_at DESC
          ) latest WHERE latest.id = cp.id
        )
    `
    if (deleted > 0) console.log(`[cleanup] Removed ${deleted} superseded cell_paint rows`)
  } catch (err) {
    console.error('[cleanup] cell_paints cleanup failed:', err)
  }
}

const DAY_MS = 24 * 60 * 60 * 1000

export function startCleanup() {
  setTimeout(cleanCellPaints, 60_000)
  setInterval(cleanCellPaints, DAY_MS)
}
