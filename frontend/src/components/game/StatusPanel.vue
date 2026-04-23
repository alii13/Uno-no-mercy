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
    <div class="panel-row" v-if="currentColor && currentColor !== 'wild'">
      <span class="label">COLOR</span>
      <span class="value color-indicator" :class="`color-${currentColor}`">
        {{ currentColor.toUpperCase() }}
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
  currentColor?: string
  message?: string
  messageStyle?: CSSProperties
}>()
</script>

<style scoped>
.color-indicator {
  font-weight: bold;
  padding: 2px 8px;
  border-radius: 3px;
  letter-spacing: 2px;
}
.color-red { color: #ff3333; text-shadow: 0 0 8px rgba(255, 51, 51, 0.6); }
.color-blue { color: #3388ff; text-shadow: 0 0 8px rgba(51, 136, 255, 0.6); }
.color-green { color: #33ff66; text-shadow: 0 0 8px rgba(51, 255, 102, 0.6); }
.color-yellow { color: #ffcc00; text-shadow: 0 0 8px rgba(255, 204, 0, 0.6); }
</style>
