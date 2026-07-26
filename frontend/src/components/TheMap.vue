<script setup>
import L from 'leaflet'
import { onMounted, onUnmounted, watch } from 'vue'
import { useAuthStore }        from '@/stores/auth.js'
import { useRegionStore }      from '@/stores/region.js'
import { usePaintStore }       from '@/stores/paint.js'
import { useTribesStore }      from '@/stores/tribes.js'
import { useSettlementsStore } from '@/stores/settlements.js'
import { useUiStore }          from '@/stores/ui.js'
import { api }                 from '@/api/index.js'
import { TRIBE_TYPE_ICONS, typeIcon } from '@/utils.js'

const authStore        = useAuthStore()
const regionStore      = useRegionStore()
const paintStore       = usePaintStore()
const tribesStore      = useTribesStore()
const settlementsStore = useSettlementsStore()
const uiStore          = useUiStore()

// ── Non-reactive Leaflet state ─────────────────────────────────────────────
let map = null
const cells               = {}   // cellKey → L.Rectangle
const tribeInstances      = {}   // id      → L.Marker
const settlementInstances = {}   // id      → L.Marker
let isDragging = false

// ── Grid helpers ──────────────────────────────────────────────────────────
const STEP      = 0.1
const snap      = n  => Math.round(n * 10) / 10
const cellKey   = (lat, lng) => `${lat.toFixed(1)},${lng.toFixed(1)}`
const cellCenter = (lat, lng) => [lat + STEP / 2, lng + STEP / 2]

function styleFor(terrainKey) {
  if (!terrainKey || !paintStore.TERRAINS[terrainKey]) {
    return { color: 'rgba(90,62,26,0.22)', weight: 1, fillColor: '#8a6020', fillOpacity: 0.06 }
  }
  return { color: 'rgba(0,0,0,0.28)', weight: 1, fillColor: paintStore.TERRAINS[terrainKey].color, fillOpacity: 0.60 }
}

function tooltipFor(terrainKey, lat, lng) {
  const coord = `${lat.toFixed(1)}°N, ${lng.toFixed(1)}°E`
  if (!terrainKey || !paintStore.TERRAINS[terrainKey]) return coord
  const t = paintStore.TERRAINS[terrainKey]
  return html`<b>${t.icon} ${terrainKey}</b><br><small>${coord}</small>`
}

// ── Grid build / teardown ─────────────────────────────────────────────────
function clearGrid() {
  Object.values(cells).forEach(r => r.remove())
  for (const k in cells) delete cells[k]
}

async function buildGrid(bounds, regionId) {
  const data = await api.loadTerrain(regionId)
  paintStore.setCellState(data)

  const { latMin, latMax, lngMin, lngMax } = bounds

  for (let lat = latMin; lat < latMax; lat = snap(lat + STEP)) {
    for (let lng = lngMin; lng < lngMax; lng = snap(lng + STEP)) {
      const key     = cellKey(lat, lng)
      const terrain = paintStore.cellState[key] || null

      const rect = L.rectangle(
        [[lat, lng], [snap(lat + STEP), snap(lng + STEP)]],
        styleFor(terrain)
      ).bindTooltip(tooltipFor(terrain, lat, lng), { sticky: true })

      rect.on('mousedown', (e) => {
        if (!paintStore.paintMode || e.originalEvent.button !== 0) return
        isDragging = true
        paintCell(key, paintStore.activeTerrain)
      })
      rect.on('mouseover', () => {
        if (paintStore.paintMode && isDragging) paintCell(key, paintStore.activeTerrain)
      })
      rect.on('contextmenu', (e) => {
        L.DomEvent.preventDefault(e)
        if (paintStore.paintMode) paintCell(key, null)
      })

      rect.addTo(map)
      cells[key] = rect
    }
  }

  // Set map view
  let center, zoom
  if (bounds.center) {
    center = bounds.center
    zoom   = bounds.zoom || 8
  } else {
    const span = Math.max(latMax - latMin, lngMax - lngMin)
    zoom   = span > 20 ? 5 : span > 10 ? 6 : span > 6 ? 7 : span > 3 ? 8 : 9
    center = [(latMin + latMax) / 2, (lngMin + lngMax) / 2]
  }
  map.setView(center, zoom)
  applyTerrainFilters()
}

