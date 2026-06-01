<template>
  <div class="surveillance-bar">
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
/* Top HUD strip. Opponents in default slot, audio + settings in `controls`.
   Dropped the "OPPONENT_FEED_LIVE" cosplay label that lived above the row. */
</script>
