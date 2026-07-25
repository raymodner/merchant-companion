<script setup>
import { ref, computed, watch } from 'vue'
import { useTribesStore } from '@/stores/tribes.js'
import { TRIBE_TYPE_ICONS } from '@/utils.js'

const tribesStore = useTribesStore()
const tribeTypes  = ['Camp', 'Selo', 'Burgh']

const selectedTribeId = ref(null)
const selectedType    = ref('Camp')
const error           = ref('')
const loading         = ref(false)

const editingMarker = computed(() =>
  tribesStore.editingId ? tribesStore.markers[tribesStore.editingId] : null
)

watch(() => tribesStore.editingId, (id) => {
  if (!id) return
  const m = tribesStore.markers[id]
  if (m) {
    selectedTribeId.value = m.tribe_id
    selectedType.value    = m.type
  }
  error.value = ''
})

function close() {
  tribesStore.editingId = null
  error.value = ''
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
                v-for="type in tribeTypes"
                :key="type"
                type="button"
                class="type-btn"
                :class="{ active: selectedType === type }"
                @click="selectedType = type"
              >{{ TRIBE_TYPE_ICONS[type] }} {{ type }}</button>
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
