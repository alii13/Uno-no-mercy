<template>
  <div class="battle-pit">
    <!-- Draw Station -->
    <div class="station draw-station" @click="$emit('draw')">
      <div class="station-mark">DRAW_PILE</div>
      <slot name="draw-pile"></slot>
      <div class="action-hint" v-if="showDrawHint">
        {{ drawHintText }}
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
      <SettingsButton class="utilities-settings" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useScreenSize } from '../../composables/useScreenSize'
import SettingsButton from '../SettingsButton.vue'

defineProps<{
  showDrawHint: boolean
  isMuted: boolean
}>()

const { isMobile } = useScreenSize()
const drawHintText = computed(() => isMobile.value ? '[ TAP TO DRAW ]' : '[ CLICK TO DRAW ]')

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

<style scoped>
@media (max-width: 480px) {
  .utilities-sidebar {
    position: absolute;
    top: 0.25rem;
    right: 0.25rem;
    z-index: 10;
  }

  .utilities-sidebar .control-switch {
    min-width: 44px;
    min-height: 44px;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
  }
}
</style>
