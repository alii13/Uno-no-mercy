<template>
  <div class="status-stack">
    <div
      v-if="turnLabel"
      class="turn-indicator"
      :class="{ mine: turnIsMine }"
      role="status"
      aria-live="polite"
    >
      <span class="turn-dot"></span>
      {{ turnLabel }}
    </div>
    <Transition name="toast">
      <div v-if="message" class="status-toast" :style="messageStyle" role="status" aria-live="polite">
        {{ message }}
      </div>
    </Transition>
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
  stackingMode?: string
  turnLabel?: string
  turnIsMine?: boolean
}>()
</script>

<style scoped>
.status-stack {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--spacing-2);
}

/* Persistent, calm turn-ownership indicator. Distinct from the red event
   toast — green when it's you, muted with a "thinking" pulse when waiting on
   someone else (so a slow opponent doesn't read as a frozen app). */
.turn-indicator {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.3rem 0.85rem;
  border-radius: var(--radius-pill);
  font-family: var(--font-mono);
  font-size: 0.72rem;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.12);
  color: var(--text-secondary);
}

.turn-indicator.mine {
  background: rgba(0, 255, 102, 0.12);
  border-color: rgba(0, 255, 102, 0.4);
  color: #00ff66;
}

.turn-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: currentColor;
}

.turn-indicator:not(.mine) .turn-dot {
  animation: turn-thinking 1.2s ease-in-out infinite;
}

@keyframes turn-thinking {
  0%, 100% { opacity: 0.35; transform: scale(0.7); }
  50% { opacity: 1; transform: scale(1); }
}

@media (prefers-reduced-motion: reduce) {
  .turn-indicator:not(.mine) .turn-dot { animation: none; }
}

.status-toast {
  display: inline-block;
  padding: var(--spacing-2) var(--spacing-4);
  background: linear-gradient(180deg, rgba(255, 42, 42, 0.18), rgba(255, 42, 42, 0.06));
  border: 1px solid var(--color-alert);
  border-radius: var(--radius-pill);
  font-family: var(--font-mono);
  font-size: var(--text-sm);
  letter-spacing: 0.12em;
  color: var(--text-primary);
  text-align: center;
  box-shadow: 0 0 24px rgba(255, 42, 42, 0.25);
  max-width: min(560px, 90vw);
}

.toast-enter-active, .toast-leave-active {
  transition: opacity var(--duration-soft) var(--ease-soft), transform var(--duration-soft) var(--ease-soft);
}

.toast-enter-from, .toast-leave-to {
  opacity: 0;
  transform: translateY(-8px);
}

@media (prefers-reduced-motion: reduce) {
  .toast-enter-active, .toast-leave-active { transition: none; }
}
</style>
