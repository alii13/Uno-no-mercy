<template>
  <div class="stackcam" :class="{ active: phase !== 'idle', revealing: phase === 'reveal' }" @click="onClick">
    <div class="sc-dim" aria-hidden="true"></div>
    <div class="sc-bar sc-top" aria-hidden="true"></div>
    <div class="sc-bar sc-bottom" aria-hidden="true"></div>

    <div class="sc-pot" :style="accent" aria-hidden="true">
      <span class="sc-plus">+</span><RollingNumber :value="amount" class="sc-count" />
      <span class="sc-label">STACK</span>
    </div>

    <div class="sc-banner" :style="accent" role="status">
      <span class="sc-banner-amt">+{{ amount }}</span>
      <span class="sc-banner-arrow">▸</span>
      <span class="sc-banner-name">{{ victimName }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onUnmounted } from 'vue'
import gsap from 'gsap'
import RollingNumber from './RollingNumber.vue'
import { useGameFx, type FxColor } from '../../composables/fx/useGameFx'
import { setHeat, spray, burst, isFxCanvasAvailable } from '../../composables/fx/useFxCanvas'
import { useMotion } from '../../composables/useMotion'

const ACCENT: Record<FxColor, string> = {
  red: '#ff2a2a',
  blue: '#00bfff',
  green: '#00ff66',
  yellow: '#ffcc00',
  wild: '#ff66dd',
}

const phase = ref<'idle' | 'active' | 'reveal'>('idle')
const amount = ref(0)
const color = ref<FxColor>('red')
const victimName = ref('')

const accent = computed(() => ({ '--sc-color': ACCENT[color.value] }))

const fx = useGameFx()
const timers: ReturnType<typeof setTimeout>[] = []
let rampRaf = 0

function clearTimers() {
  timers.forEach(clearTimeout)
  timers.length = 0
}
function after(ms: number, fn: () => void) {
  timers.push(setTimeout(fn, ms))
}

function discardCenter(): { x: number; y: number } | null {
  const el = document.querySelector('.discard-station') as HTMLElement | null
  if (!el) return null
  const r = el.getBoundingClientRect()
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 }
}

// Ramp gsap's global time-scale in real time (rAF, so the ramp itself isn't
// slowed by the very scaling it applies to the game's card tweens).
function rampTimeScale(from: number, to: number, ms: number) {
  cancelAnimationFrame(rampRaf)
  const start = performance.now()
  gsap.globalTimeline.timeScale(from)
  const step = (now: number) => {
    const t = Math.min(1, (now - start) / ms)
    const eased = 1 - Math.pow(1 - t, 3)
    gsap.globalTimeline.timeScale(from + (to - from) * eased)
    if (t < 1) rampRaf = requestAnimationFrame(step)
  }
  rampRaf = requestAnimationFrame(step)
}

function standDown() {
  clearTimers()
  cancelAnimationFrame(rampRaf)
  gsap.globalTimeline.timeScale(1)
  setHeat(0)
  phase.value = 'idle'
}

function ignite(amt: number, c: FxColor) {
  amount.value = amt
  color.value = c
  if (phase.value === 'active') return // already up — RollingNumber rolls to the new amount
  phase.value = 'active'
  if (useMotion().reduced) return
  // A brief bullet-time punch, then back to real speed so the hold (waiting for
  // a human to stack or eat) never feels broken.
  rampTimeScale(0.3, 1, 480)
  const pile = discardCenter()
  if (pile) setHeat(1, pile)
}

function reveal(amt: number, c: FxColor, victimEl: HTMLElement | null, name: string) {
  amount.value = amt
  color.value = c
  victimName.value = name
  if (!victimEl) {
    standDown()
    return
  }
  phase.value = 'reveal'
  if (!useMotion().reduced && isFxCanvasAvailable()) {
    const pile = discardCenter()
    const vr = victimEl.getBoundingClientRect()
    const to = { x: vr.left + vr.width / 2, y: vr.top + vr.height / 2 }
    if (pile) {
      spray(pile.x, pile.y, to.x, to.y, c, Math.min(amt * 4, 60))
      after(180, () => burst(to.x, to.y, c, 18))
    }
  }
  // Hold the reveal, then stand down. Skippable via onClick.
  after(useMotion().reduced ? 1100 : 1600, standDown)
}

function onClick() {
  if (phase.value === 'reveal') standDown()
}

const unsubs = [
  fx.on('stackCamActive', ({ amount: a, color: c }) => ignite(a, c)),
  fx.on('stackCamReveal', ({ amount: a, color: c, victimEl, victimName: n }) => reveal(a, c, victimEl, n)),
]

onUnmounted(() => {
  unsubs.forEach((u) => u())
  standDown()
})
</script>

