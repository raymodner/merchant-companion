function requireInt(name, fallback) {
  const raw = process.env[name]
  if (raw == null || raw === '') return fallback
  const v = parseInt(raw, 10)
  if (!Number.isFinite(v) || v < 1) throw new Error(`${name} must be a positive integer (got: "${raw}")`)
  return v
}

const _allowlistRaw = (process.env.REGISTRATION_ALLOWLIST ?? '').trim()
const registrationAllowlist = _allowlistRaw
  ? new Set(_allowlistRaw.split(',').map(e => e.trim().toLowerCase()).filter(Boolean))
  : null

const registrationOpen = (process.env.REGISTRATION_OPEN ?? 'true') !== 'false'

export const config = {
  maxTribeMarkers:      requireInt('MAX_TRIBE_MARKERS',      50),
  maxSettlements:       requireInt('MAX_SETTLEMENTS',        50),
  maxPublicSettlements: requireInt('MAX_PUBLIC_SETTLEMENTS', 10),
  starEditing:                  (process.env.STAR_EDITING                   ?? 'true') !== 'false',
  publicSettlementsRequireAuth: (process.env.PUBLIC_SETTLEMENTS_REQUIRE_AUTH ?? 'false') !== 'false',
  registrationOpen,
  registrationAllowlist,
  // registrationEnabled: false only when fully closed with no allowlist
  registrationEnabled:  registrationOpen || registrationAllowlist !== null,
  contact: {
    name:    process.env.CONTACT_NAME    ?? '',
    discord: process.env.CONTACT_DISCORD ?? '',
    email:   process.env.CONTACT_EMAIL   ?? '',
  },
}
