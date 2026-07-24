import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useUiStore = defineStore('ui', () => {
  const sidebarOpen = ref(false)
  const mode = ref('view')           // 'view' | 'edit'
  const markerTab = ref('tribe')     // 'tribe' | 'settle'
  const authModalOpen = ref(false)
  const placementMode = ref(null)    // null | 'tribe' | 'settle'
  const placementText = ref('')

  function setMode(m) { mode.value = m }
  function openSidebar() { sidebarOpen.value = true }
  function closeSidebar() { sidebarOpen.value = false }
  function toggleSidebar() { sidebarOpen.value = !sidebarOpen.value }
  function requireAuth() { authModalOpen.value = true }

  function startPlacement(type, text) {
    placementMode.value = type
    placementText.value = text
  }

  function cancelPlacement() {
    placementMode.value = null
    placementText.value = ''
  }

  return {
    sidebarOpen, mode, markerTab, authModalOpen, placementMode, placementText,
    setMode, openSidebar, closeSidebar, toggleSidebar, requireAuth, startPlacement, cancelPlacement,
  }
})
