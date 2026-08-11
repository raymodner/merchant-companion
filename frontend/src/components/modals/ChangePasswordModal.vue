<script setup>
import { ref } from 'vue'
import { useUiStore } from '@/stores/ui.js'
import { api } from '@/api/index.js'

const uiStore = useUiStore()

const currentPassword = ref('')
const newPassword     = ref('')
const confirmPassword = ref('')
const error           = ref('')
const success         = ref(false)
const loading         = ref(false)

function close() {
  uiStore.changePasswordModalOpen = false
  currentPassword.value = ''
  newPassword.value     = ''
  confirmPassword.value = ''
  error.value   = ''
  success.value = false
}

async function submit() {
  error.value   = ''
  success.value = false

  if (!currentPassword.value) { error.value = 'Current password is required'; return }
  if (!newPassword.value)     { error.value = 'New password is required'; return }
  if (newPassword.value.length < 8)  { error.value = 'New password must be at least 8 characters'; return }
  if (newPassword.value.length > 72) { error.value = 'New password must be 72 characters or fewer'; return }
  if (newPassword.value !== confirmPassword.value) { error.value = 'Passwords do not match'; return }
  if (newPassword.value === currentPassword.value) { error.value = 'New password must differ from current password'; return }

  loading.value = true
  try {
    const { ok, data } = await api.changePassword(currentPassword.value, newPassword.value)
    if (!ok) { error.value = data.error || 'Something went wrong'; return }
    success.value = true
    currentPassword.value = ''
    newPassword.value     = ''
    confirmPassword.value = ''
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <Teleport to="body">
    <div id="auth-overlay" @click.self="close">
      <div id="auth-modal">
        <button id="modal-close" @click="close">✕</button>
        <div id="auth-logo">Change Password</div>

        <form class="auth-form" style="margin-top:20px" @submit.prevent="submit">
          <input
            v-model="currentPassword"
            type="password"
            class="auth-input"
            autocomplete="current-password"
            placeholder="Current password"
          />
          <input
            v-model="newPassword"
            type="password"
            class="auth-input"
            autocomplete="new-password"
            placeholder="New password"
          />
          <input
            v-model="confirmPassword"
            type="password"
            class="auth-input"
            autocomplete="new-password"
            placeholder="Confirm new password"
          />

          <div v-if="error" id="auth-error">{{ error }}</div>
          <div v-if="success" id="auth-error" style="color:#7ab87a">Password changed successfully.</div>

          <button type="submit" class="auth-submit" :disabled="loading || success">
            {{ loading ? '…' : 'Change Password' }}
          </button>
        </form>
      </div>
    </div>
  </Teleport>
</template>
