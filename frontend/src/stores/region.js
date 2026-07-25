import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { api } from '@/api/index.js'

function slugify(s) { return s.toLowerCase().replace(/\s+/g, '-') }

export const useRegionStore = defineStore('region', () => {
  const regions = ref({ countries: {}, states: {} })
  const currentCountry = ref(localStorage.getItem('selected-country') || 'Netherlands')
  const currentState = ref(localStorage.getItem('selected-state') || null)

  const regionKey = computed(() => {
    if (currentCountry.value === 'United States' && currentState.value) {
      return 'us-' + slugify(currentState.value)
    }
    return slugify(currentCountry.value)
  })

  const currentBounds = computed(() => {
    if (currentCountry.value === 'United States') {
      if (!currentState.value) return null
      return regions.value.states[currentState.value] || null
    }
    return regions.value.countries[currentCountry.value] || null
  })

  const currentRegionId = computed(() => currentBounds.value?.id ?? null)

  async function fetchRegions() {
    const data = await api.getRegions()
    regions.value = { countries: data.countries || {}, states: data.states || {} }
  }

  async function setCountry(v) {
    currentCountry.value = v
    localStorage.setItem('selected-country', v)
    if (v !== 'United States') {
      currentState.value = null
      localStorage.removeItem('selected-state')
    }
    // Save preferences silently — fails quietly if not logged in
    api.savePreferences(v, currentState.value)
  }

  async function setState(v) {
    currentState.value = v || null
    if (v) localStorage.setItem('selected-state', v)
    else localStorage.removeItem('selected-state')
    api.savePreferences(currentCountry.value, v || null)
  }

  return {
    regions, currentCountry, currentState, regionKey, currentBounds, currentRegionId,
    fetchRegions, setCountry, setState,
  }
})
