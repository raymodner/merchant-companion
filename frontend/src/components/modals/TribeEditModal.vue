<script setup>
import { ref, watch } from 'vue'
import { useTribesStore } from '@/stores/tribes.js'
import { useUiStore }     from '@/stores/ui.js'
import { tribeTypeIcon } from '@/utils.js'

const tribesStore = useTribesStore()
const uiStore     = useUiStore()

const selectedTribeId = ref(null)
const selectedType    = ref('Camp')
const error           = ref('')
const loading         = ref(false)

// Location move state
const locationUnlocked = ref(false)
const pendingLat       = ref(null)
const pendingLng       = ref(null)
const geoLoading       = ref(false)
const geoError         = ref('')

watch(() => tribesStore.editingId, (id) => {
  if (!id) return
  const m = tribesStore.markers[id]
  if (m) {
    selectedTribeId.value = m.tribe_id
    selectedType.value    = m.type
  }
  error.value            = ''
  locationUnlocked.value = false
  pendingLat.value       = null
  pendingLng.value       = null
  geoError.value         = ''
})

function close() {
  tribesStore.editingId  = null
  error.value            = ''
  locationUnlocked.value = false
  pendingLat.value       = null
  pendingLng.value       = null
  geoError.value         = ''
}

function useMyLocation() {
  if (!navigator.geolocation) { geoError.value = 'Geolocation not supported'; return }
  geoLoading.value = true
  geoError.value   = ''
  navigator.geolocation.getCurrentPosition(
    pos => {
      geoLoading.value = false
      pendingLat.value = pos.coords.latitude
      pendingLng.value = pos.coords.longitude
    },
    () => { geoLoading.value = false; geoError.value = 'Location access denied' },
    { timeout: 8000 }
  )
}

function startMapMove() {
  const id = tribesStore.editingId
  if (!selectedTribeId.value) { error.value = 'Please select a tribe'; return }
  // Field edits aren't sent yet — they're bundled with the lat/lng into one
  // PATCH once the move actually completes, so cancelling loses nothing.
  tribesStore.relocatingData = { tribe_id: selectedTribeId.value, type: selectedType.value }
  tribesStore.relocatingId   = id
  tribesStore.editingId      = null
  uiStore.startPlacement('relocate-tribe', 'Click map to move tribe marker')
}

async function submit() {
  if (!tribesStore.editingId) return
  if (!selectedTribeId.value) { error.value = 'Please select a tribe'; return }
  loading.value = true
  error.value   = ''
  try {
    const err = await tribesStore.updateMarker(tribesStore.editingId, {
      tribe_id: selectedTribeId.value,
      type: selectedType.value,
      ...(pendingLat.value != null && { lat: pendingLat.value, lng: pendingLng.value }),
    })
    if (err) error.value = err
    else close()
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <Teleport to="body">
    <div v-if="tribesStore.editingId" id="tribe-edit-overlay" @click.self="close">
      <div id="tribe-edit-modal">
        <button id="tribe-edit-close" @click="close">✕</button>

        <div class="settle-modal-title">✎ Edit Tribe Marker</div>

        <form @submit.prevent="submit">
          <div class="settle-field">
            <span class="settle-label">Tribe</span>
            <select v-model="selectedTribeId" class="auth-input" style="flex:1">
              <option v-for="t in tribesStore.TRIBES" :key="t.id" :value="t.id">
                {{ t.icon }} {{ t.name }}
              </option>
            </select>
          </div>

          <div class="settle-field" style="flex-direction:column;align-items:flex-start">
            <span class="settle-label">Type</span>
            <div class="type-btn-group" style="width:100%">
              <button
                v-for="type in tribesStore.TRIBE_TYPES"
                :key="type"
                type="button"
                class="type-btn"
                :class="{ active: selectedType === type }"
                @click="selectedType = type"
              >{{ tribeTypeIcon(type) }} {{ type }}</button>
            </div>
          </div>

          <div style="margin: 10px 0">
            <button type="button" class="location-lock-btn" @click="locationUnlocked = !locationUnlocked">
              {{ locationUnlocked ? '🔓' : '🔒' }} {{ locationUnlocked ? 'Move location' : 'Location locked' }}
            </button>
            <div v-if="locationUnlocked" class="location-actions">
              <div style="display:flex;gap:6px">
                <button type="button" class="place-alt-btn" style="flex:1" :disabled="geoLoading" @click="useMyLocation">
                  {{ geoLoading ? '…' : '📍' }} My location
                </button>
                <button type="button" class="place-alt-btn" style="flex:1" :disabled="loading" @click="startMapMove">
                  🗺 Move on map
                </button>
              </div>
              <div v-if="pendingLat !== null" class="location-pending">✓ Location captured</div>
              <div v-if="geoError" class="place-error">{{ geoError }}</div>
            </div>
          </div>

          <div id="settle-edit-error" style="color:#d45a3a;font-size:13px;min-height:18px;margin:8px 0 0">{{ error }}</div>

          <div class="settle-modal-btns">
            <button type="button" class="auth-submit settle-secondary-btn" @click="close">Cancel</button>
            <button type="submit" class="auth-submit" :disabled="loading">
              {{ loading ? '…' : 'Save' }}
            </button>
          </div>
        </form>
      </div>
    </div>
  </Teleport>
</template>
