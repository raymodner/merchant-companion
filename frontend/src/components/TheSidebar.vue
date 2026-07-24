<script setup>
import { computed } from 'vue'
import AppDropdown   from './AppDropdown.vue'
import ViewPanel     from './panels/ViewPanel.vue'
import EditPanel     from './panels/EditPanel.vue'
import { useAuthStore }   from '@/stores/auth.js'
import { useUiStore }     from '@/stores/ui.js'
import { useRegionStore } from '@/stores/region.js'

const authStore   = useAuthStore()
const uiStore     = useUiStore()
const regionStore = useRegionStore()

const countryOptions = computed(() => {
  const keys = Object.keys(regionStore.regions.countries).sort()
  const hasUS = Object.keys(regionStore.regions.states).length > 0
  const all   = hasUS ? ['United States', ...keys.filter(k => k !== 'United States')].sort() : keys
  return all.map(c => ({ value: c, label: c }))
})

const stateOptions = computed(() => {
  if (regionStore.currentCountry !== 'United States') return []
  return Object.keys(regionStore.regions.states).sort().map(s => ({ value: s, label: s }))
})

const showStateDropdown = computed(() => regionStore.currentCountry === 'United States')

async function onCountryChange(val) { await regionStore.setCountry(val) }
async function onStateChange(val)   { await regionStore.setState(val) }

async function handleLogout() { await authStore.logout() }
</script>

<template>
  <aside id="sidebar" :class="{ open: uiStore.sidebarOpen }">

    <div id="sidebar-header">
      <h1>Merchant Companion</h1>
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
        :options="[{ value: '', label: 'Select state…' }, ...stateOptions]"
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

    <div id="user-bar">
      <template v-if="authStore.user">
        <span id="username-display">{{ authStore.user.username }}</span>
        <button id="logout-btn" @click="handleLogout">Log out</button>
      </template>
      <template v-else>
        <button id="login-btn" @click="uiStore.requireAuth()">Log In / Register</button>
      </template>
    </div>

  </aside>
</template>