// ── Paint ─────────────────────────────────────────────────────────────────
function paintCell(key, terrainKey) {
  if (!authStore.user) { uiStore.requireAuth(); return }
  const rect = cells[key]
  if (!rect) return

  paintStore.setCellKey(key, terrainKey || null)

  const terrain = terrainKey || null
  const hidden  = terrain && paintStore.hiddenTerrains.includes(terrain)
  rect.setStyle(hidden ? styleFor(null) : styleFor(terrain))

  const [lat, lng] = key.split(',').map(Number)
  rect.setTooltipContent(tooltipFor(terrain, lat, lng))

  api.paintCell(regionStore.currentRegionId, key, terrainKey || null)
}

// ── Terrain filter ─────────────────────────────────────────────────────────
function applyTerrainFilters() {
  Object.entries(cells).forEach(([key, rect]) => {
    const terrain = paintStore.cellState[key]
    const hidden  = terrain && paintStore.hiddenTerrains.includes(terrain)
    rect.setStyle(hidden ? styleFor(null) : styleFor(terrain || null))
  })
}

// ── Tribe marker helpers ──────────────────────────────────────────────────
function makeTribeIcon(color, type) {
  return L.divIcon({
    html: html`<div class="tribe-pin" style="background:${color}">${TRIBE_TYPE_ICONS[type] || '🏕'}</div>`,
    className: '',
    iconSize: [30, 30],
    iconAnchor: [15, 15],
    popupAnchor: [0, -18],
  })
}

class SafeHtml { constructor(s) { this.s = String(s ?? '') } }
const safe = s => new SafeHtml(s)

function html(strings, ...vals) {
  let out = strings[0]
  for (let i = 0; i < vals.length; i++) {
    const v = vals[i]
    out += (v instanceof SafeHtml ? v.s
      : String(v ?? '')
          .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;').replace(/'/g, '&#39;')
    ) + strings[i + 1]
  }
  return out
}

function tribePopupHtml(m) {
  const btns = m.is_own ? safe(`
    <div class="sp-btns">
      <button class="sp-btn sp-edit-btn">✎ Edit</button>
      <button class="sp-btn sp-del-btn">✕ Delete</button>
    </div>`) : safe('')
  return html`<div class="sp-body">
    <div class="sp-tribe">
      <span class="sp-dot" style="background:${m.tribe_color}"></span>
      ${m.tribe_icon} ${m.tribe_name}
    </div>
    <div class="sp-stage">${TRIBE_TYPE_ICONS[m.type] || ''} ${m.type}</div>
    <div class="sp-owner">by ${m.username}</div>
    ${btns}
  </div>`
}

function bindTribePopupButtons(id) {
  const el = tribeInstances[id]?.getPopup()?.getElement()
  if (!el) return
  el.querySelector('.sp-edit-btn')?.addEventListener('click', () => {
    tribeInstances[id]?.closePopup()
    tribesStore.editingId = String(id)
  })
  el.querySelector('.sp-del-btn')?.addEventListener('click', function () {
    if (this.dataset.confirm !== '1') {
      this.dataset.confirm = '1'
      this.textContent = '✕ Confirm?'
      this.style.borderColor = '#d45a3a'
      this.style.color = '#d45a3a'
      return
    }
    tribesStore.deleteMarker(String(id))
  })
}

