import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { api } from '@/api/index.js'
import { useAuthStore } from './auth.js'

export const useSettlementsStore = defineStore('settlements', () => {
  const authStore = useAuthStore()

  const STAGES = ref([])
  const playerSettlements = ref({})  // id (string) → plain data object
  const hiddenStages = ref([])       // number[]
  const hiddenProducts = ref([])     // string[] (resource_type values)
  const showOwnOnly = ref(false)

  // Placement state
  const settlePlaceMode = ref(false)
  const stageId = ref(null)
  const resourceType = ref('')
  const isPublic = ref(false)

  // Edit modal state
  const editingId = ref(null)  // string id or null

  function isHidden(s) {
    if (hiddenStages.value.includes(parseInt(s.stage_id))) return true
    if (s.resource_type && hiddenProducts.value.includes(s.resource_type)) return true
    if (showOwnOnly.value && !(authStore.user && authStore.user.id === parseInt(s.user_id))) return true
    return false
  }

  const visibleSettlements = computed(() => Object.values(playerSettlements.value).filter(s => !isHidden(s)))

  async function fetchStages() {
    const data = await api.getStages()
    STAGES.value = data.stages || []
    if (STAGES.value.length && !stageId.value) stageId.value = STAGES.value[0].id
  }

  async function fetchSettlements(regionKey) {
    const data = await api.getSettlements(regionKey)
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
    const id = result.id
    // Fetch fresh to get joined data (stage_name, stage_icon, tier, username)
    const freshData = await api.getSettlements(data.region_key)
    const s = (freshData.settlements || []).find(x => x.id === id)
    if (s) playerSettlements.value[s.id] = s
    return id
  }

  async function updateSettlement(id, updateData) {
    const { ok, data: resp } = await api.updateSettlement(id, updateData)
    if (!ok) return resp.error || 'Failed to update'
    // Refresh from API — need region_key from existing record
    const existing = playerSettlements.value[id]
    if (existing) {
      const freshData = await api.getSettlements(existing.region_key)
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
    const intId = parseInt(id)
    const idx = hiddenStages.value.indexOf(intId)
    if (idx > -1) hiddenStages.value.splice(idx, 1)
    else hiddenStages.value.push(intId)
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
  }

  function hideAllSettlements() {
    const allIds = STAGES.value.map(s => parseInt(s.id))
    hiddenStages.value.splice(0, hiddenStages.value.length, ...allIds)
  }

  return {
    STAGES, playerSettlements, hiddenStages, hiddenProducts, showOwnOnly,
    settlePlaceMode, stageId, resourceType, isPublic, editingId,
    visibleSettlements, isHidden,
    fetchStages, fetchSettlements, clearSettlements,
    createSettlement, updateSettlement, deleteSettlement,
    toggleHideStage, toggleHideProduct, showAllSettlements, hideAllSettlements,
  }
})
