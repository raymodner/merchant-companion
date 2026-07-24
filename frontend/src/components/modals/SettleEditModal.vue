<script setup>
import { ref, computed, watch } from 'vue'
import { useSettlementsStore } from '@/stores/settlements.js'

const settlementsStore = useSettlementsStore()

const stageId      = ref(null)
const resourceType = ref('')
const name         = ref('')
const isPublic     = ref(false)
const error        = ref('')
const loading      = ref(false)

const editingSettlement = computed(() =>
  settlementsStore.editingId
    ? settlementsStore.playerSettlements[settlementsStore.editingId]
    : null
)

watch(() => settlementsStore.editingId, (id) => {
  if (!id) return
  const s = settlementsStore.playerSettlements[id]
  if (s) {
    stageId.value      = s.stage_id
    resourceType.value = s.resource_type || ''
    name.value         = s.name || ''
    isPublic.value     = !!s.is_public
  }
  error.value = ''
})

function close() {
  settlementsStore.editingId = null
  error.value = ''
}

async function submit() {
  if (!settlementsStore.editingId) return
  loading.value = true
  error.value   = ''
  try {
    const err = await settlementsStore.updateSettlement(settlementsStore.editingId, {
      stage_id:      stageId.value,
      resource_type: resourceType.value.trim() || null,
      name:          name.value.trim() || null,
      is_public:     isPublic.value,
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
    <div v-if="settlementsStore.editingId" id="settle-edit-overlay" @click.self="close">
      <div id="settle-edit-modal">
        <button id="settle-edit-close" @click="close">✕</button>

        <div class="settle-modal-title">✎ Edit Settlement</div>

        <form @submit.prevent="submit">
          <div class="settle-field">
            <span class="settle-label">Stage</span>
            <select v-model="stageId" class="auth-input" style="flex:1">
              <option v-for="s in settlementsStore.STAGES" :key="s.id" :value="s.id">
                {{ s.icon }} {{ s.name }} (tier {{ s.tier }})
              </option>
            </select>
          </div>

          <div class="settle-field">
            <span class="settle-label">Type</span>
            <input
              v-model="resourceType"
              type="text"
              class="auth-input"
              style="flex:1"
              placeholder="e.g. Iron Ore"
            />
          </div>

          <div class="settle-field">
            <span class="settle-label">Name</span>
            <input
              v-model="name"
              type="text"
              class="auth-input"
              style="flex:1"
              placeholder="Custom name"
            />
          </div>

          <div class="settle-field">
            <label style="display:flex;align-items:center;gap:6px;font-family:'Crimson Text',serif;font-size:14px;color:#d4b87a;cursor:pointer">
              <input type="checkbox" v-model="isPublic" />
              Public (visible to all)
            </label>
          </div>

          <div id="settle-edit-error">{{ error }}</div>

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
