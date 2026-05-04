<template>
  <div class="discard-picker-overlay">
    <div class="tactical-hud">
      <div class="hud-header">
        <span class="warning-icon">⚠</span>
        <span>DISCARD ALL</span>
      </div>

      <h3>SELECT TOP CARD</h3>
      <p class="subtitle">All cards will be discarded. Choose which one stays on top of the pile.</p>

      <div class="cards-grid">
        <div
          v-for="card in cards"
          :key="card.id"
          class="pick-card-wrapper"
          @click="$emit('select', card.id)"
        >
          <Card
            :card="card"
            :size="cardSize"
            :is-playable="true"
            class="pick-card"
          />
        </div>
      </div>

      <div class="hud-footer">
        TOP CARD DETERMINES WHAT OPPONENT CAN PLAY NEXT
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { Card as CardType } from '../../types/card'
import Card from './Card.vue'
import { useScreenSize } from '../../composables/useScreenSize'

defineProps<{
  cards: CardType[]
}>()

const { isMobile, isTablet } = useScreenSize()

const cardSize = computed(() => {
  if (isMobile.value) return { width: 80, height: 112 }
  if (isTablet.value) return { width: 100, height: 140 }
  return { width: 120, height: 168 }
})

defineEmits<{
  (e: 'select', cardId: string): void
}>()
</script>

<style scoped>
.discard-picker-overlay {
  position: fixed;
  top: 0; left: 0; right: 0; bottom: 0;
  background: rgba(0, 0, 0, 0.9);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 2000;
  backdrop-filter: blur(5px);
}

.tactical-hud {
  background: #111;
  border: 2px solid var(--color-hazard);
  padding: 2rem;
  max-width: 90vw;
  max-height: 80vh;
  position: relative;
  box-shadow: 0 0 50px rgba(255, 204, 0, 0.2);
  overflow-y: auto;
}

.hud-header {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 1rem;
  color: var(--color-hazard);
  font-family: 'Courier New', monospace;
  font-weight: bold;
  letter-spacing: 2px;
  margin-bottom: 1.5rem;
  border-bottom: 1px dashed var(--color-hazard-dim);
  padding-bottom: 1rem;
}

.warning-icon {
  font-size: 1.5rem;
  animation: blink 1s infinite;
}

@keyframes blink {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

h3 {
  text-align: center;
  color: white;
  font-family: var(--font-display);
  font-size: 1.8rem;
  margin-bottom: 0.5rem;
  letter-spacing: 2px;
}

.subtitle {
  text-align: center;
  color: var(--text-muted);
  font-family: 'Courier New', monospace;
  font-size: 0.85rem;
  margin-bottom: 1.5rem;
}

.cards-grid {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 1rem;
  padding: 0.5rem;
}

.pick-card-wrapper {
  cursor: pointer;
  transition: transform 0.2s, filter 0.2s;
  border-radius: 8px;
}

.pick-card-wrapper:hover {
  transform: translateY(-10px) scale(1.08);
  filter: brightness(1.2);
}

.pick-card-wrapper:hover .pick-card {
  box-shadow: 0 0 20px rgba(0, 243, 255, 0.7);
  border: 2px solid rgba(0, 243, 255, 0.9);
  border-radius: 8px;
}

.hud-footer {
  margin-top: 1.5rem;
  text-align: center;
  font-family: 'Courier New', monospace;
  font-size: 0.75rem;
  color: var(--text-muted);
  animation: blink 2s infinite;
}

@media (max-width: 480px) {
  .tactical-hud {
    padding: 1rem;
    max-height: 90vh;
  }

  h3 {
    font-size: 1.3rem;
  }

  .subtitle {
    font-size: 0.75rem;
  }

  .cards-grid {
    gap: 0.5rem;
  }

  .hud-footer {
    font-size: 0.65rem;
    margin-top: 1rem;
  }
}
</style>
