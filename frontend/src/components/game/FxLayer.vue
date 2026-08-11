<template>
  <FxDebugPanel v-if="showDebug" />
</template>

<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue'
import gsap from 'gsap'
import FxDebugPanel from './FxDebugPanel.vue'
import { useGameFx, type FxColor } from '../../composables/fx/useGameFx'
import {
  mountFxCanvas,
  unmountFxCanvas,
  resizeFxCanvas,
  isFxCanvasAvailable,
  burst,
  shockwave,
  spray,
  setHeat,
} from '../../composables/fx/useFxCanvas'
import { burstImpactParticles } from '../../composables/useGameFeel'
import { useMotion } from '../../composables/useMotion'

const showDebug =
  typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('fx') === '1'

const EDGE_GLOW: Record<FxColor, string> = {
  red: 'rgba(255,42,42,0.55)',
  blue: 'rgba(0,191,255,0.5)',
  green: 'rgba(0,255,102,0.5)',
  yellow: 'rgba(255,204,0,0.5)',
  wild: 'rgba(255,102,221,0.55)',
}

const fx = useGameFx()
const unsubs: Array<() => void> = []

function center(el: HTMLElement): { x: number; y: number } {
  const r = el.getBoundingClientRect()
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 }
}

function discardCenter(): { x: number; y: number } | null {
  const el = document.querySelector('.discard-station') as HTMLElement | null
  return el ? center(el) : null
}

/** Brief full-screen edge flash in the card colour when a power card slams. */
function edgeFlash(color: FxColor): void {
  if (useMotion().reduced) return
  const el = document.createElement('div')
  el.style.cssText = `
    position: fixed; inset: 0; pointer-events: none; z-index: 899;
    box-shadow: inset 0 0 120px 20px ${EDGE_GLOW[color]};
    opacity: 0; will-change: opacity;
  `
  document.body.appendChild(el)
  gsap
    .timeline({ onComplete: () => el.remove() })
    .to(el, { opacity: 1, duration: 0.08, ease: 'power2.out' })
    .to(el, { opacity: 0, duration: 0.32, ease: 'power2.in' })
}

onMounted(() => {
  mountFxCanvas()
  window.addEventListener('resize', resizeFxCanvas)

  unsubs.push(
    // Card landed on the pile. WebGL burst when the canvas is up, DOM shards
    // (useGameFeel) as the reduced/low-tier/context-loss fallback.
    fx.on('impact', ({ originEl, color, power }) => {
      if (isFxCanvasAvailable()) {
        const c = center(originEl)
        burst(c.x, c.y, color, power ? 20 : 10)
      } else {
        burstImpactParticles(originEl, color, power ? 12 : 8)
      }
    }),
    // Power card slam: shockwave ring + a screen-edge flash. The burst comes
    // from the paired `impact` emit, so this adds only the heavier layer.
    fx.on('slam', ({ originEl, color, magnitude }) => {
      edgeFlash(color)
      if (!isFxCanvasAvailable()) return
      const c = center(originEl)
      shockwave(c.x, c.y, color, 170 + magnitude * 14)
    }),
    // Draw stack eaten: particle spray from the pile toward the victim seat.
    fx.on('stackSpray', ({ fromEl, toEl, color, count }) => {
      if (!isFxCanvasAvailable()) return
      const a = center(fromEl)
      const b = center(toEl)
      spray(a.x, a.y, b.x, b.y, color, count * 3)
    }),
    // Ambient table heat, anchored to the discard pile.
    fx.on('heat', ({ level }) => setHeat(level, discardCenter() ?? undefined)),
  )
})

onUnmounted(() => {
  unsubs.forEach((u) => u())
  window.removeEventListener('resize', resizeFxCanvas)
  unmountFxCanvas()
})
</script>
