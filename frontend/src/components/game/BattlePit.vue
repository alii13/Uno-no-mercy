<template>
  <div class="battle-pit">
    <!-- Table surface — felt-style ambient radial gradient + soft top light -->
    <div class="pit-surface" aria-hidden="true"></div>

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

    <!-- Status strip: direction · color · stack · MERCY meter (tension bar) -->
    <div class="pit-hud" v-if="myCardCount !== undefined || drawStack !== undefined">
      <div class="hud-cell hud-direction" :class="{ ccw: direction === -1 }" :aria-label="direction === 1 ? 'Clockwise' : 'Counter-clockwise'">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14" aria-hidden="true">
          <polyline points="23 4 23 10 17 10" />
          <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
        </svg>
        <span>{{ direction === 1 ? 'CW' : 'CCW' }}</span>
      </div>

      <div v-if="currentColor && currentColor !== 'wild'" class="hud-cell hud-color">
        <span class="color-dot" :class="`dot-${currentColor}`" aria-hidden="true"></span>
        <span>{{ currentColor.toUpperCase() }}</span>
      </div>

      <div v-if="drawStack && drawStack > 0" class="hud-cell hud-stack" :class="{ critical: drawStack >= 12 }">
        <span class="stack-label">STACK</span>
        <span class="stack-value">+{{ drawStack }}</span>
      </div>

      <!-- Mercy meter — UNO No Mercy's signature tension element. Fills toward
           25 cards (the elimination threshold). Glows red in the danger zone. -->
      <div v-if="myCardCount !== undefined" class="hud-cell hud-mercy" :class="mercyClass">
        <div class="mercy-head">
          <span class="mercy-label">MERCY</span>
          <span class="mercy-value">{{ myCardCount }}<span class="mercy-of">/25</span></span>
        </div>
        <div class="mercy-bar" role="progressbar" :aria-valuenow="myCardCount" aria-valuemin="0" aria-valuemax="25">
          <div class="mercy-fill" :style="{ width: mercyPct + '%' }"></div>
        </div>
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

defineEmits<{
  draw: []
  'toggle-sound': []
}>()

const discardAreaRef = ref<HTMLElement | null>(null)

defineExpose({
  discardAreaRef,
})
</script>
