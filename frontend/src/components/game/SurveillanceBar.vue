<template>
  <div class="surveillance-bar">
    <div class="bar-label">OPPONENT_FEED_LIVE</div>
    <div class="opponents-grid">
      <slot></slot>
    </div>
  </div>
</template>

<script setup lang="ts">
// This is a simple wrapper component that provides the styled container
// for displaying opponents. Content is passed via slot for flexibility.
</script>
