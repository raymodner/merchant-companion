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
import { tribeTypeIcon, typeIcon } from '@/utils.js'

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
  return { color: 'rgba(0,0,0,0.28)', weight: 1, fillColor: paintStore.TERRAINS[terrainKey].color, fillOpacity: 0.40 }
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

const confirmedTerrain = {}  // cellKey → last server-confirmed terrain (absent/null = unpainted)

async function buildGrid(bounds, regionId) {
  const data = await api.loadTerrain(regionId)
  paintStore.setCellState(data)
  for (const k in confirmedTerrain) delete confirmedTerrain[k]
  Object.assign(confirmedTerrain, data)

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
function renderCell(key, terrain) {
  const rect = cells[key]
  if (!rect) return
  const hidden = terrain && paintStore.hiddenTerrains.includes(terrain)
  rect.setStyle(hidden ? styleFor(null) : styleFor(terrain))
  const [lat, lng] = key.split(',').map(Number)
  rect.setTooltipContent(tooltipFor(terrain, lat, lng))
}

const paintSeq = {}  // cellKey → sequence number of the most recently issued paint request

async function paintCell(key, terrainKey) {
  if (!authStore.user) { uiStore.requireAuth(); return }
  if (!cells[key]) return

  const terrain  = terrainKey || null
  const regionId = regionStore.currentRegionId
  const seq      = (paintSeq[key] || 0) + 1
  paintSeq[key]  = seq

  paintStore.setCellKey(key, terrain)
  renderCell(key, terrain)

  const ok = await api.paintCell(regionId, key, terrain)

  // A newer paint request (or a region switch that rebuilt the grid) has
  // superseded this one — its result is stale and must not roll anything back.
  if (paintSeq[key] !== seq || regionStore.currentRegionId !== regionId) return

  if (ok) {
    confirmedTerrain[key] = terrain
  } else {
    // Roll back to the last server-confirmed value, not the previous optimistic
    // one — an earlier optimistic write may never have been persisted either.
    const fallback = confirmedTerrain[key] || null
    paintStore.setCellKey(key, fallback)
    renderCell(key, fallback)
  }
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
    html: html`<div class="tribe-pin" style="background:${color}">${tribeTypeIcon(type)}</div>`,
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
    <div class="sp-stage">${tribeTypeIcon(m.type)} ${m.type}</div>
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
      marker.bindPopup(tribePopupHtml(m), { className: 'settlement-popup', minWidth: 200 })
      marker.on('popupopen', () => bindTribePopupButtons(id))
      marker.addTo(map)
      tribeInstances[id] = marker
    } else {
      tribeInstances[id].setLatLng([parseFloat(m.lat), parseFloat(m.lng)])
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

function makeSettlementIcon(tier, stageIcon, isOwn) {
  const sz   = tierSize(parseInt(tier) || 1)
  const ring = isOwn ? '#c9973a' : '#6a9aaf'
  return L.divIcon({
    html: html`<div class="player-pin" style="width:${sz}px;height:${sz}px;border-color:${safe(ring)}">${stageIcon}</div>`,
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
    const icon = makeSettlementIcon(s.tier, s.stage_icon, s.is_own)
    if (!settlementInstances[id]) {
      const marker = L.marker([parseFloat(s.lat), parseFloat(s.lng)], {
        icon,
        zIndexOffset: 110,
      })
      marker.bindPopup(settlementPopupHtml(s), { className: 'settlement-popup', minWidth: 200 })
      marker.on('popupopen', () => bindSettlementPopupButtons(id))
      marker.addTo(map)
      settlementInstances[id] = marker
    } else {
      settlementInstances[id].setLatLng([parseFloat(s.lat), parseFloat(s.lng)])
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

  if (uiStore.placementMode === 'relocate-tribe') {
    const id = tribesStore.relocatingId
    try {
      if (id && authStore.user) {
        const error = await tribesStore.updateMarker(id, { ...tribesStore.relocatingData, lat, lng })
        if (error) uiStore.showPlacementError(error)
      }
    } catch {
      uiStore.showPlacementError('Failed to move marker — check your connection')
    } finally {
      tribesStore.relocatingId   = null
      tribesStore.relocatingData = null
      uiStore.cancelPlacement()
    }
    return
  }

  if (uiStore.placementMode === 'relocate-settle') {
    const id = settlementsStore.relocatingId
    try {
      if (id && authStore.user) {
        const error = await settlementsStore.updateSettlement(id, { ...settlementsStore.relocatingData, lat, lng })
        if (error) uiStore.showPlacementError(error)
      }
    } catch {
      uiStore.showPlacementError('Failed to move settlement — check your connection')
    } finally {
      settlementsStore.relocatingId   = null
      settlementsStore.relocatingData = null
      uiStore.cancelPlacement()
    }
    return
  }

  if (uiStore.placementMode === 'tribe') {
    if (!authStore.user) { uiStore.cancelPlacement(); uiStore.requireAuth(); return }
    try {
      const { id, error } = await tribesStore.createMarker({
        tribe_id: tribesStore.activeTribeId,
        type: tribesStore.activeTribeType,
        region_id: regionStore.currentRegionId,
        lat,
        lng,
      })
      if (error) uiStore.showPlacementError(error)
      else setTimeout(() => tribeInstances[id]?.openPopup(), 50)
    } catch {
      uiStore.showPlacementError('Failed to place marker — check your connection')
    } finally {
      uiStore.cancelPlacement()
    }
    return
  }

  if (uiStore.placementMode === 'settle') {
    if (!authStore.user) { uiStore.cancelPlacement(); uiStore.requireAuth(); return }
    try {
      const { id, error } = await settlementsStore.createSettlement({
        stage_id: settlementsStore.stageId,
        resource_type: settlementsStore.resourceType || null,
        region_id: regionStore.currentRegionId,
        lat,
        lng,
        is_public: settlementsStore.isPublic,
      })
      if (error) uiStore.showPlacementError(error)
      else setTimeout(() => settlementInstances[id]?.openPopup(), 50)
    } catch {
      uiStore.showPlacementError('Failed to place settlement — check your connection')
    } finally {
      uiStore.cancelPlacement()
    }
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

function clearRegionState() {
  clearGrid()
  Object.values(tribeInstances).forEach(m => m.remove())
  Object.keys(tribeInstances).forEach(k => delete tribeInstances[k])
  Object.values(settlementInstances).forEach(m => m.remove())
  Object.keys(settlementInstances).forEach(k => delete settlementInstances[k])
  tribesStore.clearMarkers()
  settlementsStore.clearSettlements()
}

function flyToCountryFallback() {
  // A country with subregions but no state selected has no cell bounds of its
  // own to build a grid from — fall back to that country's own center/zoom.
  const country = regionStore.regions.countries[regionStore.currentCountry]
  if (country?.center) map.setView(country.center, country.zoom || 5)
}

// Region change → rebuild grid + reload markers
watch(() => regionStore.regionKey, async () => {
  if (!map) return
  clearRegionState()

  const bounds = regionStore.currentBounds
  if (!bounds) {
    flyToCountryFallback()
    return
  }

  const regionId = regionStore.currentRegionId
  await buildGrid(bounds, regionId)
  await Promise.all([
    tribesStore.fetchMarkers(regionId),
    settlementsStore.fetchSettlements(regionId),
  ])
}, { immediate: false })

// Placement cancelled (Escape / Cancel button) while relocating → drop the
// pending move so nothing lingers; a completed move already clears these itself.
watch(() => uiStore.placementMode, (mode, prev) => {
  if (prev === 'relocate-tribe' && mode !== 'relocate-tribe') {
    tribesStore.relocatingId   = null
    tribesStore.relocatingData = null
  }
  if (prev === 'relocate-settle' && mode !== 'relocate-settle') {
    settlementsStore.relocatingId   = null
    settlementsStore.relocatingData = null
  }
})

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
  [() => settlementsStore.hiddenStages, () => settlementsStore.hiddenProducts, () => settlementsStore.showPublic],
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
  clearRegionState()
  if (!bounds) {
    flyToCountryFallback()
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

  // 2. If GPS granted, find the matching country (and subregion, if it has any) and switch if needed
  if (gpsPos) {
    const { latitude: lat, longitude: lng } = gpsPos.coords
    const countries = regionStore.regions.countries

    for (const [name, b] of Object.entries(countries)) {
      if (lat >= b.latMin && lat <= b.latMax && lng >= b.lngMin && lng <= b.lngMax) {
        if (name !== regionStore.currentCountry) await regionStore.setCountry(name)
        const countrySubregions = regionStore.regions.subregions[name] || {}
        for (const [sname, sb] of Object.entries(countrySubregions)) {
          if (lat >= sb.latMin && lat <= sb.latMax && lng >= sb.lngMin && lng <= sb.lngMax) {
            if (sname !== regionStore.currentState) await regionStore.setState(sname)
            break
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

async function placeAt(lat, lng) { await onMapClick({ latlng: { lat, lng } }) }

defineExpose({ initRegion, initRegionFromLocation, panToTribe, panToSettlement, placeAt })
</script>

<template>
  <div id="map"></div>
</template>
