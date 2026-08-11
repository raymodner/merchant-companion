import { prisma } from '../prisma.js'

const terrainCache = new Map()
export async function resolveTerrain(name) {
  if (!name) return null
  if (terrainCache.has(name)) return terrainCache.get(name)
  const terrain = await prisma.terrain.findUnique({ where: { name }, select: { id: true } })
  const id = terrain?.id ?? null
  terrainCache.set(name, id)
  return id
}

const tribeTypeCache = new Map()
export async function resolveTribeType(name) {
  if (!name) return null
  if (tribeTypeCache.has(name)) return tribeTypeCache.get(name)
  const tribeType = await prisma.tribeType.findUnique({ where: { name }, select: { id: true } })
  const id = tribeType?.id ?? null
  tribeTypeCache.set(name, id)
  return id
}

const resourceTypeCache = new Map()
export async function resolveResourceType(name) {
  if (!name) return null
  if (resourceTypeCache.has(name)) return resourceTypeCache.get(name)
  const resourceType = await prisma.resourceType.findUnique({ where: { name }, select: { id: true } })
  const id = resourceType?.id ?? null
  resourceTypeCache.set(name, id)
  return id
}
