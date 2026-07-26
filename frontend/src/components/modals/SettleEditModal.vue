<script setup>
import { ref, computed, watch } from 'vue'
import AppDropdown from '@/components/AppDropdown.vue'
import { useSettlementsStore } from '@/stores/settlements.js'
import { useResourcesStore }   from '@/stores/resources.js'
import { typeIcon } from '@/utils.js'

const settlementsStore = useSettlementsStore()
const resourcesStore   = useResourcesStore()

const stageId      = ref(null)
const resourceType = ref('')
const name         = ref('')
const isPublic     = ref(false)
const error        = ref('')
const loading      = ref(false)

const stageOptions = computed(() =>
  settlementsStore.STAGES.map(s => ({ value: String(s.id), label: `${s.icon} ${s.name} (tier ${s.tier})` }))
)

const stageIdStr = computed({
  get: () => stageId.value ?? '',
  set: (v) => { stageId.value = v || null },
})

const resourceTypeOptions = computed(() => [
  { value: '', label: 'No product' },
  ...resourcesStore.resourceTypes.map(t => ({ value: t, label: `${typeIcon(t)} ${t}` })),
])

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
  if (!stageId.value) { error.value = 'Stage is required'; return }
  if (name.value.trim().length > 200) { error.value = 'Name must be 200 characters or fewer'; return }
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
            <div style="flex:1;min-width:0">
              <AppDropdown :options="stageOptions" v-model="stageIdStr" />
            </div>
          </div>

          <div class="settle-field">
            <span class="settle-label">Type</span>
            <div style="flex:1;min-width:0">
              <AppDropdown :options="resourceTypeOptions" v-model="resourceType" />
            </div>
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

          <div style="margin: 10px 0">
            <label class="mf-own-toggle">
              <input type="checkbox" v-model="isPublic" />
              <span class="mf-switch"></span>
              <span>Public (visible to all)</span>
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
