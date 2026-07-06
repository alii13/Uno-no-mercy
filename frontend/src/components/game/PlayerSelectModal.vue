<template>
  <Modal sheet :close-on-esc="false" aria-label="Select a player to swap hands with">
    <div class="select-card">
      <header class="select-header">
        <svg class="select-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="20" height="20">
          <path d="M16 3h5v5M4 20L21 3M21 16v5h-5M15 15l6 6M4 4l5 5" />
        </svg>
        <h3 class="select-title">SWAP HANDS</h3>
      </header>

      <p class="select-desc">Pick a player to swap your hand with.</p>

      <ul class="players-list">
        <li v-for="player in eligiblePlayers" :key="player.id">
          <button
            v-focus-ring
            class="player-btn"
            @click="$emit('select', player.id)"
          >
            <span class="player-name">{{ player.name }}</span>
            <span class="player-cards">{{ player.hand.length }} cards</span>
          </button>
        </li>
      </ul>

      <Button variant="ghost" size="md" block @click="$emit('skip')">
        KEEP MY HAND
      </Button>
    </div>
  </Modal>
</template>

<script setup lang="ts">
import type { Player } from '../../types/card'
import { vFocusRing } from '../../directives/focusRing'
import Modal from '../ui/Modal.vue'
import Button from '../ui/Button.vue'

defineProps<{
  eligiblePlayers: Player[]
}>()

defineEmits<{
  (e: 'select', playerId: string): void
  (e: 'skip'): void
}>()
</script>

<style scoped>
.select-card {
  background: linear-gradient(180deg, #18191b 0%, #0a0a0b 100%);
  border: 1px solid rgba(255, 204, 0, 0.2);
  border-radius: var(--radius-md);
  padding: var(--spacing-6);
  width: 100%;
  max-width: 420px;
  display: flex;
  flex-direction: column;
  gap: var(--spacing-4);
  box-shadow: 0 0 40px rgba(255, 204, 0, 0.1);
}

.select-header {
  display: flex;
  align-items: center;
  gap: var(--spacing-3);
}

.select-icon {
  color: var(--color-hazard);
  flex-shrink: 0;
}

.select-title {
  font-family: var(--font-display);
  font-size: var(--text-lg);
  color: var(--color-hazard);
  letter-spacing: 0.15em;
  margin: 0;
}

.select-desc {
  font-family: var(--font-body);
  font-size: var(--text-sm);
  color: var(--text-secondary);
  margin: 0;
}

.players-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: var(--spacing-2);
}

.player-btn {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--spacing-3);
  padding: var(--spacing-3) var(--spacing-4);
  background: rgba(0, 0, 0, 0.3);
  border: 1px solid rgba(255, 255, 255, 0.08);
  color: var(--text-primary);
  font-family: var(--font-body);
  font-size: var(--text-base);
  cursor: pointer;
  border-radius: var(--radius-sm);
  min-height: 44px;
  transition:
    border-color var(--duration-snap) var(--ease-snap),
    background var(--duration-snap) var(--ease-snap),
    transform var(--duration-snap) var(--ease-snap);
}

.player-btn:hover {
  border-color: var(--color-hazard);
  background: rgba(255, 204, 0, 0.06);
  transform: translateX(4px);
}

.player-name {
  font-weight: bold;
}

.player-cards {
  font-family: var(--font-mono);
  font-size: var(--text-xs);
  color: var(--text-muted);
  letter-spacing: 0.1em;
}

.player-btn:hover .player-cards {
  color: var(--color-hazard);
}

@media (max-width: 480px) {
  .select-card {
    padding: var(--spacing-4);
  }
}
</style>
