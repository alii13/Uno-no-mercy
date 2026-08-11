<template>
  <FxDebugPanel v-if="showDebug" />
</template>

<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue'
import FxDebugPanel from './FxDebugPanel.vue'
import { useGameFx } from '../../composables/fx/useGameFx'
import {
  mountFxCanvas,
  unmountFxCanvas,
  resizeFxCanvas,
  burst,
  shockwave,
  spray,
  setHeat,
} from '../../composables/fx/useFxCanvas'

const showDebug =
  typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('fx') === '1'

const fx = useGameFx()
const unsubs: Array<() => void> = []

function center(el: HTMLElement): { x: number; y: number } {
  const r = el.getBoundingClientRect()
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 }
}

onMounted(() => {
  mountFxCanvas()
  window.addEventListener('resize', resizeFxCanvas)

  unsubs.push(
    fx.on('impact', ({ originEl, color, power }) => {
      const c = center(originEl)
      burst(c.x, c.y, color, power ? 20 : 10)
    }),
    fx.on('slam', ({ originEl, color, magnitude }) => {
      const c = center(originEl)
      shockwave(c.x, c.y, color, 170 + magnitude * 14)
      burst(c.x, c.y, color, 16)
    }),
    fx.on('stackSpray', ({ fromEl, toEl, color, count }) => {
      const a = center(fromEl)
      const b = center(toEl)
      spray(a.x, a.y, b.x, b.y, color, count * 3)
    }),
    fx.on('heat', ({ level }) => setHeat(level)),
  )
})

onUnmounted(() => {
  unsubs.forEach((u) => u())
  window.removeEventListener('resize', resizeFxCanvas)
  unmountFxCanvas()
})
</script>
