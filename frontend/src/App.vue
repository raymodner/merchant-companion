<script setup>
import { ref, provide, watch, onMounted } from 'vue'
import TheMap          from './components/TheMap.vue'
import TheSidebar      from './components/TheSidebar.vue'
import CookieNotice    from './components/CookieNotice.vue'
import AuthModal       from './components/modals/AuthModal.vue'
import ResourceModal   from './components/modals/ResourceModal.vue'
import TribeEditModal        from './components/modals/TribeEditModal.vue'
import SettleEditModal       from './components/modals/SettleEditModal.vue'
import ChangePasswordModal   from './components/modals/ChangePasswordModal.vue'

import { useConfigStore }      from '@/stores/config.js'
import { useAuthStore }        from '@/stores/auth.js'
import { useRegionStore }      from '@/stores/region.js'
import { usePaintStore }       from '@/stores/paint.js'
import { useTribesStore }      from '@/stores/tribes.js'
import { useSettlementsStore } from '@/stores/settlements.js'
import { useResourcesStore }   from '@/stores/resources.js'
import { useUiStore }          from '@/stores/ui.js'

const configStore      = useConfigStore()
const authStore        = useAuthStore()
const regionStore      = useRegionStore()
const paintStore       = usePaintStore()
const tribesStore      = useTribesStore()
const settlementsStore = useSettlementsStore()
const resourcesStore   = useResourcesStore()
const uiStore          = useUiStore()

const mapRef = ref(null)
provide('mapRef', mapRef)

onMounted(async () => {
  await Promise.all([
    configStore.fetchConfig(),
    paintStore.fetchTerrains(),
    regionStore.fetchRegions(),
    tribesStore.fetchTribes(),
    settlementsStore.fetchStages(),
    resourcesStore.fetchResources(),
  ])
  await authStore.fetchMe()
  await mapRef.value?.initRegionFromLocation()
})

watch(() => authStore.user, async (newUser, oldUser) => {
  if ((newUser == null) !== (oldUser == null)) {
    const regionId = regionStore.currentRegionId
    if (regionId) await Promise.all([
      tribesStore.fetchMarkers(regionId),
      settlementsStore.fetchSettlements(regionId),
    ])
  }
})
</script>

<template>
  <div id="app-root">
    <TheMap ref="mapRef" />

    <button id="menu-btn" @click="uiStore.toggleSidebar()" aria-label="Toggle sidebar">☰</button>

    <div v-if="uiStore.sidebarOpen" id="sidebar-backdrop" @click="uiStore.closeSidebar()"></div>

    <TheSidebar />

    <div v-if="uiStore.placementMode" id="settle-placement-bar">
      <span>{{ uiStore.placementText }}</span>
      <button id="settle-cancel-place" @click="uiStore.cancelPlacement()">✕ Cancel</button>
    </div>

    <AuthModal             v-if="uiStore.authModalOpen" />
    <ChangePasswordModal   v-if="uiStore.changePasswordModalOpen" />
    <ResourceModal         v-if="resourcesStore.isOpen" />
    <TribeEditModal  />
    <SettleEditModal />
    <CookieNotice />
  </div>
</template>
