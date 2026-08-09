<template>
  <div class="metal-surface" aria-hidden="true"></div>
  <!-- Spans the whole table, not just the pit row — see .table-hatching. -->
  <div class="table-hatching" aria-hidden="true"></div>
  <div class="vignette" aria-hidden="true"></div>
</template>

<script setup lang="ts">
/* Subtle ambient atmosphere only. The mechanical-cog gear background was
   removed when the pit added its own felt-table radial light — the cog
   was visible through the new gradient and read as background noise
   rather than ambient detail. */
defineProps<{
  direction: number
}>()
</script>
