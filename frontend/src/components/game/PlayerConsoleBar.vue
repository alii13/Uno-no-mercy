<template>
  <div class="player-console-bar action-dock">
    <!-- CAUGHT! and other transient center content (was a fixed overlay). -->
    <div class="dock-center">
      <slot />
    </div>

    <!-- UNO! (right thumb). Drawing is done by tapping the deck. -->
    <button
      v-if="showUnoButton"
      class="dock-btn uno-btn"
      type="button"
      @click="$emit('call-uno')"
    >
      UNO!
    </button>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  showUnoButton: boolean
}>()

defineEmits<{
  'call-uno': []
}>()
</script>
