export const TRIBE_TYPE_ICONS = { Camp: '🏕', Selo: '🏘', Burgh: '🏰' }

export const TYPE_ICONS = {
  'Ore': '⛏', 'Stone': '🪨', 'Wood': '🌲', 'Raw Food': '🌾',
  'Animal': '🐄', 'Agricultural': '🌾', 'Metal': '⚙', 'Textile': '🧵',
  'Spice': '🌿', 'Fish': '🐟', 'Game': '🦌',
}

export function typeIcon(t) { return TYPE_ICONS[t] || '📦' }
