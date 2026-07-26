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
  const showOwnOnly  = ref(localStorage.getItem('filter-own-only')   === 'true')
  const showPublic   = ref(localStorage.getItem('filter-show-public') !== 'false')

  watch(hiddenStages,   v => localStorage.setItem('filter-hidden-stages',   JSON.stringify(v)), { deep: true })
  watch(hiddenProducts, v => localStorage.setItem('filter-hidden-products', JSON.stringify(v)), { deep: true })
  watch(showOwnOnly,    v => localStorage.setItem('filter-own-only',        String(v)))
  watch(showPublic,     v => localStorage.setItem('filter-show-public',     String(v)))

  // Placement state
  const settlePlaceMode = ref(false)
  const stageId = ref(null)
  const resourceType = ref('')
  const isPublic = ref(false)

  // Edit modal state
  const editingId = ref(null)

  function isHidden(s) {
    if (hiddenStages.value.includes(s.stage_id)) return true
    if (s.resource_type && hiddenProducts.value.includes(s.resource_type)) return true
    if (showOwnOnly.value && !s.is_own) return true
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
    const result = await api.createSettlement(data)
    if (!result) return null
    playerSettlements.value[result.id] = result
    return result.id
  }

  async function updateSettlement(id, updateData) {
    const { ok, data: resp } = await api.updateSettlement(id, updateData)
    if (!ok) return resp.error || 'Failed to update'
    const existing = playerSettlements.value[id]
    if (existing) {
      const freshData = await api.getSettlements(existing.region_id)
      for (const s of (freshData.settlements || [])) {
        playerSettlements.value[s.id] = s
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
    showOwnOnly.value = false
    showPublic.value  = true
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
    STAGES, playerSettlements, hiddenStages, hiddenProducts, showOwnOnly, showPublic,
    settlePlaceMode, stageId, resourceType, isPublic, editingId,
    visibleSettlements, isHidden,
    fetchStages, fetchSettlements, clearSettlements,
    createSettlement, updateSettlement, deleteSettlement,
    toggleHideStage, toggleHideProduct, showAllSettlements, hideAllSettlements,
  }
})
