<template>
  <div
    class="asr"
    :class="{ paused, closing: !paused && secondsLeft <= 10, critical: !paused && secondsLeft <= 5 }"
    role="timer"
    :aria-label="`${label}: ${secondsLeft} seconds`"
  >
    <div class="asr-dial">
      <svg class="asr-ring" viewBox="0 0 120 120" aria-hidden="true">
        <circle class="asr-track" cx="60" cy="60" r="52" />
        <circle class="asr-fill" cx="60" cy="60" r="52" :style="{ strokeDashoffset: dashOffset }" />
      </svg>
      <div class="asr-center">
        <span ref="numEl" class="asr-num">{{ secondsLeft }}</span>
        <span class="asr-unit">SEC</span>
      </div>
    </div>
    <p class="asr-label">{{ label }}</p>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { gsap } from 'gsap'

const props = defineProps<{
  /** Local-clock epoch ms when the room deals itself. */
  deadline: number
  /** Below the minimum — the clock is frozen at its remainder. */
  paused: boolean
}>()

const remainingMs = ref(Math.max(0, props.deadline - Date.now()))
const numEl = ref<HTMLElement | null>(null)
let raf = 0

function tick() {
  remainingMs.value = Math.max(0, props.deadline - Date.now())
  raf = requestAnimationFrame(tick)
}

function sync() {
  cancelAnimationFrame(raf)
  remainingMs.value = Math.max(0, props.deadline - Date.now())
  // While paused the number holds; the next presence frame moves it.
  if (!props.paused) raf = requestAnimationFrame(tick)
}

onMounted(sync)
watch(() => [props.deadline, props.paused], sync)
onUnmounted(() => cancelAnimationFrame(raf))

const secondsLeft = computed(() => Math.ceil(remainingMs.value / 1000))
const label = computed(() =>
  props.paused ? 'NEED 1 MORE PLAYER'
  : secondsLeft.value <= 5 ? 'GET READY'
  : 'MATCH STARTS IN',
)

// Ring geometry: fraction of the full 30s window still on the clock.
const CIRCUMFERENCE = 2 * Math.PI * 52
const dashOffset = computed(() => {
  const fraction = Math.min(1, Math.max(0, remainingMs.value / 30_000))
  return CIRCUMFERENCE * (1 - fraction)
})

// The last five seconds land with a pop per tick.
watch(secondsLeft, (s, prev) => {
  if (props.paused || s === prev || s > 5 || s < 0 || !numEl.value) return
  gsap.fromTo(numEl.value, { scale: 1.3 }, { scale: 1, duration: 0.3, ease: 'back.out(2)' })
})
</script>

<style scoped>
.asr {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--spacing-2);
}

.asr-dial {
  position: relative;
  width: 110px;
  height: 110px;
}

.asr-ring {
  width: 100%;
  height: 100%;
  transform: rotate(-90deg);
}

.asr-track,
.asr-fill {
  fill: none;
  stroke-width: 6;
}

.asr-track {
  stroke: rgba(255, 255, 255, 0.08);
}

.asr-fill {
  stroke: var(--color-neon-blue);
  stroke-linecap: round;
  stroke-dasharray: 326.73;
  transition: stroke 0.3s ease;
  filter: drop-shadow(0 0 6px rgba(0, 243, 255, 0.35));
}

.closing .asr-fill {
  stroke: var(--color-hazard, #ffcc00);
  filter: drop-shadow(0 0 6px rgba(255, 204, 0, 0.35));
}

.critical .asr-fill {
  stroke: #ff4444;
  filter: drop-shadow(0 0 8px rgba(255, 68, 68, 0.5));
}

.paused .asr-fill {
  stroke: rgba(255, 255, 255, 0.25);
  filter: none;
}

.asr-center {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2px;
}

.asr-num {
  font-family: var(--font-display), sans-serif;
  font-size: 2.1rem;
  line-height: 1;
  color: var(--text-primary);
  will-change: transform;
}

.critical .asr-num {
  color: #ff6666;
}

.paused .asr-num {
  color: var(--text-secondary);
}

.asr-unit {
  font-family: var(--font-mono);
  font-size: 0.55rem;
  letter-spacing: 0.25em;
  color: var(--text-muted);
}

.asr-label {
  margin: 0;
  font-family: var(--font-mono);
  font-size: var(--text-xs);
  letter-spacing: 0.18em;
  color: var(--text-secondary);
}

.critical .asr-label {
  color: #ff6666;
  animation: asr-blink 0.5s steps(2) infinite;
}

.paused .asr-label {
  color: var(--text-muted);
}

@keyframes asr-blink {
  50% { opacity: 0.4; }
}

@media (prefers-reduced-motion: reduce) {
  .critical .asr-label { animation: none; }
}
</style>
