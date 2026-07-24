import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { api } from '@/api/index.js'
import { useAuthStore } from './auth.js'

export const useTribesStore = defineStore('tribes', () => {
  const TRIBES = ref([])
  const markers = ref({})            // id (string) → plain data object
  const hiddenTribes = ref([])       // number[]
  const hiddenTribeTypes = ref([])   // string[] ('Camp'|'Selo'|'Burgh')

  const tribePlaceMode = ref(false)
  const activeTribeId = ref(null)
  const activeTribeType = ref('Camp')
  const editingId = ref(null)        // string id of marker being edited, or null

  function isHidden(m) {
    return hiddenTribes.value.includes(parseInt(m.tribe_id)) || hiddenTribeTypes.value.includes(m.type)
  }

  const visibleMarkers = computed(() => Object.values(markers.value).filter(m => !isHidden(m)))

  async function fetchTribes() {
    const data = await api.getTribes()
    TRIBES.value = data.tribes || []
    if (TRIBES.value.length) activeTribeId.value = TRIBES.value[0].id
  }

  async function fetchMarkers(regionKey) {
    const authStore = useAuthStore()
    if (!authStore.user) {
      clearMarkers()
      return
    }
    const data = await api.getTribeMarkers(regionKey)
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
    const id = result.id
    // Fetch fresh to get joined data (tribe_name, tribe_color, tribe_icon, username)
    const freshData = await api.getTribeMarkers(data.region_key)
    const m = (freshData.markers || []).find(x => x.id === id)
    if (m) markers.value[m.id] = m
    return id
  }

  async function updateMarker(id, data) {
    const { ok, data: resp } = await api.updateTribeMarker(id, data)
    if (!ok) return resp.error || 'Failed to update'
    // Update local data with tribe info from TRIBES list
    const existing = markers.value[id]
    if (existing) {
      const tribeId = parseInt(data.tribe_id) || existing.tribe_id
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
    const intId = parseInt(id)
    const idx = hiddenTribes.value.indexOf(intId)
    if (idx > -1) hiddenTribes.value.splice(idx, 1)
    else hiddenTribes.value.push(intId)
  }

  function toggleHideType(type) {
    const idx = hiddenTribeTypes.value.indexOf(type)
    if (idx > -1) hiddenTribeTypes.value.splice(idx, 1)
    else hiddenTribeTypes.value.push(type)
  }

  return {
    TRIBES, markers, hiddenTribes, hiddenTribeTypes,
    tribePlaceMode, activeTribeId, activeTribeType, editingId,
    visibleMarkers, isHidden,
    fetchTribes, fetchMarkers, clearMarkers, createMarker, updateMarker, deleteMarker,
    toggleHideTribe, toggleHideType,
  }
})
