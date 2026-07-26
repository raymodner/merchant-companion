import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { api } from '@/api/index.js'

function slugify(s) { return s.toLowerCase().replace(/\s+/g, '-') }

export const useRegionStore = defineStore('region', () => {
  const regions = ref({ countries: {}, subregions: {} })
  const currentCountry = ref(localStorage.getItem('selected-country') || 'Netherlands')
  const currentState = ref(localStorage.getItem('selected-state') || null)

  const currentSubregions = computed(() => regions.value.subregions[currentCountry.value] || {})

  const hasSubregions = computed(() => Object.keys(currentSubregions.value).length > 0)

  const regionKey = computed(() => {
    if (hasSubregions.value && currentState.value) {
      return slugify(currentCountry.value) + '-' + slugify(currentState.value)
    }
    return slugify(currentCountry.value)
  })

  const currentBounds = computed(() => {
    if (hasSubregions.value) {
      if (!currentState.value) return null
      return currentSubregions.value[currentState.value] || null
    }
    return regions.value.countries[currentCountry.value] || null
  })

  const currentRegionId = computed(() => currentBounds.value?.id ?? null)

  async function fetchRegions() {
    const data = await api.getRegions()
    regions.value = { countries: data.countries || {}, subregions: data.subregions || {} }
  }

  async function setCountry(v) {
    currentCountry.value = v
    localStorage.setItem('selected-country', v)
    currentState.value = null
    localStorage.removeItem('selected-state')
    api.savePreferences(v, null)
  }

  async function setState(v) {
    currentState.value = v || null
    if (v) localStorage.setItem('selected-state', v)
    else localStorage.removeItem('selected-state')
    api.savePreferences(currentCountry.value, v || null)
  }

  return {
    regions, currentCountry, currentState, currentSubregions, hasSubregions,
    regionKey, currentBounds, currentRegionId,
    fetchRegions, setCountry, setState,
  }
})
