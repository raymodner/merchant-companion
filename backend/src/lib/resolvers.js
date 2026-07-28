import { prisma } from '../prisma.js'

const terrainCache = new Map()
export async function resolveTerrain(name) {
  if (!name) return null
  if (terrainCache.has(name)) return terrainCache.get(name)
  const terrain = await prisma.terrain.findUnique({ where: { name }, select: { id: true } })
  if (terrain) terrainCache.set(name, terrain.id)
  return terrain?.id ?? null
}

const tribeTypeCache = new Map()
export async function resolveTribeType(name) {
  if (tribeTypeCache.has(name)) return tribeTypeCache.get(name)
  const tribeType = await prisma.tribeType.findUnique({ where: { name }, select: { id: true } })
  if (tribeType) tribeTypeCache.set(name, tribeType.id)
  return tribeType?.id ?? null
}

const resourceTypeCache = new Map()
export async function resolveResourceType(name) {
  if (!name) return null
  if (resourceTypeCache.has(name)) return resourceTypeCache.get(name)
  const resourceType = await prisma.resourceType.findUnique({ where: { name }, select: { id: true } })
  if (resourceType) resourceTypeCache.set(name, resourceType.id)
  return resourceType?.id ?? null
}
