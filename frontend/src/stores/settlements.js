import { defineStore } from 'pinia'
import { ref, computed, watch } from 'vue'
import { api } from '@/api/index.js'

function loadArr(key) {
  try { return JSON.parse(localStorage.getItem(key) || '[]') } catch { return [] }
}

export const useSettlementsStore = defineStore('settlements', () => {
  const STAGES = ref([])
  const playerSettlements = ref({})  // id (string) → plain data object
  const hiddenStages   = ref(loadArr('filter-hidden-stages'))
  const hiddenProducts = ref(loadArr('filter-hidden-products'))
  const showPublic   = ref(localStorage.getItem('filter-show-public') !== 'false')

  watch(hiddenStages,   v => localStorage.setItem('filter-hidden-stages',   JSON.stringify(v)), { deep: true })
  watch(hiddenProducts, v => localStorage.setItem('filter-hidden-products', JSON.stringify(v)), { deep: true })
  watch(showPublic,     v => localStorage.setItem('filter-show-public',     String(v)))

  // Placement state
  const settlePlaceMode = ref(false)
  const stageId = ref(null)
  const resourceType = ref('')
  const isPublic = ref(false)

  // Edit / relocate modal state
  const editingId      = ref(null)
  const relocatingId   = ref(null)
  const relocatingData = ref(null)   // pending non-location field edits to commit together with the move

  function isHidden(s) {
    if (hiddenStages.value.includes(s.stage_id)) return true
    if (s.resource_type && hiddenProducts.value.includes(s.resource_type)) return true
    if (!showPublic.value && s.is_public && !s.is_own) return true
    return false
  }

  const visibleSettlements = computed(() => Object.values(playerSettlements.value).filter(s => !isHidden(s)))

  async function fetchStages() {
    const data = await api.getStages()
    STAGES.value = data.stages || []
    if (STAGES.value.length && !stageId.value) stageId.value = STAGES.value[0].id
  }

  async function fetchSettlements(regionId) {
    const data = await api.getSettlements(regionId)
    clearSettlements()
    for (const s of (data.settlements || [])) {
      playerSettlements.value[s.id] = s
    }
  }

  function clearSettlements() {
    Object.keys(playerSettlements.value).forEach(k => delete playerSettlements.value[k])
  }

  async function createSettlement(data) {
    const { ok, data: resp } = await api.createSettlement(data)
    if (!ok) return { id: null, error: resp.error || 'Failed to place settlement' }
    playerSettlements.value[resp.id] = resp
    return { id: resp.id, error: null }
  }

  async function updateSettlement(id, updateData) {
    const { ok, data: resp } = await api.updateSettlement(id, updateData)
    if (!ok) return resp.error || 'Failed to update'
    // Update local data reactively — mirrors tribes.js's updateMarker
    const existing = playerSettlements.value[id]
    if (existing) {
      const stageId = updateData.stage_id !== undefined ? updateData.stage_id : existing.stage_id
      const stage = STAGES.value.find(s => s.id === stageId)
      playerSettlements.value[id] = {
        ...existing,
        lat: updateData.lat !== undefined ? updateData.lat : existing.lat,
        lng: updateData.lng !== undefined ? updateData.lng : existing.lng,
        name: updateData.name !== undefined ? updateData.name : existing.name,
        resource_type: updateData.resource_type !== undefined ? updateData.resource_type : existing.resource_type,
        is_public: updateData.is_public !== undefined ? updateData.is_public : existing.is_public,
        stage_id: stageId,
        stage_name: stage?.name ?? existing.stage_name,
        tier: stage?.tier ?? existing.tier,
        stage_icon: stage?.icon ?? existing.stage_icon,
      }
    }
    return null
  }

  async function deleteSettlement(id) {
    const ok = await api.deleteSettlement(id)
    if (ok) delete playerSettlements.value[id]
  }

  function toggleHideStage(id) {
    const idx = hiddenStages.value.indexOf(id)
    if (idx > -1) hiddenStages.value.splice(idx, 1)
    else hiddenStages.value.push(id)
  }

  function toggleHideProduct(type) {
    const idx = hiddenProducts.value.indexOf(type)
    if (idx > -1) hiddenProducts.value.splice(idx, 1)
    else hiddenProducts.value.push(type)
  }

  function showAllSettlements() {
    hiddenStages.value.splice(0)
    hiddenProducts.value.splice(0)
    showPublic.value = true
  }

  // allProductTypes passed from ViewPanel so we can hide all known types, not just placed ones
  function hideAllSettlements(allProductTypes = []) {
    const allIds = STAGES.value.map(s => s.id)
    hiddenStages.value.splice(0, hiddenStages.value.length, ...allIds)
    const products = allProductTypes.length
      ? allProductTypes
      : [...new Set(Object.values(playerSettlements.value).map(s => s.resource_type).filter(Boolean))]
    hiddenProducts.value.splice(0, hiddenProducts.value.length, ...products)
  }

  return {
    STAGES, playerSettlements, hiddenStages, hiddenProducts, showPublic,
    settlePlaceMode, stageId, resourceType, isPublic, editingId, relocatingId, relocatingData,
    visibleSettlements, isHidden,
    fetchStages, fetchSettlements, clearSettlements,
    createSettlement, updateSettlement, deleteSettlement,
    toggleHideStage, toggleHideProduct, showAllSettlements, hideAllSettlements,
  }
})
