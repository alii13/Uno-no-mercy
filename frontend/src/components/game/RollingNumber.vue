<template>
  <span class="rolling-number" :class="{ bumped }" aria-hidden="true">
    <span
      v-for="(d, i) in digits"
      :key="i"
      class="rn-col"
    >
      <span class="rn-strip" :style="{ transform: `translateY(${-d * 10}%)` }">
        <span v-for="n in 10" :key="n" class="rn-digit">{{ n - 1 }}</span>
      </span>
    </span>
  </span>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'

const props = defineProps<{ value: number }>()

// Digits of the (non-negative, integer) value as an array, most significant
// first. Each becomes a column whose 0-9 strip slides to the right digit.
const digits = computed(() =>
  Math.max(0, Math.round(props.value))
    .toString()
    .split('')
    .map(Number),
)

// A quick scale punch each time the value changes, so a jump reads as an event
// even when the digit count is unchanged (+4 -> +6).
const bumped = ref(false)
let bumpTimer: ReturnType<typeof setTimeout> | null = null
watch(
  () => props.value,
  (now, prev) => {
    if (now === prev) return
    bumped.value = false
    // Force a reflow so the class re-adds cleanly on rapid changes.
    void document.body.offsetWidth
    bumped.value = true
    if (bumpTimer) clearTimeout(bumpTimer)
    bumpTimer = setTimeout(() => (bumped.value = false), 260)
  },
)
</script>

<style scoped>
.rolling-number {
  display: inline-flex;
  vertical-align: baseline;
  font-variant-numeric: tabular-nums;
  transition: transform 0.18s cubic-bezier(0.34, 1.56, 0.64, 1);
}
.rolling-number.bumped {
  transform: scale(1.28);
}
.rn-col {
  display: inline-block;
  height: 1em;
  overflow: hidden;
  line-height: 1;
}
.rn-strip {
  display: flex;
  flex-direction: column;
  transition: transform 0.34s cubic-bezier(0.22, 1, 0.36, 1);
  will-change: transform;
}
.rn-digit {
  height: 1em;
  line-height: 1;
  text-align: center;
}
@media (prefers-reduced-motion: reduce) {
  .rn-strip {
    transition: none;
  }
  .rolling-number.bumped {
    transform: none;
  }
}
</style>
