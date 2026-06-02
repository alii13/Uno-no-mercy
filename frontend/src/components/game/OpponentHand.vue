<template>
  <button
    type="button"
    class="opponent-chip"
    :class="{
      active: isActive,
      selectable: isSelectable,
      eliminated: player.isEliminated,
    }"
    :aria-label="`${player.name} has ${player.hand.length} cards${isActive ? ', current turn' : ''}`"
  >
    <span class="chip-avatar">{{ player.name.charAt(0).toUpperCase() }}</span>
    <span class="chip-meta">
      <span class="chip-name">{{ player.name }}</span>
      <span v-if="player.isEliminated" class="chip-status chip-elim">OUT</span>
      <span v-else class="chip-status chip-count">
        <span class="chip-count-num">{{ player.hand.length }}</span>
        <span class="chip-count-label">{{ player.hand.length === 1 ? 'card' : 'cards' }}</span>
      </span>
    </span>
  </button>
</template>

<script setup lang="ts">
import type { Player } from '../../types/card'

defineProps<{
  player: Player
  isActive: boolean
  isSelectable?: boolean
}>()
</script>

<style scoped>
.opponent-chip {
  display: inline-flex;
  align-items: center;
  gap: var(--spacing-3);
  padding: var(--spacing-2) var(--spacing-3) var(--spacing-2) var(--spacing-2);
  background: rgba(0, 0, 0, 0.4);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: var(--radius-pill);
  font-family: var(--font-mono);
  color: var(--text-secondary);
  cursor: default;
  min-height: 44px;
  transition:
    border-color var(--duration-soft) var(--ease-soft),
    background var(--duration-soft) var(--ease-soft),
    box-shadow var(--duration-soft) var(--ease-soft);
}

.opponent-chip.active {
  border-color: var(--color-neon-blue);
  background: rgba(0, 243, 255, 0.06);
  box-shadow: 0 0 16px rgba(0, 243, 255, 0.25);
  color: var(--text-primary);
}

.opponent-chip.selectable {
  cursor: pointer;
  border-color: var(--color-hazard);
  animation: chip-pulse 1.6s ease-in-out infinite;
}

.opponent-chip.selectable:hover {
  background: rgba(255, 204, 0, 0.1);
  transform: translateY(-1px);
}

@keyframes chip-pulse {
  0%, 100% { box-shadow: 0 0 8px rgba(255, 204, 0, 0.25); }
  50% { box-shadow: 0 0 18px rgba(255, 204, 0, 0.55); }
}

@media (prefers-reduced-motion: reduce) {
  .opponent-chip.selectable {
    animation: none;
  }
}

.opponent-chip.eliminated {
  opacity: 0.5;
  border-style: dashed;
}

.chip-avatar {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(255, 255, 255, 0.06);
  color: var(--text-primary);
  font-family: var(--font-display);
  font-size: var(--text-sm);
  flex-shrink: 0;
  transition: background var(--duration-soft) var(--ease-soft), color var(--duration-soft) var(--ease-soft);
}

.opponent-chip.active .chip-avatar {
  background: var(--color-neon-blue);
  color: var(--bg-concrete);
}

.chip-meta {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  line-height: 1.1;
  min-width: 0;
}

.chip-name {
  font-size: var(--text-xs);
  letter-spacing: 0.15em;
  color: var(--text-primary);
  text-transform: uppercase;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 130px;
}

.chip-status {
  display: inline-flex;
  align-items: baseline;
  gap: 4px;
  margin-top: 2px;
}

.chip-count-num {
  color: var(--color-hazard);
  font-family: var(--font-display);
  font-size: var(--text-sm);
}

.opponent-chip.active .chip-count-num {
  color: var(--color-neon-blue);
}

.chip-count-label {
  font-size: 0.65rem;
  letter-spacing: 0.15em;
  color: var(--text-muted);
  text-transform: uppercase;
}

.chip-elim {
  font-family: var(--font-display);
  font-size: var(--text-xs);
  letter-spacing: 0.2em;
  color: var(--color-alert);
}

@media (max-width: 480px) {
  .opponent-chip {
    padding: var(--spacing-1) var(--spacing-2);
    gap: var(--spacing-2);
  }

  .chip-avatar {
    width: 28px;
    height: 28px;
    font-size: var(--text-xs);
  }

  .chip-name {
    font-size: 0.65rem;
    max-width: 90px;
  }
}
</style>
