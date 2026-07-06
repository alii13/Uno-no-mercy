<template>
  <Modal sheet :close-on-esc="false" aria-label="Pick the top card">
    <div class="picker-card">
      <header class="picker-header">
        <svg class="picker-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="20" height="20">
          <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
          <line x1="12" y1="9" x2="12" y2="13" />
          <line x1="12" y1="17" x2="12.01" y2="17" />
        </svg>
        <h3 class="picker-title">PICK TOP CARD</h3>
      </header>

      <p class="picker-desc">
        All cards discard at once. The one you pick determines what your opponent
        can play next.
      </p>

      <div class="cards-grid">
        <button
          v-for="card in cards"
          :key="card.id"
          v-focus-ring
          class="pick-card-btn"
          :aria-label="`Pick ${card.color} ${card.type}`"
          @click="$emit('select', card.id)"
        >
          <Card
            :card="card"
            :size="cardSize"
            :is-playable="true"
            class="pick-card"
          />
        </button>
      </div>
    </div>
  </Modal>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { Card as CardType } from '../../types/card'
import Card from './Card.vue'
import { useScreenSize } from '../../composables/useScreenSize'
import { vFocusRing } from '../../directives/focusRing'
import Modal from '../ui/Modal.vue'

defineProps<{
  cards: CardType[]
}>()

const { isMobile, isTablet } = useScreenSize()

const cardSize = computed(() => {
  if (isMobile.value) return { width: 76, height: 106 }
  if (isTablet.value) return { width: 96, height: 134 }
  return { width: 112, height: 156 }
})

defineEmits<{
  (e: 'select', cardId: string): void
}>()
</script>

<style scoped>
.picker-card {
  background: linear-gradient(180deg, #18191b 0%, #0a0a0b 100%);
  border: 1px solid rgba(255, 204, 0, 0.25);
  border-radius: var(--radius-md);
  padding: var(--spacing-6);
  max-width: min(680px, 92vw);
  display: flex;
  flex-direction: column;
  gap: var(--spacing-4);
  box-shadow: 0 0 50px rgba(255, 204, 0, 0.12);
}

.picker-header {
  display: flex;
  align-items: center;
  gap: var(--spacing-3);
}

.picker-icon {
  color: var(--color-hazard);
  flex-shrink: 0;
}

.picker-title {
  font-family: var(--font-display);
  font-size: var(--text-lg);
  color: var(--color-hazard);
  letter-spacing: 0.15em;
  margin: 0;
}

.picker-desc {
  font-family: var(--font-body);
  font-size: var(--text-sm);
  color: var(--text-secondary);
  margin: 0;
  line-height: 1.5;
}

.cards-grid {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: var(--spacing-3);
  padding: var(--spacing-2) 0;
}

.pick-card-btn {
  background: none;
  border: none;
  padding: 0;
  cursor: pointer;
  border-radius: var(--radius-md);
  transition:
    transform var(--duration-snap) var(--ease-snap),
    filter var(--duration-snap) var(--ease-snap);
}

.pick-card-btn:hover {
  transform: translateY(-6px) scale(1.04);
  filter: brightness(1.15);
}

.pick-card-btn:hover :deep(.pick-card) {
  box-shadow: 0 0 24px rgba(0, 243, 255, 0.6);
}

@media (max-width: 480px) {
  .picker-card {
    padding: var(--spacing-4);
  }

  .picker-title {
    font-size: var(--text-base);
  }

  .picker-desc {
    font-size: var(--text-xs);
  }
}
</style>
