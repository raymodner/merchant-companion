import { defineStore } from 'pinia'
import { ref, computed, watch } from 'vue'
import { api } from '@/api/index.js'
import { useAuthStore } from './auth.js'

function loadArr(key) {
  try { return JSON.parse(localStorage.getItem(key) || '[]') } catch { return [] }
}

export const useTribesStore = defineStore('tribes', () => {
  const TRIBES = ref([])
  const markers = ref({})            // id (string) → plain data object
  const hiddenTribes = ref(loadArr('filter-hidden-tribes'))
  const hiddenTribeTypes = ref(loadArr('filter-hidden-tribe-types'))

  watch(hiddenTribes, v => localStorage.setItem('filter-hidden-tribes', JSON.stringify(v)), { deep: true })
  watch(hiddenTribeTypes, v => localStorage.setItem('filter-hidden-tribe-types', JSON.stringify(v)), { deep: true })

  const tribePlaceMode = ref(false)
  const activeTribeId = ref(null)
  const activeTribeType = ref('Camp')
  const editingId = ref(null)        // string id of marker being edited, or null

  function isHidden(m) {
    return hiddenTribes.value.includes(m.tribe_id) || hiddenTribeTypes.value.includes(m.type)
  }

  const visibleMarkers = computed(() => Object.values(markers.value).filter(m => !isHidden(m)))

  async function fetchTribes() {
    const data = await api.getTribes()
    TRIBES.value = data.tribes || []
    if (TRIBES.value.length) activeTribeId.value = TRIBES.value[0].id
  }

  async function fetchMarkers(regionId) {
    const authStore = useAuthStore()
    if (!authStore.user) {
      clearMarkers()
      return
    }
    const data = await api.getTribeMarkers(regionId)
    clearMarkers()
    for (const m of (data.markers || [])) {
      markers.value[m.id] = m
    }
  }

  function clearMarkers() {
    Object.keys(markers.value).forEach(k => delete markers.value[k])
  }

  async function createMarker(data) {
    const result = await api.createTribeMarker(data)
    if (!result) return null
    markers.value[result.id] = result
    return result.id
  }

  async function updateMarker(id, data) {
    const { ok, data: resp } = await api.updateTribeMarker(id, data)
    if (!ok) return resp.error || 'Failed to update'
    // Update local data with tribe info from TRIBES list
    const existing = markers.value[id]
    if (existing) {
      const tribeId = data.tribe_id || existing.tribe_id
      const tribe = TRIBES.value.find(t => t.id === tribeId)
      markers.value[id] = {
        ...existing,
        tribe_id: tribeId,
        tribe_name: tribe?.name ?? existing.tribe_name,
        tribe_color: tribe?.color ?? existing.tribe_color,
        tribe_icon: tribe?.icon ?? existing.tribe_icon,
        type: data.type || existing.type,
      }
    }
    return null
  }

  async function deleteMarker(id) {
    const ok = await api.deleteTribeMarker(id)
    if (ok) delete markers.value[id]
  }

  function toggleHideTribe(id) {
    const idx = hiddenTribes.value.indexOf(id)
    if (idx > -1) hiddenTribes.value.splice(idx, 1)
    else hiddenTribes.value.push(id)
  }

  function toggleHideType(type) {
    const idx = hiddenTribeTypes.value.indexOf(type)
    if (idx > -1) hiddenTribeTypes.value.splice(idx, 1)
    else hiddenTribeTypes.value.push(type)
  }

  function showAllTribes() {
    hiddenTribes.value.splice(0)
    hiddenTribeTypes.value.splice(0)
  }

  function hideAllTribes() {
    const allIds = TRIBES.value.map(t => t.id)
    hiddenTribes.value.splice(0, hiddenTribes.value.length, ...allIds)
    hiddenTribeTypes.value.splice(0, hiddenTribeTypes.value.length, 'Camp', 'Selo', 'Burgh')
  }

  return {
    TRIBES, markers, hiddenTribes, hiddenTribeTypes,
    tribePlaceMode, activeTribeId, activeTribeType, editingId,
    visibleMarkers, isHidden,
    fetchTribes, fetchMarkers, clearMarkers, createMarker, updateMarker, deleteMarker,
    toggleHideTribe, toggleHideType, showAllTribes, hideAllTribes,
  }
})