function syncTribeMarkers() {
  const newMarkers = tribesStore.markers
  // Remove deleted
  for (const id in tribeInstances) {
    if (!newMarkers[id]) {
      tribeInstances[id].remove()
      delete tribeInstances[id]
    }
  }
  // Add/update
  for (const id in newMarkers) {
    const m = newMarkers[id]
    if (!tribeInstances[id]) {
      const marker = L.marker([parseFloat(m.lat), parseFloat(m.lng)], {
        icon: makeTribeIcon(m.tribe_color, m.type),
        zIndexOffset: 100,
      })
      marker.bindPopup(tribePopupHtml(m), { className: 'settlement-popup', minWidth: 150 })
      marker.on('popupopen', () => bindTribePopupButtons(id))
      marker.addTo(map)
      tribeInstances[id] = marker
    } else {
      tribeInstances[id].setIcon(makeTribeIcon(m.tribe_color, m.type))
      tribeInstances[id].getPopup()?.setContent(tribePopupHtml(m))
    }
  }
  applyTribeVisibility()
}

function applyTribeVisibility() {
  for (const id in tribeInstances) {
    const m = tribesStore.markers[id]
    const hidden = m ? tribesStore.isHidden(m) : false
    tribeInstances[id].getElement()?.classList.toggle('marker-hidden', hidden)
  }
}

// ── Settlement marker helpers ─────────────────────────────────────────────
function tierSize(tier) {
  return tier >= 4 ? 40 : tier === 3 ? 34 : tier === 2 ? 30 : 26
}

function makeSettlementIcon(tier, stageIcon) {
  const sz = tierSize(parseInt(tier) || 1)
  return L.divIcon({
    html: html`<div class="player-pin" style="width:${sz}px;height:${sz}px">${stageIcon}</div>`,
    className: '',
    iconSize: [sz, sz],
    iconAnchor: [sz / 2, sz / 2],
    popupAnchor: [0, -(sz / 2) - 4],
  })
}

function settlementPopupHtml(s) {
  const nameLine = s.name ? safe(html`<div class="sp-name">${s.name}</div>`) : safe('')
  const resLine  = s.resource_type
    ? safe(html`<div class="sp-stage">${typeIcon(s.resource_type)} ${s.resource_type}</div>`)
    : safe('')
  const visLine  = s.is_own
    ? safe(`<div class="sp-stage">${s.is_public ? '🔓 Public' : '🔒 Private'}</div>`)
    : safe('')
  const btns = s.is_own ? safe(`
    <div class="sp-btns">
      <button class="sp-btn sp-edit-btn">✎ Edit</button>
      <button class="sp-btn sp-del-btn">✕ Delete</button>
    </div>`) : safe('')
  return html`<div class="sp-body">
    <div class="sp-tribe" style="color:#c9973a">⚑ ${s.username}'s Settlement</div>
    <div class="sp-stage">${s.stage_icon} ${s.stage_name}</div>
    ${resLine}
    ${nameLine}
    ${visLine}
    <div class="sp-owner">by ${s.username}</div>
    ${btns}
  </div>`
}

function bindSettlementPopupButtons(id) {
  const el = settlementInstances[id]?.getPopup()?.getElement()
  if (!el) return
  el.querySelector('.sp-edit-btn')?.addEventListener('click', () => {
    settlementInstances[id]?.closePopup()
    settlementsStore.editingId = String(id)
  })
  el.querySelector('.sp-del-btn')?.addEventListener('click', function () {
    if (this.dataset.confirm !== '1') {
      this.dataset.confirm = '1'
      this.textContent = '✕ Confirm?'
      this.style.borderColor = '#d45a3a'
      this.style.color = '#d45a3a'
      return
    }
    settlementsStore.deleteSettlement(String(id))
  })
}

function syncSettlements() {
  const newS = settlementsStore.playerSettlements
  // Remove deleted
  for (const id in settlementInstances) {
    if (!newS[id]) {
      settlementInstances[id].remove()
      delete settlementInstances[id]
    }
  }
  // Add/update
  for (const id in newS) {
    const s = newS[id]
    const icon = makeSettlementIcon(s.tier, s.stage_icon)
    if (!settlementInstances[id]) {
      const marker = L.marker([parseFloat(s.lat), parseFloat(s.lng)], {
        icon,
        zIndexOffset: 110,
      })
      marker.bindPopup(settlementPopupHtml(s), { className: 'settlement-popup', minWidth: 160 })
      marker.on('popupopen', () => bindSettlementPopupButtons(id))
      marker.addTo(map)
      settlementInstances[id] = marker
    } else {
      settlementInstances[id].setIcon(icon)
      settlementInstances[id].getPopup()?.setContent(settlementPopupHtml(s))
    }
  }
  applySettlementVisibility()
}

