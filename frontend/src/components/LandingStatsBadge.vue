<template>
  <div v-if="retention.gamesPlayed > 0" class="stats-badge">
    <div v-if="retention.effectiveStreak > 0" class="streak-pill">
      <Flame class="streak-icon" :stroke-width="2.25" aria-hidden="true" />
      <span class="streak-num">{{ retention.effectiveStreak }}</span>
      <span class="streak-label">day{{ retention.effectiveStreak > 1 ? 's' : '' }}</span>
    </div>

    <div class="stat-row">
      <div class="stat-cell">
        <div class="stat-value">{{ retention.gamesWon }}</div>
        <div class="stat-label">WINS</div>
      </div>
      <div class="stat-cell">
        <div class="stat-value">{{ retention.winRate }}%</div>
        <div class="stat-label">WIN RATE</div>
      </div>
      <div class="stat-cell">
        <div class="stat-value">{{ retention.biggestStackEver }}</div>
        <div class="stat-label">BIG STACK</div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { Flame } from 'lucide-vue-next'
import { useRetentionStore } from '../stores/retentionStore'

const retention = useRetentionStore()
</script>

<style scoped>
.stats-badge {
  display: inline-flex;
  flex-direction: column;
  gap: 0.5rem;
  padding: 0.6rem 0.85rem;
  border: 1px solid rgba(255, 204, 0, 0.18);
  background: rgba(0, 0, 0, 0.45);
  border-radius: 4px;
  font-family: 'Chakra Petch', sans-serif;
  color: #e6e6e6;
  min-width: 220px;
}

.streak-pill {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  align-self: flex-start;
  font-size: 0.78rem;
  color: #ffcc00;
  text-shadow: 0 0 8px rgba(255, 204, 0, 0.35);
  letter-spacing: 0.1em;
  text-transform: uppercase;
  line-height: 1;
}

.streak-icon {
  width: 14px;
  height: 14px;
  flex-shrink: 0;
  /* Emoji had its own internal padding that broke baseline align;
     SVG is bounded by its viewBox so it sits flush with the text. */
  color: #ffcc00;
  filter: drop-shadow(0 0 4px rgba(255, 204, 0, 0.5));
}

.streak-num {
  font-family: 'Black Ops One', 'Impact', sans-serif;
  font-size: 1.05rem;
}

.streak-label {
  color: #a1a1aa;
  font-size: 0.72rem;
}

.stat-row {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 0.5rem;
}

.stat-cell {
  text-align: left;
}

.stat-value {
  font-family: 'Black Ops One', 'Impact', sans-serif;
  font-size: 1.2rem;
  color: #e6e6e6;
  line-height: 1;
}

.stat-label {
  font-size: 0.58rem;
  letter-spacing: 0.18em;
  color: #52525b;
  margin-top: 0.2rem;
  text-transform: uppercase;
}
</style>
