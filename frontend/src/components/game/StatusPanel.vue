<template>
  <div class="status-panel">
    <div class="panel-row">
      <span class="label">TURN</span>
      <span class="value blink">{{ currentPlayerName }}</span>
    </div>
    <div class="panel-row">
      <span class="label">FLOW</span>
      <span 
        class="value direction-indicator" 
        :class="{ 'direction-cw': direction === 1, 'direction-ccw': direction === -1 }"
      >
        <span class="direction-icon">↻</span>
        {{ direction === 1 ? 'CLOCKWISE' : 'COUNTER-CW' }}
      </span>
    </div>
    <div class="panel-row" v-if="drawStack > 0">
      <span class="label hazard">STACK_LEVEL</span>
      <span class="value hazard-text">+{{ drawStack }}</span>
    </div>
    <div class="panel-row" v-if="message">
      <span class="message-text" :style="messageStyle">{{ message }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { CSSProperties } from 'vue'

defineProps<{
  currentPlayerName: string
  direction: number
  drawStack: number
  message?: string
  messageStyle?: CSSProperties
}>()
</script>
