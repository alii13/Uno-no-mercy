<template>
  <!-- Forced color pick: compact panel anchored just above the hand band so
       the fan stays visible while choosing. The scrim spans the arena above
       the hand (grid rows 1-3) and blocks stray taps — without it the deck's
       tap-to-draw would still fire mid-pick. -->
  <Transition name="pick" appear>
    <div class="color-pick-scrim">
      <div
        ref="panelRef"
        class="tactical-hud"
        role="dialog"
        aria-modal="true"
        :aria-label="title"
      >
        <div class="hud-header" :class="{ 'header-danger': isRoulette }">
          <svg class="warning-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
          <span>{{ title }}</span>
        </div>

        <div class="hud-sub">
          <!-- When a specific card triggered this picker (e.g. a wild you just
               drew), show it so you know exactly what you're about to play. -->
          <Card v-if="card" :card="card" :size="{ width: 44, height: 62 }" />
          <span>{{ subtitle }}</span>
        </div>

        <div class="colors-grid">
          <button
            v-for="color in colors"
            :key="color"
            class="color-btn"
            :class="`bg-${color}`"
            @click="$emit('select', color)"
          >
            <div class="btn-inner">
              <span class="color-label">{{ color.toUpperCase() }}</span>
              <!-- Hand-by-color summary: what each choice keeps playable. -->
              <span v-if="colorCounts" class="color-count">×{{ colorCounts[color] }}</span>
              <div class="scan-bar"></div>
            </div>
          </button>
        </div>
      </div>
    </div>
  </Transition>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'
import type { Card as CardType, CardColor } from '../../types/card'
import Card from './Card.vue'

withDefaults(defineProps<{
  title?: string
  subtitle?: string
  isRoulette?: boolean
  card?: CardType | null
  colorCounts?: Record<'red' | 'blue' | 'green' | 'yellow', number> | null
}>(), {
  title: 'AUTHORIZATION REQUIRED',
  subtitle: 'SELECT FREQUENCY',
  isRoulette: false,
  card: null,
  colorCounts: null
})

const colors = ['red', 'blue', 'green', 'yellow'] as const

defineEmits<{
  (e: 'select', color: CardColor): void
}>()

// Forced decision — no Esc, no backdrop dismiss. Focus moves to the first
// color and returns to wherever it was once the pick resolves.
const panelRef = ref<HTMLElement | null>(null)
const lastFocused = ref<HTMLElement | null>(null)

onMounted(() => {
  lastFocused.value = document.activeElement as HTMLElement | null
  panelRef.value?.querySelector('button')?.focus()
})

onUnmounted(() => {
  lastFocused.value?.focus?.()
})
</script>

<style scoped>
.color-pick-scrim {
  /* Absolutely positioned grid child: its grid area (rows 1-3, everything
     above the hand band) becomes the containing block, and being out of flow
     it can't displace the auto-placed zone rows. */
  grid-row: 1 / 4;
  grid-column: 1;
  position: absolute;
  inset: 0;
  z-index: var(--z-hand);
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
  align-items: center;
  background: linear-gradient(to bottom, rgba(0, 0, 0, 0.35), rgba(4, 6, 10, 0.75));
  padding: 0.5rem 0.75rem;
}

.tactical-hud {
  background: rgba(13, 14, 16, 0.96);
  border: 2px solid var(--color-hazard);
  padding: 0.75rem 1rem;
  width: min(520px, 100%);
  position: relative;
  box-shadow: 0 0 40px rgba(255, 204, 0, 0.18);
}

/* Cutout effect on the top border. */
.tactical-hud::before {
  content: '';
  position: absolute;
  top: -2px; left: 20%; right: 20%; height: 2px;
  background: rgba(13, 14, 16, 0.96);
  z-index: 1;
}

.header-danger {
  color: #ff3333 !important;
  border-bottom-color: #ff3333 !important;
  animation: blink-red 0.5s infinite;
}

@keyframes blink-red {
  0%, 100% { background: rgba(255, 0, 0, 0); }
  50% { background: rgba(255, 0, 0, 0.2); }
}

.hud-header {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  color: var(--color-hazard);
  font-family: var(--font-mono);
  font-weight: bold;
  font-size: 0.75rem;
  letter-spacing: 2px;
  border-bottom: 1px dashed var(--color-hazard-dim);
  padding-bottom: 0.5rem;
  margin-bottom: 0.5rem;
  user-select: none;
}

.warning-icon {
  flex-shrink: 0;
  animation: blink 1s infinite;
}

.hud-sub {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.75rem;
  color: white;
  font-family: var(--font-display);
  font-size: 1rem;
  letter-spacing: 2px;
  margin-bottom: 0.6rem;
}

.colors-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 0.5rem;
}

.color-btn {
  height: 64px;
  border: none;
  background: #222;
  cursor: pointer;
  padding: 3px; /* for outer rim */
  clip-path: polygon(8px 0, 100% 0, 100% calc(100% - 8px), calc(100% - 8px) 100%, 0 100%, 0 8px);
  transition: transform 0.2s, filter 0.2s;
}

.btn-inner {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  gap: 1px;
  font-family: var(--font-display);
  font-size: 0.9rem;
  color: white;
  text-shadow: 0 2px 4px rgba(0, 0, 0, 0.5);
  position: relative;
  overflow: hidden;
  clip-path: polygon(8px 0, 100% 0, 100% calc(100% - 8px), calc(100% - 8px) 100%, 0 100%, 0 8px);
}

.color-count {
  font-family: var(--font-mono);
  font-size: 0.8rem;
  font-weight: bold;
  opacity: 0.9;
}

.color-btn:hover,
.color-btn:focus-visible {
  transform: scale(1.04);
  filter: brightness(1.2);
}

.bg-red .btn-inner { background: linear-gradient(135deg, #cc0000, #990000); }
.bg-blue .btn-inner { background: linear-gradient(135deg, #0066cc, #004499); }
.bg-green .btn-inner { background: linear-gradient(135deg, #00cc66, #009944); }
.bg-yellow .btn-inner { background: linear-gradient(135deg, #ffcc00, #cc9900); color: black; text-shadow: none; }

.scan-bar {
  position: absolute;
  top: 0; left: 0; width: 100%; height: 4px;
  background: rgba(255, 255, 255, 0.5);
  opacity: 0;
  transition: opacity 0.2s;
}

.color-btn:hover .scan-bar {
  opacity: 1;
  animation: scan-down 1s infinite linear;
}

@keyframes scan-down {
  0% { top: 0; }
  100% { top: 100%; }
}

@keyframes blink {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

.pick-enter-active {
  transition: opacity var(--duration-soft) var(--ease-soft);
}
.pick-enter-active .tactical-hud {
  transition: transform var(--duration-soft) var(--ease-soft);
}
.pick-enter-from {
  opacity: 0;
}
.pick-enter-from .tactical-hud {
  transform: translateY(16px);
}

@media (prefers-reduced-motion: reduce) {
  .pick-enter-active,
  .pick-enter-active .tactical-hud {
    transition: none;
  }
  .warning-icon,
  .header-danger {
    animation: none;
  }
}
</style>
