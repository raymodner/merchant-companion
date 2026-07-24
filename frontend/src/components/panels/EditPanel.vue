<script setup>
import { computed } from 'vue'
import AppDropdown from '@/components/AppDropdown.vue'
import { useAuthStore }        from '@/stores/auth.js'
import { useUiStore }          from '@/stores/ui.js'
import { usePaintStore }       from '@/stores/paint.js'
import { useTribesStore }      from '@/stores/tribes.js'
import { useSettlementsStore } from '@/stores/settlements.js'
import { useResourcesStore }   from '@/stores/resources.js'
import { TRIBE_TYPE_ICONS, typeIcon } from '@/utils.js'

const authStore        = useAuthStore()
const uiStore          = useUiStore()
const paintStore       = usePaintStore()
const tribesStore      = useTribesStore()
const settlementsStore = useSettlementsStore()
const resourcesStore   = useResourcesStore()

const tribeTypes  = ['Camp', 'Selo', 'Burgh']
const terrainKeys = computed(() => Object.keys(paintStore.TERRAINS))

const tribeOptions = computed(() =>
  tribesStore.TRIBES.map(t => ({ value: String(t.id), label: `${t.icon} ${t.name}` }))
)
const activeTribeIdStr = computed({
  get: () => tribesStore.activeTribeId !== null ? String(tribesStore.activeTribeId) : '',
  set: (v) => { tribesStore.activeTribeId = v ? parseInt(v) : null }
})

const resourceTypeOptions = computed(() => [
  { value: '', label: 'Any product' },
  ...resourcesStore.resourceTypes.map(t => ({ value: t, label: `${typeIcon(t)} ${t}` }))
])

function startTribePlacement() {
  if (!authStore.user) { uiStore.requireAuth(); return }
  const tribe = tribesStore.TRIBES.find(t => t.id === tribesStore.activeTribeId)
  const text  = tribe
    ? `Placing ${tribe.icon} ${tribe.name} ${tribesStore.activeTribeType} – click map to place`
    : 'Click the map to place a tribe marker'
  uiStore.startPlacement('tribe', text)
}

function startSettlePlacement() {
  if (!authStore.user) { uiStore.requireAuth(); return }
  const stage = settlementsStore.STAGES.find(s => s.id === settlementsStore.stageId)
  const text  = stage
    ? `Placing ${stage.icon} ${stage.name} – click map`
    : 'Click the map to place a settlement'
  uiStore.startPlacement('settle', text)
}

</script>

<template>
  <div class="edit-panel">

    <!-- ── Markers ──────────────────────────────────────────────────── -->
    <section class="panel">
      <h2 class="panel-title">Markers</h2>
      <div class="marker-tabs">
        <button
          class="marker-tab"
          :class="{ active: uiStore.markerTab === 'tribe' }"
          @click="uiStore.markerTab = 'tribe'"
        >⚔ Tribe</button>
        <button
          class="marker-tab"
          :class="{ active: uiStore.markerTab === 'settle' }"
          @click="uiStore.markerTab = 'settle'"
        >⚑ Settlement</button>
      </div>

      <!-- Tribe tab -->
      <div v-if="uiStore.markerTab === 'tribe'" id="tribe-marker-tab">
        <div id="tribe-dd-wrap" class="res-dd-wrap" style="margin-bottom:7px">
          <AppDropdown :options="tribeOptions" v-model="activeTribeIdStr" cls="sidebar" />
        </div>
        <div class="type-btn-group" id="tribe-type-group">
          <button
            v-for="type in tribeTypes"
            :key="type"
            class="type-btn"
            :class="{ active: tribesStore.activeTribeType === type }"
            @click="tribesStore.activeTribeType = type"
          >{{ TRIBE_TYPE_ICONS[type] }} {{ type }}</button>
        </div>
        <button id="tribe-place-btn" class="action-btn tribe-place-btn" @click="startTribePlacement">
          ⚔ Mark Location
        </button>
      </div>

      <!-- Settlement tab -->
      <div v-if="uiStore.markerTab === 'settle'" id="settle-marker-tab">
        <div id="settle-resource-wrap" class="res-dd-wrap" style="margin-bottom:7px">
          <AppDropdown :options="resourceTypeOptions" v-model="settlementsStore.resourceType" cls="sidebar" />
        </div>
        <div class="type-btn-group" id="settle-stage-group">
          <button
            v-for="s in settlementsStore.STAGES"
            :key="s.id"
            class="type-btn"
            :class="{ active: settlementsStore.stageId === s.id }"
            @click="settlementsStore.stageId = s.id"
          >{{ s.icon }} {{ s.name }}</button>
        </div>
        <div class="type-btn-group" id="settle-vis-group">
          <button
            class="type-btn"
            :class="{ active: settlementsStore.isPublic }"
            @click="settlementsStore.isPublic = true"
          >🔓 Public</button>
          <button
            class="type-btn"
            :class="{ active: !settlementsStore.isPublic }"
            @click="settlementsStore.isPublic = false"
          >🔒 Private</button>
        </div>
        <button id="settle-place-btn" class="action-btn settle-place-btn" @click="startSettlePlacement">
          ⚑ Place Settlement
        </button>
      </div>
    </section>

    <!-- ── Paint ────────────────────────────────────────────────────── -->
    <section class="panel">
      <h2 class="panel-title">Paint</h2>
      <button
        id="paint-mode-btn"
        class="action-btn paint-mode-btn"
        :class="{ active: paintStore.paintMode }"
        @click="paintStore.setPaintMode(!paintStore.paintMode)"
      >🖌 {{ paintStore.paintMode ? 'Stop Painting' : 'Start Painting' }}</button>
      <div class="divider"></div>
      <button
        v-for="key in terrainKeys"
        :key="key"
        class="terrain-btn"
        :class="{ active: paintStore.paintMode && paintStore.activeTerrain === key }"
        :style="{ borderColor: paintStore.TERRAINS[key]?.color }"
        @click="paintStore.selectTerrain(key)"
      >
        <span class="swatch" :style="{ background: paintStore.TERRAINS[key]?.color }"></span>
        <span class="terrain-label">{{ paintStore.TERRAINS[key]?.icon }} {{ key }}</span>
      </button>
      <div class="divider"></div>
      <button
        id="eraser-btn"
        class="action-btn"
        :class="{ active: paintStore.paintMode && paintStore.activeTerrain === null }"
        @click="paintStore.activeTerrain = null; paintStore.paintMode = true"
      >⬜ Eraser</button>
    </section>

  </div>
</template>
