import { defineStore } from 'pinia'
import { ref, computed, watch } from 'vue'
import { api } from '@/api/index.js'

export const useResourcesStore = defineStore('resources', () => {
  const resourceData = ref([])

  // Modal state — filters persisted in localStorage
  const isOpen = ref(false)
  const minStars = ref(parseInt(localStorage.getItem('res-minStars') || '0'))
  const resType = ref(localStorage.getItem('res-type') || '')
  const resName = ref(localStorage.getItem('res-name') || '')
  const resTerrain = ref(localStorage.getItem('res-terrain') || '')
  const product = ref('')
  const editMode = ref(false)
  const filtersOpen = ref(false)

  watch(minStars, v => localStorage.setItem('res-minStars', String(v)))
  watch(resType, v => v ? localStorage.setItem('res-type', v) : localStorage.removeItem('res-type'))
  watch(resName, v => v ? localStorage.setItem('res-name', v) : localStorage.removeItem('res-name'))
  watch(resTerrain, v => v ? localStorage.setItem('res-terrain', v) : localStorage.removeItem('res-terrain'))

  const resourceTypes = computed(() => [...new Set(resourceData.value.map(r => r.type))].sort())

  // Same filtering logic as original renderResources()
  const filteredResources = computed(() => {
    const minS = minStars.value
    const productText = product.value.trim().toLowerCase()

    let entries
    if (productText) {
      entries = resourceData.value.filter(r => {
        if (r.name.toLowerCase().includes(productText)) return true
        if (!r.chain) return false
        const proc = (r.chain.processed || '').toLowerCase()
        const f1 = (r.chain.final1?.name || '').toLowerCase()
        const f2 = (r.chain.final2?.name || '').toLowerCase()
        return proc.includes(productText) || f1.includes(productText) || f2.includes(productText)
      })
    } else {
      entries = resourceData.value.filter(r =>
        (!resType.value || r.type === resType.value) &&
        (!resName.value || r.name === resName.value)
      )
    }

    const result = []
    for (const r of entries) {
      const byTerrain = {}
      for (const loc of r.locations) {
        if (resTerrain.value && loc.terrain !== resTerrain.value) continue
        if (!byTerrain[loc.terrain]) byTerrain[loc.terrain] = []
        byTerrain[loc.terrain].push(loc)
      }

      const matchedTerrains = []
      for (const [terrain, locs] of Object.entries(byTerrain)) {
        const filtered = locs.filter(l => l.stars === 0 || l.stars >= minS)
        if (filtered.length) matchedTerrains.push({ terrain, locs: filtered })
      }

      if (!matchedTerrains.length && !productText) continue
      result.push({ ...r, matchedTerrains })
    }

    return result
  })

  // Resource name options for the current type filter
  const resourceNameOptions = computed(() => {
    const names = resourceData.value
      .filter(r => !resType.value || r.type === resType.value)
      .slice()
      .sort((a, b) => a.name.localeCompare(b.name))
      .map(r => ({ value: r.name, label: `${r.icon} ${r.name}` }))
    return [{ value: '', label: 'All Resources' }, ...names]
  })

  async function fetchResources() {
    const data = await api.getResources()
    resourceData.value = data.resources || []
  }

  async function patchStar(locId, stars) {
    const ok = await api.patchResourceLocation(locId, stars)
    if (!ok) return
    // Update local data reactively
    for (const r of resourceData.value) {
      const loc = r.locations.find(l => l.id === locId)
      if (loc) { loc.stars = stars; break }
    }
  }

  function closeModal() {
    isOpen.value = false
    if (editMode.value) editMode.value = false
  }

  return {
    resourceData, isOpen, minStars, resType, resName, resTerrain, product, editMode, filtersOpen,
    resourceTypes, filteredResources, resourceNameOptions,
    fetchResources, patchStar, closeModal,
  }
})
