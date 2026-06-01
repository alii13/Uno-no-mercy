<template>
  <div class="surveillance-bar">
    <div class="bar-label">OPPONENT_FEED_LIVE</div>
    <div class="bar-content">
      <div class="opponents-grid">
        <slot></slot>
      </div>
      <div class="bar-controls" v-if="$slots.controls">
        <slot name="controls"></slot>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
/* Top HUD strip. Opponents render in the default slot; audio + settings
   render in the `controls` slot. Phase 2 pulled controls out of the
   BattlePit utilities-sidebar so the centre of the table reads as a
   focused draw/discard pair. */
</script>
