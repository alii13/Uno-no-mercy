<template>
  <!-- Ambient Background Elements -->
  <div class="metal-surface"></div>
  <div class="warning-stripes top"></div>
  <div class="warning-stripes bottom"></div>
  <div class="vignette"></div>

  <!-- Directional Cog Animation (Background) -->
  <div class="mechanical-cog" :class="{ 'spin-ccw': direction === -1 }">
    ⚙️
  </div>
</template>

<script setup lang="ts">
defineProps<{
  direction: number
}>()
</script>
