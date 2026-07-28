import { prisma } from '../prisma.js'

async function cleanCellPaints() {
  try {
    const deleted = await prisma.$executeRaw`
      DELETE FROM cell_paints
      WHERE id NOT IN (
        SELECT DISTINCT ON (region_id, cell_key) id
        FROM cell_paints
        ORDER BY region_id, cell_key, painted_at DESC
      )
    `
    if (deleted > 0) console.log(`[cleanup] Removed ${deleted} superseded cell_paint rows`)
  } catch (err) {
    console.error('[cleanup] cell_paints cleanup failed:', err)
  }
}

const INTERVAL_MS = 30 * 24 * 60 * 60 * 1000

export function startCleanup() {
  // First run 1 minute after startup, then every 24 hours
  setTimeout(cleanCellPaints, 60_000)
  setInterval(cleanCellPaints, INTERVAL_MS)
}
