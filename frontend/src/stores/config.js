import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useConfigStore = defineStore('config', () => {
  const maxTribeMarkers      = ref(50)
  const maxSettlements       = ref(50)
  const maxPublicSettlements = ref(10)
  const starEditing          = ref(true)
  const contact              = ref({ name: '', discord: '' })

  async function fetchConfig() {
    try {
      const res  = await fetch('/api/config')
      if (!res.ok) return
      const data = await res.json()
      maxTribeMarkers.value      = data.maxTribeMarkers
      maxSettlements.value       = data.maxSettlements
      maxPublicSettlements.value = data.maxPublicSettlements
      starEditing.value          = data.starEditing
      contact.value              = data.contact
    } catch { /* keep defaults */ }
  }

  return { maxTribeMarkers, maxSettlements, maxPublicSettlements, starEditing, contact, fetchConfig }
})
