<template>
  <div class="battle-pit">
    <!-- Draw Station -->
    <div class="station draw-station" @click="$emit('draw')">
      <div class="station-mark">DRAW_PILE</div>
      <slot name="draw-pile"></slot>
      <div class="action-hint" v-if="showDrawHint">
        [ CLICK TO DRAW ]
      </div>
    </div>

    <!-- Discard Station (Center) -->
    <div class="station discard-station" ref="discardAreaRef">
      <div class="station-mark warning">DISCARD_ZONE</div>
      <slot name="discard-pile"></slot>
      
      <!-- Status Panel -->
      <slot name="status-panel"></slot>
    </div>

    <!-- Utilities Sidebar -->
    <div class="utilities-sidebar">
      <div class="control-switch" @click="$emit('toggle-sound')">
        <div class="switch-label">AUDIO</div>
        <div class="switch-indicator" :class="{ active: !isMuted }"></div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'

defineProps<{
  showDrawHint: boolean
  isMuted: boolean
}>()

defineEmits<{
  'draw': []
  'toggle-sound': []
}>()

const discardAreaRef = ref<HTMLElement | null>(null)

// Expose ref for parent to access
defineExpose({
  discardAreaRef
})
</script>
