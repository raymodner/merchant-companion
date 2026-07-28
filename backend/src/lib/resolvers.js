import { prisma } from '../prisma.js'

const terrainCache = new Map()
export async function resolveTerrain(name) {
  if (!name) return null
  if (terrainCache.has(name)) return terrainCache.get(name)
  const t = await prisma.terrain.findUnique({ where: { name }, select: { id: true } })
  if (t) terrainCache.set(name, t.id)
  return t?.id ?? null
}

const tribeTypeCache = new Map()
export async function resolveTribeType(name) {
  if (tribeTypeCache.has(name)) return tribeTypeCache.get(name)
  const tt = await prisma.tribeType.findUnique({ where: { name }, select: { id: true } })
  if (tt) tribeTypeCache.set(name, tt.id)
  return tt?.id ?? null
}

const resourceTypeCache = new Map()
export async function resolveResourceType(name) {
  if (!name) return null
  if (resourceTypeCache.has(name)) return resourceTypeCache.get(name)
  const rt = await prisma.resourceType.findUnique({ where: { name }, select: { id: true } })
  if (rt) resourceTypeCache.set(name, rt.id)
  return rt?.id ?? null
}
