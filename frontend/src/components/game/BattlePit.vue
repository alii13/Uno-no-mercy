<template>
  <div class="battle-pit" :style="{ '--mercy-intensity': mercyIntensity }">
    <!-- Layer 1: Background pattern (diagonal industrial hatching, very low opacity) -->
    <div class="pit-hatching" aria-hidden="true"></div>

    <!-- Layer 2: Felt table surface with top-down light + dark vignette -->
    <div class="pit-surface" aria-hidden="true"></div>

    <!-- Layer 3: Danger gradient bleeding from top-right, intensity scales with Mercy % -->
    <div class="pit-danger-gradient" aria-hidden="true"></div>

    <!-- Layer 4: Oversized typographic watermark — the brand IS the composition.
         Sits behind the play area as low-opacity background type. -->
    <div class="pit-watermark" aria-hidden="true">
      <span class="wm-no">NO</span>
      <span class="wm-mercy">MERCY</span>
    </div>

    <!-- Layer 5: Left vertical rail — industrial control panel. Direction, color,
         stack, and a TALL Mercy thermometer. Desktop only. -->
    <aside class="pit-rail" aria-label="Game state">
      <div class="rail-cell rail-direction" :class="{ ccw: direction === -1 }" :title="direction === 1 ? 'Clockwise' : 'Counter-clockwise'">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16" aria-hidden="true">
          <polyline points="23 4 23 10 17 10" />
          <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
        </svg>
        <span>{{ direction === 1 ? 'CW' : 'CCW' }}</span>
      </div>

      <div v-if="currentColor && currentColor !== 'wild'" class="rail-cell rail-color">
        <span class="color-dot" :class="`dot-${currentColor}`" aria-hidden="true"></span>
        <span>{{ currentColor.toUpperCase() }}</span>
      </div>

      <div v-if="drawStack && drawStack > 0" class="rail-cell rail-stack" :class="{ critical: drawStack >= 12 }">
        <span class="rail-cell-label">STACK</span>
        <span class="rail-cell-value">+{{ drawStack }}</span>
      </div>

      <!-- Mercy thermometer — tall vertical bar, fills bottom→top toward 25 -->
      <div v-if="myCardCount !== undefined" class="rail-mercy" :class="mercyClass">
        <div class="mercy-track" role="progressbar" :aria-valuenow="myCardCount" aria-valuemin="0" aria-valuemax="25" aria-label="Mercy meter">
          <div class="mercy-fill" :style="{ height: mercyPct + '%' }"></div>
          <span class="mercy-tick mercy-tick-warn"></span>
          <span class="mercy-tick mercy-tick-crit"></span>
        </div>
        <div class="mercy-readout">
          <span class="mercy-num">{{ myCardCount }}</span>
          <span class="mercy-of">/25</span>
          <span class="mercy-label-text">MERCY</span>
        </div>
      </div>
    </aside>

    <!-- Layer 6: The play surface — asymmetric draw+discard pair with perspective -->
    <div class="pit-table">
      <div class="station draw-station" @click="$emit('draw')">
        <slot name="draw-pile"></slot>
        <div class="action-hint" v-if="showDrawHint">
          {{ drawHintText }}
        </div>
      </div>

      <div
        class="station discard-station"
        :class="currentColor && currentColor !== 'wild' ? `discard-color-${currentColor}` : ''"
        ref="discardAreaRef"
      >
        <slot name="discard-pile"></slot>
      </div>
    </div>

    <!-- Mobile HUD: horizontal pill below the table (rail collapses on small screens) -->
    <div class="pit-hud-mobile" v-if="myCardCount !== undefined">
      <div class="hud-cell">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="12" height="12" aria-hidden="true">
          <polyline points="23 4 23 10 17 10" />
          <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
        </svg>
        <span>{{ direction === 1 ? 'CW' : 'CCW' }}</span>
      </div>
      <div v-if="currentColor && currentColor !== 'wild'" class="hud-cell">
        <span class="color-dot" :class="`dot-${currentColor}`" aria-hidden="true"></span>
      </div>
      <div v-if="drawStack && drawStack > 0" class="hud-cell hud-stack-mobile" :class="{ critical: drawStack >= 12 }">+{{ drawStack }}</div>
      <div class="hud-cell hud-mercy-mobile" :class="mercyClass">
        <span class="mobile-mercy-bar">
          <span class="mobile-mercy-fill" :style="{ width: mercyPct + '%' }"></span>
        </span>
        <span class="mobile-mercy-text">{{ myCardCount }}/25</span>
      </div>
    </div>

    <!-- Transient game messages (roulette, swap selection, etc.) -->
    <div class="pit-toast">
      <slot name="status-panel"></slot>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useScreenSize } from '../../composables/useScreenSize'

const props = defineProps<{
  showDrawHint: boolean
  isMuted: boolean
  currentColor?: string
  direction?: number
  drawStack?: number
  myCardCount?: number
}>()

const { isMobile } = useScreenSize()
const drawHintText = computed(() => (isMobile.value ? 'TAP TO DRAW' : 'CLICK TO DRAW'))

const mercyPct = computed(() => {
  if (props.myCardCount === undefined) return 0
  return Math.min(100, (props.myCardCount / 25) * 100)
})

const mercyClass = computed(() => {
  const n = props.myCardCount ?? 0
  if (n >= 20) return 'critical'
  if (n >= 15) return 'warning'
  return ''
})

// Drives the danger-gradient bleed from top-right. 0 = none, 1 = max red.
const mercyIntensity = computed(() => {
  if (props.myCardCount === undefined) return 0
  return Math.min(1, props.myCardCount / 25)
})

defineEmits<{
  draw: []
  'toggle-sound': []
}>()

const discardAreaRef = ref<HTMLElement | null>(null)

defineExpose({
  discardAreaRef,
})
</script>
