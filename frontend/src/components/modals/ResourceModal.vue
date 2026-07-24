<script setup>
import { computed } from 'vue'
import AppDropdown         from '../AppDropdown.vue'
import { useResourcesStore } from '@/stores/resources.js'
import { usePaintStore }     from '@/stores/paint.js'
import { useAuthStore }      from '@/stores/auth.js'
import { useUiStore }        from '@/stores/ui.js'

const rs        = useResourcesStore()
const paintStore = usePaintStore()
const authStore  = useAuthStore()
const uiStore    = useUiStore()

const typeOptions = computed(() => [
  { value: '', label: 'All Types' },
  ...rs.resourceTypes.map(t => ({ value: t, label: t })),
])

const terrainOptions = computed(() => [
  { value: '', label: 'All Terrains' },
  ...Object.keys(paintStore.TERRAINS).map(k => ({
    value: k,
    label: `${paintStore.TERRAINS[k]?.icon} ${k}`,
  })),
])

const starStrOptions = [
  { value: '0', label: '★ Any' },
  { value: '1', label: '★ ≥ 1' },
  { value: '2', label: '★ ≥ 2' },
  { value: '3', label: '★ ≥ 3' },
  { value: '4', label: '★ ≥ 4' },
  { value: '5', label: '★★★★★ only' },
]

function starLabel(stars) {
  if (!stars) return '?'
  return '★'.repeat(stars) + '☆'.repeat(5 - stars)
}

function starClass(stars) {
  if (!stars) return 'stars-unknown'
  if (stars >= 4) return 'stars-high'
  if (stars >= 2) return 'stars-mid'
  return 'stars-low'
}

function toggleEdit() {
  if (!authStore.user) { uiStore.requireAuth(); return }
  rs.editMode = !rs.editMode
}

async function setStar(locId, stars) {
  if (!rs.editMode) return
  await rs.patchStar(locId, stars)
}

function close() { rs.closeModal() }
</script>

<template>
  <Teleport to="body">
    <div id="resource-overlay" @click.self="close">
      <div id="resource-modal">
        <button id="resource-close" @click="close">✕</button>

        <div class="res-modal-title">📦 Resource Lookup</div>

        <!-- Edit bar -->
        <div id="res-edit-bar">
          <button id="res-edit-btn" :class="{ active: rs.editMode }" @click="toggleEdit">
            ✎ Edit Ratings
          </button>
        </div>

        <!-- Product search -->
        <div class="res-search-row">
          <input
            v-model="rs.product"
            class="res-search"
            type="text"
            placeholder="Search by product name…"
            @input="rs.resType = ''; rs.resName = ''; rs.resTerrain = ''"
          />
        </div>

        <!-- Filters -->
        <div class="res-filters-wrap">
          <button class="filters-toggle" @click="rs.filtersOpen = !rs.filtersOpen">
            {{ rs.filtersOpen ? '▴' : '▾' }} Filters
          </button>

          <div v-if="rs.filtersOpen" class="res-filters">
            <div class="res-filter-row">
              <span class="res-filter-label">Type</span>
              <AppDropdown
                :options="typeOptions"
                :model-value="rs.resType"
                @update:model-value="v => { rs.resType = v; rs.resName = '' }"
              />
            </div>

            <div class="res-filter-row">
              <span class="res-filter-label">Resource</span>
              <AppDropdown
                :options="rs.resourceNameOptions"
                :model-value="rs.resName"
                @update:model-value="v => rs.resName = v"
              />
            </div>

            <div class="res-filter-row">
              <span class="res-filter-label">Terrain</span>
              <AppDropdown
                :options="terrainOptions"
                :model-value="rs.resTerrain"
                @update:model-value="v => rs.resTerrain = v"
              />
            </div>

            <div class="res-filter-row">
              <span class="res-filter-label">Min ★</span>
              <AppDropdown
                :options="starStrOptions"
                :model-value="String(rs.minStars)"
                @update:model-value="v => rs.minStars = parseInt(v)"
              />
            </div>
          </div>
        </div>

        <!-- Results -->
        <div id="resource-results" :class="{ 'edit-mode': rs.editMode }">
          <div v-if="!rs.filteredResources.length" class="res-empty">
            No resources match your filters.
          </div>

          <div
            v-for="r in rs.filteredResources"
            :key="r.name"
            class="res-section"
          >
            <div class="res-section-header">
              <span class="res-section-name">{{ r.icon }} {{ r.name }}</span>
              <span class="res-type-badge">{{ r.type }}</span>
            </div>

            <div v-if="r.chain" class="res-chain">
              <span v-if="r.chain.processed" class="res-chain-item">{{ r.chain.processed }}</span>
              <template v-if="r.chain.final1?.name">
                <span class="res-chain-arrow">→</span>
                <span class="res-chain-item">{{ r.chain.final1.name }}</span>
                <span v-if="r.chain.final1.category" class="res-chain-badge">{{ r.chain.final1.category }}</span>
              </template>
              <template v-if="r.chain.final2?.name">
                <span class="res-chain-arrow">→</span>
                <span class="res-chain-item">{{ r.chain.final2.name }}</span>
                <span v-if="r.chain.final2.category" class="res-chain-badge">{{ r.chain.final2.category }}</span>
              </template>
            </div>

            <div
              v-for="t in r.matchedTerrains"
              :key="t.terrain"
              class="res-terrain"
            >
              <div class="res-terrain-label">
                <span
                  class="swatch"
                  :style="{ background: paintStore.TERRAINS[t.terrain]?.color }"
                ></span>
                {{ paintStore.TERRAINS[t.terrain]?.icon }} {{ t.terrain }}
              </div>

              <div
                v-for="loc in t.locs"
                :key="loc.id"
                class="res-loc"
              >
                <span>{{ loc.country }}<template v-if="loc.state"> / {{ loc.state }}</template></span>

                <div class="res-loc-stars-wrap" @click="setStar(loc.id, loc.stars === 0 ? 1 : 0)">
                  <template v-if="!rs.editMode">
                    <span :class="['res-stars', starClass(loc.stars)]">{{ starLabel(loc.stars) }}</span>
                  </template>
                  <template v-else>
                    <button
                      v-for="n in [0,1,2,3,4,5]"
                      :key="n"
                      class="star-btn"
                      :class="{ active: loc.stars === n }"
                      @click.stop="setStar(loc.id, n)"
                    >{{ n === 0 ? '?' : '★'.repeat(n) }}</button>
                  </template>
                </div>
              </div>
            </div>

            <div v-if="!r.matchedTerrains.length" class="res-empty">
              No location data for current filters.
            </div>
          </div>
        </div>

      </div>
    </div>
  </Teleport>
</template>