function applySettlementVisibility() {
  for (const id in settlementInstances) {
    const s = settlementsStore.playerSettlements[id]
    const hidden = s ? settlementsStore.isHidden(s) : false
    settlementInstances[id].getElement()?.classList.toggle('marker-hidden', hidden)
  }
}

// ── Map event handlers ────────────────────────────────────────────────────
async function onMapClick(e) {
  const { lat, lng } = e.latlng

  if (uiStore.placementMode === 'tribe') {
    if (!authStore.user) { uiStore.cancelPlacement(); uiStore.requireAuth(); return }
    const id = await tribesStore.createMarker({
      tribe_id: tribesStore.activeTribeId,
      type: tribesStore.activeTribeType,
      region_id: regionStore.currentRegionId,
      lat,
      lng,
    })
    uiStore.cancelPlacement()
    if (id != null) setTimeout(() => tribeInstances[id]?.openPopup(), 50)
    return
  }

  if (uiStore.placementMode === 'settle') {
    if (!authStore.user) { uiStore.cancelPlacement(); uiStore.requireAuth(); return }
    const id = await settlementsStore.createSettlement({
      stage_id: settlementsStore.stageId,
      resource_type: settlementsStore.resourceType || null,
      region_id: regionStore.currentRegionId,
      lat,
      lng,
      is_public: settlementsStore.isPublic,
    })
    uiStore.cancelPlacement()
    if (id != null) setTimeout(() => settlementInstances[id]?.openPopup(), 50)
  }
}

function onMouseUp() {
  isDragging = false
  map?.dragging.enable()
}

function onKeyDown(e) {
  if (e.key === 'Escape') uiStore.cancelPlacement()
}

// ── Lifecycle ─────────────────────────────────────────────────────────────
onMounted(() => {
  map = L.map('map').setView([52.3, 5.3], 8)
  setTimeout(() => map.invalidateSize(), 100)

  L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
    attribution: '© OpenStreetMap contributors · © CartoDB',
    maxZoom: 19,
  }).addTo(map)

  map.on('mousedown', () => { if (paintStore.paintMode) map.dragging.disable() })
  map.on('click', onMapClick)
  document.addEventListener('mouseup', onMouseUp)
  document.addEventListener('keydown', onKeyDown)
})

onUnmounted(() => {
  document.removeEventListener('mouseup', onMouseUp)
  document.removeEventListener('keydown', onKeyDown)
  map?.remove()
  map = null
})

// ── Watchers ──────────────────────────────────────────────────────────────

// Region change → rebuild grid + reload markers
watch(() => regionStore.regionKey, async () => {
  if (!map) return
  clearGrid()
  Object.values(tribeInstances).forEach(m => m.remove())
  Object.keys(tribeInstances).forEach(k => delete tribeInstances[k])
  Object.values(settlementInstances).forEach(m => m.remove())
  Object.keys(settlementInstances).forEach(k => delete settlementInstances[k])
  tribesStore.clearMarkers()
  settlementsStore.clearSettlements()

  const bounds = regionStore.currentBounds
  if (!bounds) {
    // US with no state selected
    if (regionStore.currentCountry === 'United States') map.setView([39.5, -98.5], 5)
    return
  }

  const regionId = regionStore.currentRegionId
  await buildGrid(bounds, regionId)
  await Promise.all([
    tribesStore.fetchMarkers(regionId),
    settlementsStore.fetchSettlements(regionId),
  ])
}, { immediate: false })

// Tribe markers store → sync Leaflet instances
watch(() => tribesStore.markers, syncTribeMarkers, { deep: true })

// Tribe visibility filters
watch(
  [() => tribesStore.hiddenTribes, () => tribesStore.hiddenTribeTypes],
  applyTribeVisibility,
  { deep: true }
)

