<script setup>
import { ref, computed, onMounted, onUnmounted, nextTick } from 'vue'

const props = defineProps({
  options:     { type: Array,  default: () => [] },
  modelValue:  { type: String, default: '' },
  cls:         { type: String, default: '' },
})
const emit = defineEmits(['update:modelValue'])

const isOpen     = ref(false)
const filterText = ref('')
const btnRef     = ref(null)
const inputRef   = ref(null)
const listStyle  = ref({})
const uid        = Symbol()

const selectedLabel = computed(() =>
  props.options.find(o => o.value === props.modelValue)?.label ?? props.options[0]?.label ?? ''
)

const filteredOptions = computed(() => {
  const q = filterText.value.trim().toLowerCase()
  if (!q) return props.options
  return props.options.filter(o => o.label.toLowerCase().includes(q))
})

function open() {
  document.dispatchEvent(new CustomEvent('app-dd-close-others', { detail: uid }))
  const r = btnRef.value.getBoundingClientRect()
  listStyle.value = { top: (r.bottom + 3) + 'px', left: r.left + 'px', width: r.width + 'px' }
  isOpen.value = true
  filterText.value = ''
  nextTick(() => inputRef.value?.focus())
}

function close() {
  isOpen.value = false
  filterText.value = ''
}

function toggle(e) {
  e.stopPropagation()
  isOpen.value ? close() : open()
}

function select(value) {
  emit('update:modelValue', value)
  close()
}

function onCloseOthers(e) { if (e.detail !== uid) close() }

onMounted(() => {
  document.addEventListener('click', close)
  document.addEventListener('app-dd-close-others', onCloseOthers)
})
onUnmounted(() => {
  document.removeEventListener('click', close)
  document.removeEventListener('app-dd-close-others', onCloseOthers)
})
</script>

<template>
  <button
    ref="btnRef"
    type="button"
    :class="['res-dd-btn', cls ? `${cls}-btn` : '', { open: isOpen }]"
    data-dd-btn="1"
    @click="toggle"
  >
    <span class="res-dd-value">{{ selectedLabel }}</span>
    <span class="res-dd-arrow">▾</span>
  </button>
  <Teleport to="body">
    <div
      v-if="isOpen"
      :class="['res-dd-list', cls ? `${cls}-list` : '', 'open']"
      data-dd-list="1"
      :style="listStyle"
      @click.stop
    >
      <div class="res-dd-filter">
        <input
          ref="inputRef"
          v-model="filterText"
          class="res-dd-filter-input"
          placeholder="Filter…"
          @keydown.escape.prevent="close"
        />
      </div>
      <div class="res-dd-items">
        <div
          v-for="o in filteredOptions"
          :key="o.value"
          class="res-dd-item"
          :class="{ active: o.value === modelValue }"
          @mousedown.prevent="select(o.value)"
        >{{ o.label }}</div>
        <div v-if="filteredOptions.length === 0" class="res-dd-empty">No results</div>
      </div>
    </div>
  </Teleport>
</template>
