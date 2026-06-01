<template>
  <div v-if="retention.gamesPlayed > 0" class="stats-badge">
    <div v-if="retention.effectiveStreak > 0" class="streak-pill">
      <span class="flame" aria-hidden="true">{{ flameIcon }}</span>
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
import { computed } from 'vue'
import { useRetentionStore } from '../stores/retentionStore'

const retention = useRetentionStore()

// Pure-text flame so we don't need to depend on emoji rendering quirks.
// Falls back to a colored asterisk character.
const flameIcon = computed(() => '\u{1F525}')
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
  gap: 0.45rem;
  align-self: flex-start;
  font-size: 0.78rem;
  color: #ffcc00;
  text-shadow: 0 0 8px rgba(255, 204, 0, 0.35);
  letter-spacing: 0.1em;
  text-transform: uppercase;
}

.flame {
  font-size: 1rem;
  line-height: 1;
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