<style scoped>
.stackcam {
  position: fixed;
  inset: 0;
  pointer-events: none;
}
/* Reveal-only: catch a tap anywhere to skip. */
.stackcam.revealing {
  pointer-events: auto;
}

/* Radial spotlight dim. The whole cinematic band sits ABOVE the flying/thrown
   card clones (z 1000-2100 from useCardAnimations / useGameFeel) so a card in
   flight during a stack build can't cover the cam. Order within the band:
   dim < washes < FX canvas < letterbox < pot/banner < KO flash. */
.sc-dim {
  position: fixed;
  inset: 0;
  z-index: 2100;
  background: radial-gradient(ellipse at center, transparent 20%, rgba(0, 0, 0, 0.72) 78%);
  opacity: 0;
  transition: opacity 0.4s ease-out;
  pointer-events: none;
}
.stackcam.active .sc-dim { opacity: 0.5; }
.stackcam.revealing .sc-dim { opacity: 1; }

/* Cinematic letterbox bars — above everything. */
.sc-bar {
  position: fixed;
  left: 0;
  right: 0;
  height: 9vh;
  z-index: 2200;
  background: #000;
  transition: transform 0.42s cubic-bezier(0.16, 1, 0.3, 1);
  pointer-events: none;
}
.sc-top { top: 0; transform: translateY(-100%); }
.sc-bottom { bottom: 0; transform: translateY(100%); }
.stackcam.active .sc-top,
.stackcam.active .sc-bottom { transform: translateY(0); }

/* The pot counter — slams in above the pit during the hold. */
.sc-pot {
  position: fixed;
  top: 16vh;
  left: 50%;
  z-index: 2210;
  display: flex;
  align-items: baseline;
  gap: 0.1em;
  color: var(--sc-color, #ff2a2a);
  font-family: var(--font-display), sans-serif;
  font-size: clamp(2.4rem, 9vw, 5rem);
  font-weight: 800;
  letter-spacing: 0.04em;
  /* Glow via filter, not text-shadow: the odometer columns are overflow:hidden
     to clip the digit roll, which would box-clip a per-glyph text-shadow. A
     filter on the pot applies after that clipping, so the glow stays soft. */
  filter: drop-shadow(0 0 16px var(--sc-color, #ff2a2a)) drop-shadow(0 4px 10px rgba(0, 0, 0, 0.7));
  transform: translate(-50%, -20px) scale(0.6);
  opacity: 0;
  transition: transform 0.32s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.24s ease-out;
  pointer-events: none;
}
.stackcam.active .sc-pot { transform: translate(-50%, 0) scale(1); opacity: 1; }
.sc-plus { font-size: 0.6em; opacity: 0.85; }
.sc-label {
  font-size: 0.28em;
  letter-spacing: 0.4em;
  align-self: center;
  margin-left: 0.4em;
  opacity: 0.8;
}

/* The victim reveal banner. */
.sc-banner {
  position: fixed;
  top: 50%;
  left: 50%;
  z-index: 2210;
  display: flex;
  align-items: center;
  gap: 0.4em;
  max-width: 94vw;
  white-space: nowrap;
  color: #fff;
  font-family: var(--font-display), sans-serif;
  font-size: clamp(1.6rem, 6vw, 3.2rem);
  letter-spacing: 0.06em;
  text-shadow: 0 0 24px var(--sc-color, #ff2a2a), 0 4px 14px rgba(0, 0, 0, 0.8);
  transform: translate(-50%, -50%) scale(1.35);
  opacity: 0;
  transition: transform 0.28s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.22s ease-out;
  pointer-events: none;
}
.stackcam.revealing .sc-banner { transform: translate(-50%, -50%) scale(1); opacity: 1; }
.sc-banner-amt { color: var(--sc-color, #ff2a2a); font-weight: 800; flex: none; }
.sc-banner-arrow { color: var(--sc-color, #ff2a2a); opacity: 0.8; flex: none; }
.sc-banner-name { font-weight: 700; min-width: 0; overflow: hidden; text-overflow: ellipsis; }

@media (prefers-reduced-motion: reduce) {
  .sc-bar { transition: none; }
  .sc-pot, .sc-banner, .sc-dim { transition: opacity 0.2s ease-out; }
  .stackcam.active .sc-pot { transform: translate(-50%, 0) scale(1); }
  .stackcam.revealing .sc-banner { transform: translate(-50%, -50%) scale(1); }
  /* No letterbox slide under reduced motion; keep bars out of the way. */
  .stackcam.active .sc-top { transform: translateY(-100%); }
  .stackcam.active .sc-bottom { transform: translateY(100%); }
}
</style>
