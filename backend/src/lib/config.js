export const config = {
  maxTribeMarkers:     parseInt(process.env.MAX_TRIBE_MARKERS      ?? '50',   10),
  maxSettlements:      parseInt(process.env.MAX_SETTLEMENTS         ?? '50',   10),
  maxPublicSettlements:parseInt(process.env.MAX_PUBLIC_SETTLEMENTS  ?? '10',   10),
  starEditing:         (process.env.STAR_EDITING ?? 'true') !== 'false',
  contact: {
    name:    process.env.CONTACT_NAME    ?? '',
    discord: process.env.CONTACT_DISCORD ?? '',
    email:   process.env.CONTACT_EMAIL   ?? '',
  },
}
