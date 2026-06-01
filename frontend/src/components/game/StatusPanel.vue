<template>
  <div class="status-strip" v-if="hasContent">
    <span
      class="status-flow"
      :class="{ 'flow-cw': direction === 1, 'flow-ccw': direction === -1 }"
      :aria-label="direction === 1 ? 'Clockwise' : 'Counter-clockwise'"
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14" aria-hidden="true">
        <polyline points="23 4 23 10 17 10" />
        <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
      </svg>
    </span>

    <span v-if="drawStack > 0" class="status-stack" :class="{ critical: drawStack >= 12 }">
      +{{ drawStack }}
    </span>

    <span v-if="message" class="status-message" :style="messageStyle">{{ message }}</span>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { CSSProperties } from 'vue'

const props = defineProps<{
  currentPlayerName: string
  direction: number
  drawStack: number
  currentColor?: string
  message?: string
  messageStyle?: CSSProperties
  stackingMode?: string
}>()

const hasContent = computed(() => props.drawStack > 0 || !!props.message || props.direction !== undefined)
</script>

<style scoped>
.status-strip {
  display: inline-flex;
  align-items: center;
  gap: var(--spacing-3);
  padding: var(--spacing-2) var(--spacing-4);
  background: rgba(0, 0, 0, 0.4);
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: var(--radius-pill);
  font-family: var(--font-mono);
  font-size: var(--text-xs);
  color: var(--text-secondary);
  letter-spacing: 0.15em;
  min-height: 32px;
}

.status-flow {
  display: inline-flex;
  align-items: center;
  color: var(--text-muted);
}

.flow-cw svg {
  animation: spin-cw 3s linear infinite;
}

.flow-ccw svg {
  animation: spin-ccw 3s linear infinite;
}

@keyframes spin-cw {
  to { transform: rotate(360deg); }
}

@keyframes spin-ccw {
  to { transform: rotate(-360deg); }
}

@media (prefers-reduced-motion: reduce) {
  .flow-cw svg, .flow-ccw svg { animation: none; }
}

.status-stack {
  font-family: var(--font-display);
  font-size: var(--text-base);
  color: var(--color-hazard);
  letter-spacing: 0.05em;
  text-shadow: 0 0 12px rgba(255, 204, 0, 0.4);
}

.status-stack.critical {
  color: var(--color-alert);
  text-shadow: 0 0 14px rgba(255, 42, 42, 0.5);
  animation: stack-pulse 1.6s ease-in-out infinite;
}

@keyframes stack-pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.55; }
}

@media (prefers-reduced-motion: reduce) {
  .status-stack.critical { animation: none; }
}

.status-message {
  font-family: var(--font-mono);
  color: var(--text-primary);
  letter-spacing: 0.1em;
}
</style>
