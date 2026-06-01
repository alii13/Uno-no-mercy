<template>
  <div class="battle-pit">
    <div class="pit-table">
      <!-- Draw Station -->
      <div class="station draw-station" @click="$emit('draw')">
        <slot name="draw-pile"></slot>
        <div class="action-hint" v-if="showDrawHint">
          {{ drawHintText }}
        </div>
      </div>

      <!-- Discard Station — wrapped with a current-color ring -->
      <div
        class="station discard-station"
        :class="currentColor && currentColor !== 'wild' ? `discard-color-${currentColor}` : ''"
        ref="discardAreaRef"
      >
        <slot name="discard-pile"></slot>
      </div>
    </div>

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
  currentColor?: string
}>()

const { isMobile } = useScreenSize()
const drawHintText = computed(() => (isMobile.value ? 'TAP TO DRAW' : 'CLICK TO DRAW'))

defineEmits<{
  draw: []
  'toggle-sound': []
}>()

const discardAreaRef = ref<HTMLElement | null>(null)

defineExpose({
  discardAreaRef,
})
</script>
