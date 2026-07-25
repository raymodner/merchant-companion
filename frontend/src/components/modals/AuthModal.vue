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

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

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

function validate() {
  const e = email.value.trim()
  const p = password.value
  if (tab.value === 'login') {
    if (!e)              return 'Email is required'
    if (!EMAIL_RE.test(e)) return 'Invalid email address'
    if (!p)              return 'Password is required'
  } else {
    const u = username.value.trim()
    if (!u)                        return 'Username is required'
    if (u.length < 3)              return 'Username must be at least 3 characters'
    if (u.length > 50)             return 'Username must be 50 characters or fewer'
    if (!/^[\w\-]+$/.test(u))     return 'Username may only contain letters, numbers, _ and -'
    if (!e)                        return 'Email is required'
    if (!EMAIL_RE.test(e))         return 'Invalid email address'
    if (!p)                        return 'Password is required'
    if (p.length < 8)              return 'Password must be at least 8 characters'
  }
  return null
}

async function submit() {
  const validationError = validate()
  if (validationError) { error.value = validationError; return }
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
