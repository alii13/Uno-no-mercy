<template>
  <div v-if="current" class="badgeup" :class="{ self: current.self }" @click="skip">
    <div ref="cardEl" class="bu-card" :style="{ '--bu-color': badge.color }">
      <span class="bu-kicker">{{ current.self ? 'BADGE UNLOCKED' : 'AT THE TABLE' }}</span>
      <Badge :badge="badge" size="full" class="bu-badge" />
      <p class="bu-line">
        <strong class="bu-name">{{ current.name }}</strong>
        <span class="bu-verb"> reached </span>
        <strong class="bu-title" :style="{ color: badge.color }">{{ badge.title }}</strong>
      </p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, nextTick, onUnmounted } from 'vue'
import gsap from 'gsap'
import Badge from '../Badge.vue'
import { BADGES } from '../../utils/badges'
import { useGameFx } from '../../composables/fx/useGameFx'
import { confetti, isFxCanvasAvailable } from '../../composables/fx/useFxCanvas'
import { useMotion } from '../../composables/useMotion'

interface Item { name: string; tier: number; self: boolean }

const fx = useGameFx()
const queue: Item[] = []
const current = ref<Item | null>(null)
const cardEl = ref<HTMLElement | null>(null)
const timers: ReturnType<typeof setTimeout>[] = []
let playing = false

const badge = computed(() => BADGES[Math.min(Math.max((current.value?.tier ?? 1) - 1, 0), BADGES.length - 1)]!)

function clearTimers() {
  timers.forEach(clearTimeout)
  timers.length = 0
}

function enqueue(item: Item) {
  // De-dupe a self + broadcast echo of the same crossing.
  if (queue.some(q => q.name === item.name && q.tier === item.tier)) return
  queue.push(item)
  if (!playing) advance()
}

function advance() {
  clearTimers()
  const next = queue.shift()
  if (!next) {
    playing = false
    current.value = null
    return
  }
  playing = true
  current.value = next
  nextTick(() => play(next))
}

function play(item: Item) {
  const el = cardEl.value
  const reduced = useMotion().reduced
  const holdMs = item.self ? 2600 : 2000
  if (el && !reduced) {
    gsap.timeline()
      .from(el, { scale: 0.35, opacity: 0, y: item.self ? 44 : -18, rotate: item.self ? -6 : 0, duration: 0.5, ease: 'back.out(1.7)' })
      .to(el, { scale: 1.04, duration: 0.14, yoyo: true, repeat: 1, ease: 'sine.inOut' }, '>-0.05')
    if (isFxCanvasAvailable()) {
      const r = el.getBoundingClientRect()
      confetti(r.left + r.width / 2, r.top + r.height / 2, item.self ? 120 : 60)
    }
  }
  timers.push(setTimeout(out, holdMs))
}

function out() {
  const el = cardEl.value
  if (el && !useMotion().reduced) {
    gsap.to(el, { opacity: 0, y: -16, scale: 0.96, duration: 0.34, ease: 'power2.in', onComplete: advance })
  } else {
    advance()
  }
}

function skip() {
  clearTimers()
  out()
}

const unsub = fx.on('badgeUp', ({ name, tier, self }) => enqueue({ name, tier, self }))

onUnmounted(() => {
  unsub()
  clearTimers()
})
</script>

<style scoped>
.badgeup {
  position: fixed;
  inset: 0;
  z-index: 2400;
  pointer-events: none;
  display: flex;
  justify-content: center;
  align-items: flex-start;
  padding-top: 12vh;
}
/* Your own crossing takes the centre of the screen. */
.badgeup.self {
  align-items: center;
  padding-top: 0;
}

.bu-card {
  pointer-events: auto;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--spacing-3);
  max-width: 90vw;
  padding: var(--spacing-6) var(--spacing-8);
  background: rgba(10, 10, 11, 0.82);
  border: 1px solid color-mix(in srgb, var(--bu-color) 55%, transparent);
  border-radius: 18px;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.55), 0 0 30px color-mix(in srgb, var(--bu-color) 25%, transparent);
  backdrop-filter: blur(6px);
  text-align: center;
  will-change: transform, opacity;
}
.badgeup:not(.self) .bu-card {
  flex-direction: row;
  gap: var(--spacing-4);
  padding: var(--spacing-3) var(--spacing-6);
}

.bu-kicker {
  font-family: var(--font-mono);
  font-size: 0.62rem;
  letter-spacing: 0.32em;
  color: color-mix(in srgb, var(--bu-color) 80%, #fff);
  text-transform: uppercase;
}
.badgeup:not(.self) .bu-kicker { display: none; }

.bu-line {
  margin: 0;
  font-family: var(--font-mono);
  font-size: 1rem;
  color: #e6e6e6;
}
.bu-name { color: #fff; }
.bu-title {
  font-family: var(--font-display), sans-serif;
  letter-spacing: 0.08em;
  text-shadow: 0 0 18px color-mix(in srgb, var(--bu-color) 60%, transparent);
}
.badgeup.self .bu-title { font-size: 1.5rem; display: block; margin-top: 4px; }

@media (prefers-reduced-motion: reduce) {
  .bu-card { will-change: auto; }
}
</style>