// Settlement store → sync Leaflet instances
watch(() => settlementsStore.playerSettlements, syncSettlements, { deep: true })

// Settlement visibility filters
watch(
  [() => settlementsStore.hiddenStages, () => settlementsStore.hiddenProducts, () => settlementsStore.showOwnOnly],
  applySettlementVisibility,
  { deep: true }
)

// Terrain visibility filters
watch(() => paintStore.hiddenTerrains, applyTerrainFilters, { deep: true })

// Auth change → refresh popup content (edit/delete buttons appear/disappear)
watch(() => authStore.user, () => {
  Object.values(tribesStore.markers).forEach(m => {
    tribeInstances[m.id]?.getPopup()?.setContent(tribePopupHtml(m))
  })
  Object.values(settlementsStore.playerSettlements).forEach(s => {
    settlementInstances[s.id]?.getPopup()?.setContent(settlementPopupHtml(s))
  })
  applySettlementVisibility()
})

// ── Exposed methods ───────────────────────────────────────────────────────
async function initRegion() {
  const bounds   = regionStore.currentBounds
  const regionId = regionStore.currentRegionId
  if (!map) return
  if (!bounds) {
    if (regionStore.currentCountry === 'United States') map.setView([39.5, -98.5], 5)
    return
  }
  await buildGrid(bounds, regionId)
  await Promise.all([
    tribesStore.fetchMarkers(regionId),
    settlementsStore.fetchSettlements(regionId),
  ])
}

async function initRegionFromLocation() {
  let gpsPos = null

  // 1. Try GPS (short timeout — don't block startup long)
  if (navigator.geolocation) {
    gpsPos = await new Promise(resolve =>
      navigator.geolocation.getCurrentPosition(resolve, () => resolve(null), { timeout: 5000 })
    )
  }

  // 2. If GPS granted, find the matching country (and US state) and switch if needed
  if (gpsPos) {
    const { latitude: lat, longitude: lng } = gpsPos.coords
    const countries = regionStore.regions.countries
    const states    = regionStore.regions.states

    for (const [name, b] of Object.entries(countries)) {
      if (lat >= b.latMin && lat <= b.latMax && lng >= b.lngMin && lng <= b.lngMax) {
        if (name !== regionStore.currentCountry) await regionStore.setCountry(name)
        if (name === 'United States') {
          for (const [sname, sb] of Object.entries(states)) {
            if (lat >= sb.latMin && lat <= sb.latMax && lng >= sb.lngMin && lng <= sb.lngMax) {
              if (sname !== regionStore.currentState) await regionStore.setState(sname)
              break
            }
          }
        }
        break
      }
    }
  }

  // 3. Init grid + markers for (possibly new) region
  await initRegion()

  // 4. Fly to GPS position if it's within bounds; else fall back to best settlement
  if (gpsPos) {
    const { latitude: lat, longitude: lng } = gpsPos.coords
    if (map?.getBounds().contains([lat, lng])) {
      map.setView([lat, lng], 13)
      return
    }
  }
  const all = Object.values(settlementsStore.playerSettlements)
  if (!all.length) return
  const best = all.reduce((a, b) => parseInt(b.tier) > parseInt(a.tier) ? b : a)
  map?.setView([parseFloat(best.lat), parseFloat(best.lng)], 13)
}

function panToTribe(id) {
  const m = tribesStore.markers[id]
  if (!m || !map) return
  map.setView([parseFloat(m.lat), parseFloat(m.lng)])
  setTimeout(() => tribeInstances[id]?.openPopup(), 50)
}

function panToSettlement(id) {
  const s = settlementsStore.playerSettlements[id]
  if (!s || !map) return
  map.setView([parseFloat(s.lat), parseFloat(s.lng)])
  setTimeout(() => settlementInstances[id]?.openPopup(), 50)
}

defineExpose({ initRegion, initRegionFromLocation, panToTribe, panToSettlement })
</script>

<template>
  <div id="map"></div>
</template>
