<script setup>
import { ref } from 'vue'
import { useAuthStore } from '@/stores/auth.js'
import { useUiStore }   from '@/stores/ui.js'

const authStore = useAuthStore()
const uiStore   = useUiStore()

const tab      = ref('login')
const username = ref('')
const email    = ref('')
const password = ref('')
const error    = ref('')
const loading  = ref(false)

function reset() {
  username.value = ''
  email.value    = ''
  password.value = ''
  error.value    = ''
}

function close() {
  uiStore.authModalOpen = false
  reset()
}

async function submit() {
  error.value   = ''
  loading.value = true
  try {
    let result
    if (tab.value === 'login') {
      result = await authStore.login(email.value.trim(), password.value)
    } else {
      result = await authStore.register(username.value.trim(), email.value.trim(), password.value)
    }
    if (result.ok) close()
    else error.value = result.error || 'Something went wrong'
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
        <div id="auth-logo">Merchant Companion</div>

        <div id="auth-tabs">
          <button
            class="auth-tab"
            :class="{ active: tab === 'login' }"
            @click="tab = 'login'; error = ''"
          >Log In</button>
          <span class="auth-tab-sep">|</span>
          <button
            class="auth-tab"
            :class="{ active: tab === 'register' }"
            @click="tab = 'register'; error = ''"
          >Register</button>
        </div>

        <form class="auth-form" @submit.prevent="submit">
          <input
            v-if="tab === 'register'"
            v-model="username"
            type="text"
            class="auth-input"
            required
            autocomplete="username"
            placeholder="Username"
          />
          <input
            v-model="email"
            type="email"
            class="auth-input"
            required
            autocomplete="email"
            placeholder="Email"
          />
          <input
            v-model="password"
            type="password"
            class="auth-input"
            required
            autocomplete="current-password"
            placeholder="Password"
          />

          <div id="auth-error">{{ error }}</div>

          <button type="submit" class="auth-submit" :disabled="loading">
            {{ loading ? '…' : (tab === 'login' ? 'Log In' : 'Create Account') }}
          </button>
        </form>
      </div>
    </div>
  </Teleport>
</template>
