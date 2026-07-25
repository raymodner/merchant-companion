import { defineStore } from 'pinia'
import { ref, watch } from 'vue'
import { api } from '@/api/index.js'

function loadArr(key) {
  try { return JSON.parse(localStorage.getItem(key) || '[]') } catch { return [] }
}

export const usePaintStore = defineStore('paint', () => {
  const TERRAINS = ref({})           // name → { color, icon }
  const paintMode = ref(false)
  const activeTerrain = ref(null)    // null = eraser
  const hiddenTerrains = ref(loadArr('filter-terrains'))
  const cellState = ref({})          // cellKey → terrainKey

  watch(hiddenTerrains, v => localStorage.setItem('filter-terrains', JSON.stringify(v)), { deep: true })

  async function fetchTerrains() {
    const data = await api.getTerrains()
    const obj = {}
    for (const t of (data.terrains || [])) obj[t.name] = { color: t.color, icon: t.icon }
    TERRAINS.value = obj
  }

  function selectTerrain(key) {
    activeTerrain.value = key
    paintMode.value = true
  }

  function setPaintMode(on) {
    paintMode.value = on
  }

  function toggleFilter(key) {
    const idx = hiddenTerrains.value.indexOf(key)
    if (idx > -1) hiddenTerrains.value.splice(idx, 1)
    else hiddenTerrains.value.push(key)
  }

  function showAll() {
    hiddenTerrains.value = []
  }

  function hideAll() {
    hiddenTerrains.value = Object.keys(TERRAINS.value)
  }

  function setCellState(data) {
    cellState.value = data
  }

  function setCellKey(key, terrain) {
    if (terrain) cellState.value[key] = terrain
    else delete cellState.value[key]
  }

  return {
    TERRAINS, paintMode, activeTerrain, hiddenTerrains, cellState,
    fetchTerrains, selectTerrain, setPaintMode, toggleFilter, showAll, hideAll,
    setCellState, setCellKey,
  }
})
