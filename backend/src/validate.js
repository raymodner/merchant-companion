export const isUuid  = v => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v)
export const isEmail = v => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(v ?? ''))
export const isLat   = v => typeof v === 'number' && isFinite(v) && v >= -90  && v <= 90
export const isLng   = v => typeof v === 'number' && isFinite(v) && v >= -180 && v <= 180

// Returns an error string or null
export function validateUuidParam(value, label = 'id') {
  if (!isUuid(value)) return `Invalid ${label}`
  return null
}
