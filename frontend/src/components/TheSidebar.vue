<script setup>
import { ref, computed } from 'vue'
import AppDropdown   from './AppDropdown.vue'
import ViewPanel     from './panels/ViewPanel.vue'
import EditPanel     from './panels/EditPanel.vue'
import { useAuthStore }   from '@/stores/auth.js'
import { useUiStore }     from '@/stores/ui.js'
import { useRegionStore } from '@/stores/region.js'

const authStore   = useAuthStore()
const uiStore     = useUiStore()
const regionStore = useRegionStore()

const countryOptions = computed(() =>
  Object.keys(regionStore.regions.countries).sort().map(c => ({ value: c, label: c }))
)

const stateOptions = computed(() =>
  Object.keys(regionStore.currentSubregions).sort().map(s => ({ value: s, label: s }))
)

const showStateDropdown = computed(() => regionStore.hasSubregions)

async function onCountryChange(val) { await regionStore.setCountry(val) }
async function onStateChange(val)   { await regionStore.setState(val) }

async function handleLogout() { await authStore.logout() }

const isDark = ref(document.documentElement.dataset.theme !== 'light')

function toggleTheme() {
  const next = isDark.value ? 'light' : 'dark'
  document.documentElement.dataset.theme = next
  localStorage.setItem('color-theme', next)
  isDark.value = next === 'dark'
  const tc = document.querySelector('meta[name="theme-color"]')
  if (tc) tc.content = next === 'light' ? '#f5ead0' : '#0d0702'
}
</script>

<template>
  <aside id="sidebar" :class="{ open: uiStore.sidebarOpen }">

    <div id="sidebar-header">
      <h1>Merchant Companion</h1>
      <div id="sidebar-top-bar">
        <template v-if="authStore.user">
          <span id="username-display">{{ authStore.user.username }}</span>
          <div id="user-actions">
            <button id="change-pw-btn" @click="uiStore.changePasswordModalOpen = true">Password</button>
            <button id="logout-btn" @click="handleLogout">Log out</button>
            <button class="theme-toggle-btn" :title="isDark ? 'Switch to light mode' : 'Switch to dark mode'" @click="toggleTheme">{{ isDark ? '☀' : '☾' }}</button>
          </div>
        </template>
        <template v-else>
          <button id="login-btn" @click="uiStore.requireAuth()">Log In / Register</button>
          <button class="theme-toggle-btn" :title="isDark ? 'Switch to light mode' : 'Switch to dark mode'" @click="toggleTheme">{{ isDark ? '☀' : '☾' }}</button>
        </template>
      </div>
    </div>

    <div id="country-select-wrap">
      <AppDropdown
        :options="countryOptions"
        :model-value="regionStore.currentCountry"
        cls="sidebar"
        @update:model-value="onCountryChange"
      />
    </div>
    <div v-if="showStateDropdown" id="state-select-wrap">
      <AppDropdown
        :options="[{ value: '', label: 'Select region…' }, ...stateOptions]"
        :model-value="regionStore.currentState || ''"
        cls="sidebar"
        @update:model-value="val => onStateChange(val || null)"
      />
    </div>

    <div id="mode-tabs">
      <button
        class="mode-tab"
        :class="{ active: uiStore.mode === 'view' }"
        @click="uiStore.setMode('view')"
      >👁 View</button>
      <button
        class="mode-tab"
        :class="{ active: uiStore.mode === 'edit' }"
        @click="uiStore.setMode('edit')"
      >✏ Edit</button>
    </div>

    <ViewPanel v-if="uiStore.mode === 'view'" />
    <EditPanel v-else />


  </aside>
</template>
