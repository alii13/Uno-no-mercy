<template>
  <div class="player-console-bar action-dock">
    <!-- DRAW (left thumb) — mobile only; desktop draws by tapping the pile. -->
    <button
      v-if="showDrawButton"
      class="dock-btn draw-btn"
      :class="{ 'must-draw': mustDraw }"
      :disabled="!canDraw"
      type="button"
      @click="$emit('draw')"
    >
      DRAW<span v-if="drawCount" class="draw-count"> +{{ drawCount }}</span>
    </button>

    <!-- CAUGHT! and other transient center content (was a fixed overlay). -->
    <div class="dock-center">
      <slot />
    </div>

    <!-- UNO! (right thumb) — opposite edge from DRAW, no destructive neighbor. -->
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
  showDrawButton?: boolean
  canDraw?: boolean
  drawCount?: number
  mustDraw?: boolean
}>()

defineEmits<{
  'call-uno': []
  draw: []
}>()
</script>
