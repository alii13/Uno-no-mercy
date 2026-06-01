<template>
  <div class="battle-pit">
    <div class="pit-table">
      <!-- Draw Station -->
      <div class="station draw-station" @click="$emit('draw')">
        <div class="station-mark">DRAW_PILE</div>
        <slot name="draw-pile"></slot>
        <div class="action-hint" v-if="showDrawHint">
          {{ drawHintText }}
        </div>
      </div>

      <!-- Discard Station -->
      <div class="station discard-station" ref="discardAreaRef">
        <div class="station-mark warning">DISCARD_ZONE</div>
        <slot name="discard-pile"></slot>
      </div>
    </div>

    <!-- Status Panel — below the table, centered -->
    <div class="pit-status">
      <slot name="status-panel"></slot>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useScreenSize } from '../../composables/useScreenSize'

defineProps<{
  showDrawHint: boolean
  isMuted: boolean
}>()

const { isMobile } = useScreenSize()
const drawHintText = computed(() => (isMobile.value ? '[ TAP TO DRAW ]' : '[ CLICK TO DRAW ]'))

defineEmits<{
  draw: []
  'toggle-sound': []
}>()

const discardAreaRef = ref<HTMLElement | null>(null)

defineExpose({
  discardAreaRef,
})
</script>
