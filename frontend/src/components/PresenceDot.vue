<template>
  <span
    class="pdot"
    :class="`pdot--${state}`"
    role="img"
    :aria-label="label"
    :title="label"
  />
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { presenceLabel, presenceState } from '../utils/relativeTime'
import { useNow } from '../composables/useClock'

const props = defineProps<{
  /** ISO timestamp from players_presence / my_friends. Null renders grey. */
  lastSeenAt?: string | null
}>()

// The dot ages on the app's one clock. A page left open for an hour must stop
// claiming the player is here, which is the one thing presence must not do -
// but fifty dots do not need fifty timers to notice it.
const now = useNow()

const state = computed(() => presenceState(props.lastSeenAt, now.value))
const label = computed(() => presenceLabel(props.lastSeenAt, now.value))
</script>

<style scoped>
.pdot {
  display: inline-block;
  flex: none;
  width: 7px;
  height: 7px;
  border-radius: 50%;
  /* A ring keeps the dot legible on both the dark chrome and the card art. */
  box-shadow: 0 0 0 1.5px rgba(0, 0, 0, 0.55);
}

.pdot--online {
  background: var(--color-neon-green);
  animation: pdot-pulse 2.4s ease-in-out infinite;
}

/* Amber, not green: they were here a moment ago and may still answer. */
.pdot--recent {
  background: #ffab2e;
}

.pdot--offline {
  background: rgba(255, 255, 255, 0.22);
}

@keyframes pdot-pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.4; }
}

@media (prefers-reduced-motion: reduce) {
  .pdot--online { animation: none; }
}
</style>
