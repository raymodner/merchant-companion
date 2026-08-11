<script setup>
import { ref } from 'vue'

const dismissed = ref(localStorage.getItem('cookie-notice') === '1')

function dismiss() {
  localStorage.setItem('cookie-notice', '1')
  dismissed.value = true
}
</script>

<template>
  <div v-if="!dismissed" id="cookie-notice" role="region" aria-label="Cookie notice">
    <span>
      This site uses one essential cookie to keep you logged in. No tracking or advertising.
      <a href="/privacy.html" target="_blank" rel="noopener">Privacy Policy</a>
    </span>
    <button @click="dismiss" aria-label="Dismiss cookie notice">Got it</button>
  </div>
</template>
