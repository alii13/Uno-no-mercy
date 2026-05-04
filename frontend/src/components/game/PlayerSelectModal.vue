<template>
  <div class="player-select-overlay">
    <div class="tactical-hud">
      <div class="hud-header header-hazard">
        <span class="warning-icon">⚠</span>
        <span>SELECT TARGET FOR HAND SWAP</span>
      </div>
      
      <div class="players-list">
        <button 
          v-for="player in eligiblePlayers" 
          :key="player.id"
          class="player-btn"
          @click="$emit('select', player.id)"
        >
          <div class="btn-inner">
            <span class="player-name">{{ player.name }}</span>
            <span class="card-count">{{ player.hand.length }} CARDS</span>
          </div>
        </button>
      </div>
      
      <div class="hud-footer">
        AUTHORIZATION REQUIRED...
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { Player } from '../../types/card'

defineProps<{
  eligiblePlayers: Player[]
}>()

defineEmits<{
  (e: 'select', playerId: string): void
}>()
</script>

<style scoped>
.player-select-overlay {
  position: fixed;
  top: 0; left: 0; right: 0; bottom: 0;
  background: rgba(0, 0, 0, 0.9);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 2100;
  backdrop-filter: blur(8px);
}

.tactical-hud {
  background: #111;
  border: 1px solid var(--color-hazard);
  padding: 2rem;
  width: 400px;
  box-shadow: 0 0 40px rgba(255, 204, 0, 0.1);
}

.hud-header {
  display: flex;
  align-items: center;
  gap: 1rem;
  color: var(--color-hazard);
  font-family: monospace;
  margin-bottom: 2rem;
  border-bottom: 1px dashed #444;
  padding-bottom: 1rem;
}

.header-hazard {
  animation: hazard-pulse 1s infinite alternate;
}

@keyframes hazard-pulse {
  from { opacity: 0.8; }
  to { opacity: 1; filter: brightness(1.2); }
}

.players-list {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.player-btn {
  background: #222;
  border: 1px solid #333;
  color: white;
  padding: 1rem;
  cursor: pointer;
  font-family: var(--font-display);
  transition: all 0.2s;
  text-align: left;
}

.btn-inner {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.player-btn:hover {
  background: #333;
  border-color: var(--color-hazard);
  transform: translateX(5px);
}

.card-count {
  font-size: 0.8rem;
  color: #888;
  font-family: monospace;
}

.hud-footer {
  margin-top: 2rem;
  text-align: right;
  font-family: monospace;
  font-size: 0.7rem;
  color: #444;
}

@media (max-width: 480px) {
  .tactical-hud {
    width: 95vw;
    padding: 1rem;
  }

  .hud-header {
    font-size: 0.75rem;
    gap: 0.5rem;
    margin-bottom: 1rem;
  }

  .player-btn {
    padding: 0.75rem;
  }
}

@media (max-width: 768px) and (min-width: 481px) {
  .tactical-hud {
    width: 90vw;
    padding: 1.5rem;
  }
}
</style>
