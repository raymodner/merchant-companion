import { defineStore } from 'pinia'
import { ref } from 'vue'
import { api } from '@/api/index.js'
import { useRegionStore } from './region.js'

export const useAuthStore = defineStore('auth', () => {
  const user = ref(null)

  function applyServerPrefs(serverUser) {
    const regionStore = useRegionStore()
    const pref = serverUser.preferred_country
    if (pref && pref !== regionStore.currentCountry) {
      // Directly set refs to trigger regionKey computed change (TheMap watcher picks it up)
      regionStore.currentCountry = pref
      localStorage.setItem('selected-country', pref)
      const prefState = serverUser.preferred_state || null
      regionStore.currentState = prefState
      if (prefState) localStorage.setItem('selected-state', prefState)
      else localStorage.removeItem('selected-state')
    }
  }

  async function fetchMe() {
    const userData = await api.me()
    if (userData) {
      user.value = userData
      applyServerPrefs(userData)
    }
  }

  async function login(email, password) {
    const { ok, data } = await api.login(email, password)
    if (!ok) return { ok: false, error: data.error }
    user.value = data.user
    applyServerPrefs(data.user)
    return { ok: true }
  }

  async function register(username, email, password) {
    const { ok, data } = await api.register(username, email, password)
    if (!ok) return { ok: false, error: data.error }
    user.value = data.user
    applyServerPrefs(data.user)
    return { ok: true }
  }

  async function logout() {
    await api.logout()
    user.value = null
  }

  return { user, fetchMe, login, register, logout }
})
