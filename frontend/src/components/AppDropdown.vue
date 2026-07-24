<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'

const props = defineProps({
  options:     { type: Array,  default: () => [] },
  modelValue:  { type: String, default: '' },
  cls:         { type: String, default: '' },
})
const emit = defineEmits(['update:modelValue'])

const isOpen    = ref(false)
const btnRef    = ref(null)
const listStyle = ref({})

const selectedLabel = computed(() =>
  props.options.find(o => o.value === props.modelValue)?.label ?? props.options[0]?.label ?? ''
)

function open() {
  const r = btnRef.value.getBoundingClientRect()
  listStyle.value = {
    top:   (r.bottom + 3) + 'px',
    left:   r.left + 'px',
    width:  r.width + 'px',
  }
  isOpen.value = true
}

function close() { isOpen.value = false }

function toggle(e) {
  e.stopPropagation()
  isOpen.value ? close() : open()
}

function select(value) {
  emit('update:modelValue', value)
  close()
}

function onDocClick() { close() }

onMounted(() => document.addEventListener('click', onDocClick))
onUnmounted(() => document.removeEventListener('click', onDocClick))
</script>

<template>
  <button
    ref="btnRef"
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
      <div
        v-for="o in options"
        :key="o.value"
        class="res-dd-item"
        :class="{ active: o.value === modelValue }"
        @mousedown.prevent="select(o.value)"
      >{{ o.label }}</div>
    </div>
  </Teleport>
</template>
