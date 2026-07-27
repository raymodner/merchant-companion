<script setup>
import { computed } from 'vue'
import { usePaintStore }       from '@/stores/paint.js'
import { useTribesStore }      from '@/stores/tribes.js'
import { useSettlementsStore } from '@/stores/settlements.js'
import { useResourcesStore }   from '@/stores/resources.js'
import { TRIBE_TYPE_ICONS, typeIcon } from '@/utils.js'

const paintStore       = usePaintStore()
const tribesStore      = useTribesStore()
const settlementsStore = useSettlementsStore()
const resourcesStore   = useResourcesStore()

const terrainKeys = computed(() => Object.keys(paintStore.TERRAINS))
const tribeTypes  = ['Camp', 'Selo', 'Burgh']

const productTypes = computed(() =>
  [...new Set(resourcesStore.resourceData.map(r => r.type))].sort()
)

function isTerrainHidden(key) { return paintStore.hiddenTerrains.includes(key) }
function isTribeHidden(id)    { return tribesStore.hiddenTribes.includes(id) }
function isTribeTypeHidden(t) { return tribesStore.hiddenTribeTypes.includes(t) }
function isStageHidden(id)    { return settlementsStore.hiddenStages.includes(id) }
function isProductHidden(t)   { return settlementsStore.hiddenProducts.includes(t) }
</script>

<template>
  <div class="view-panel">

    <!-- ── Terrain Filters ───────────────────────────────────────────── -->
    <section class="panel">
      <h2 class="panel-title">Filters</h2>
      <div class="filter-actions">
        <button class="filter-quick" @click="paintStore.showAll()">All</button>
        <button class="filter-quick" @click="paintStore.hideAll()">None</button>
      </div>
      <button
        v-for="key in terrainKeys"
        :key="key"
        class="filter-row"
        :class="{ hidden: isTerrainHidden(key) }"
        @click="paintStore.toggleFilter(key)"
      >
        <span class="swatch" :style="{ background: paintStore.TERRAINS[key]?.color }"></span>
        {{ paintStore.TERRAINS[key]?.icon }} {{ key }}
      </button>
    </section>

    <!-- ── Tribe Markers ─────────────────────────────────────────────── -->
    <section class="panel">
      <h2 class="panel-title">Tribe Markers</h2>
      <div class="filter-actions">
        <button class="filter-quick" @click="tribesStore.showAllTribes()">All</button>
        <button class="filter-quick" @click="tribesStore.hideAllTribes()">None</button>
      </div>
      <div id="tribe-filter-dots" class="mf-dots" style="margin-bottom:5px">
        <span
          v-for="tribe in tribesStore.TRIBES"
          :key="tribe.id"
          class="mf-dot"
          :class="{ 'filtered-out': isTribeHidden(tribe.id) }"
          :title="tribe.name"
          :style="{ background: tribe.color }"
          @click="tribesStore.toggleHideTribe(tribe.id)"
        >{{ tribe.icon }}</span>
      </div>
      <div id="tribe-type-filters" class="mf-type-row">
        <button
          v-for="t in tribeTypes"
          :key="t"
          class="mf-type-btn"
          :class="{ 'filtered-out': isTribeTypeHidden(t) }"
          @click="tribesStore.toggleHideType(t)"
        >{{ TRIBE_TYPE_ICONS[t] }} {{ t }}</button>
      </div>
    </section>

    <!-- ── Settlements ────────────────────────────────────────────────── -->
    <section class="panel">
      <h2 class="panel-title">Settlements</h2>
      <div class="filter-actions">
        <button class="filter-quick" @click="settlementsStore.showAllSettlements()">All</button>
        <button class="filter-quick" @click="settlementsStore.hideAllSettlements(productTypes)">None</button>
      </div>
      <div id="settle-product-filters" class="mf-dots" style="margin-bottom:4px">
        <span
          v-for="rt in productTypes"
          :key="rt"
          class="mf-dot"
          :class="{ 'filtered-out': isProductHidden(rt) }"
          :title="rt"
          style="background: rgba(201,151,58,0.15)"
          @click="settlementsStore.toggleHideProduct(rt)"
        >{{ typeIcon(rt) }}</span>
      </div>
      <div id="settle-stage-filters" class="mf-type-row">
        <button
          v-for="stage in settlementsStore.STAGES"
          :key="stage.id"
          class="mf-type-btn"
          :class="{ 'filtered-out': isStageHidden(stage.id) }"
          @click="settlementsStore.toggleHideStage(stage.id)"
        >{{ stage.icon }} {{ stage.name }}</button>
      </div>
      <label class="mf-own-toggle">
        <input type="checkbox" :checked="settlementsStore.showPublic" @change="settlementsStore.showPublic = !settlementsStore.showPublic" />
        <span class="mf-switch"></span>
        <span>Show public</span>
      </label>
    </section>

    <!-- ── Resources ─────────────────────────────────────────────────── -->
    <section class="panel">
      <h2 class="panel-title">Resources</h2>
      <div class="action-btn secondary-btn" style="width:100%" @click="resourcesStore.isOpen = true">🔍 Resource Lookup</div>
    </section>

  </div>
</template>
