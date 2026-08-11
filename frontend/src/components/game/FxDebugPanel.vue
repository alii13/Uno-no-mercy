<template>
  <div class="fx-debug" role="group" aria-label="FX debug panel">
    <div class="fx-debug-title">FX DEBUG</div>

    <div class="fx-stats">
      <span>{{ stats.fps }} fps</span>
      <span>{{ stats.particles }} p</span>
      <span>{{ stats.drawCalls }} dc</span>
      <span class="fx-tier">{{ stats.tier }}</span>
    </div>

    <div class="fx-row">
      <label>color</label>
      <select v-model="color">
        <option v-for="c in colors" :key="c" :value="c">{{ c }}</option>
      </select>
    </div>

    <div class="fx-buttons">
      <button @click="fire('impact', { power: false })">impact</button>
      <button @click="fire('impact', { power: true })">impact +power</button>
      <button @click="fire('slam')">slam</button>
      <button @click="fire('spray')">stack spray</button>
      <button @click="camIgnite">cam ignite</button>
      <button @click="camReveal">cam reveal</button>
    </div>

    <div class="fx-row">
      <label>slam +{{ magnitude }}</label>
      <input type="range" min="2" max="24" step="2" v-model.number="magnitude" />
    </div>

    <div class="fx-row">
      <label>heat {{ heat.toFixed(2) }}</label>
      <input type="range" min="0" max="1" step="0.05" v-model.number="heat" @input="applyHeat" />
    </div>

    <div class="fx-row">
      <label><input type="checkbox" v-model="slowmo" @change="applySlowmo" /> slow-mo</label>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted, onUnmounted } from 'vue'
import gsap from 'gsap'
import { useGameFx, type FxColor } from '../../composables/fx/useGameFx'
import { getFxStats } from '../../composables/fx/useFxCanvas'

const fx = useGameFx()
const colors: FxColor[] = ['red', 'blue', 'green', 'yellow', 'wild']
const color = ref<FxColor>('red')
const magnitude = ref(10)
const heat = ref(0)
const slowmo = ref(false)

const stats = reactive({ fps: 0, particles: 0, drawCalls: 0, tier: '' })
let statsTimer: ReturnType<typeof setInterval> | null = null

// Resolve the discard pile as the effect anchor; fall back to the viewport
// center so the panel still demonstrates effects outside a live game.
function anchor(): HTMLElement {
  return (document.querySelector('.discard-station') as HTMLElement | null) ?? document.body
}

function seatAnchor(): HTMLElement {
  const seats = document.querySelectorAll('.opponent-chip, [data-seat]')
  return (seats[0] as HTMLElement | undefined) ?? document.body
}

function fire(event: 'impact' | 'slam' | 'spray', opts: { power?: boolean } = {}): void {
  const originEl = anchor()
  if (event === 'impact') fx.emit('impact', { originEl, color: color.value, power: !!opts.power })
  else if (event === 'slam') fx.emit('slam', { originEl, color: color.value, magnitude: magnitude.value })
  else fx.emit('stackSpray', { fromEl: originEl, toEl: seatAnchor(), color: color.value, count: 10 })
}

function applyHeat(): void {
  fx.emit('heat', { level: heat.value })
}

function camIgnite(): void {
  fx.emit('stackCamActive', { amount: magnitude.value, color: color.value })
}

function camReveal(): void {
  fx.emit('stackCamReveal', { amount: magnitude.value, color: color.value, victimEl: seatAnchor(), victimName: 'DECKWRECKER' })
}

function applySlowmo(): void {
  gsap.globalTimeline.timeScale(slowmo.value ? 0.25 : 1)
}

onMounted(() => {
  statsTimer = setInterval(() => Object.assign(stats, getFxStats()), 150)
})

onUnmounted(() => {
  if (statsTimer) clearInterval(statsTimer)
  gsap.globalTimeline.timeScale(1)
})
</script>

<style scoped>
.fx-debug {
  position: fixed;
  bottom: 12px;
  left: 12px;
  z-index: 3000;
  width: 190px;
  padding: 10px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  background: rgba(8, 6, 6, 0.92);
  border: 1px solid rgba(255, 42, 42, 0.5);
  border-radius: 8px;
  color: #eee;
  font-family: var(--font-mono, monospace);
  font-size: 11px;
  pointer-events: auto;
}
.fx-debug-title {
  color: #ff6666;
  letter-spacing: 0.18em;
  font-weight: 700;
}
.fx-stats {
  display: flex;
  gap: 8px;
  color: #9fe;
  font-variant-numeric: tabular-nums;
}
.fx-tier {
  margin-left: auto;
  color: #ffcc00;
}
.fx-row {
  display: flex;
  align-items: center;
  gap: 6px;
}
.fx-row label {
  flex: 0 0 auto;
  min-width: 64px;
  color: #bbb;
}
.fx-row input[type='range'] {
  flex: 1;
}
.fx-buttons {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 4px;
}
.fx-buttons button {
  padding: 4px 6px;
  background: rgba(255, 42, 42, 0.14);
  border: 1px solid rgba(255, 42, 42, 0.4);
  border-radius: 4px;
  color: #fff;
  cursor: pointer;
  font-size: 10px;
}
.fx-buttons button:hover {
  background: rgba(255, 42, 42, 0.28);
}
select {
  flex: 1;
  background: #1a1010;
  color: #fff;
  border: 1px solid #522;
  border-radius: 4px;
  padding: 2px;
}
</style>
