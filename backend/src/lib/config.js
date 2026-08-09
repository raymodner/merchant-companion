const _allowlistRaw = (process.env.REGISTRATION_ALLOWLIST ?? '').trim()
const registrationAllowlist = _allowlistRaw
  ? new Set(_allowlistRaw.split(',').map(e => e.trim().toLowerCase()).filter(Boolean))
  : null

const registrationOpen = (process.env.REGISTRATION_OPEN ?? 'true') !== 'false'

export const config = {
  maxTribeMarkers:      parseInt(process.env.MAX_TRIBE_MARKERS      ?? '50', 10),
  maxSettlements:       parseInt(process.env.MAX_SETTLEMENTS         ?? '50', 10),
  maxPublicSettlements: parseInt(process.env.MAX_PUBLIC_SETTLEMENTS  ?? '10', 10),
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
