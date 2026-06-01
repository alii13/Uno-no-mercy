<template>
  <Transition name="toast">
    <div v-if="message" class="status-toast" :style="messageStyle" role="status" aria-live="polite">
      {{ message }}
    </div>
  </Transition>
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
}>()
</script>

<style scoped>
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
