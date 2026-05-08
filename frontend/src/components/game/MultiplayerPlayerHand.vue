<template>
  <div class="player-hand" :class="{ 'not-my-turn': !isMyTurn }">
    <div class="cards-container">
      <div 
        v-for="(card, index) in hand" 
        :key="card.id"
        class="hand-card-wrapper"
        :class="{ 
          'unplayable': isMyTurn && !canPlay(card),
          'playable-glow': isMyTurn && canPlay(card)
        }"
        :style="getCardStyle(index)"
        @mouseenter="hoverIndex = index"
        @mouseleave="hoverIndex = -1"
        @click="handleCardClick(card)"
      >
        <Card
          :card="card"
          :size="cardSize"
          :is-playable="isMyTurn && canPlay(card)"
          class="hand-card"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import Card from './Card.vue'
import { canPlayCard } from '../../utils/gameRules'
import { getCardStyle as getCardStyleUtil } from '../../utils/gameHelpers'
import type { Card as CardType, CardColor } from '../../types/card'
import { useScreenSize } from '../../composables/useScreenSize'

const props = defineProps<{
  hand: CardType[]
  isMyTurn: boolean
  currentColor: CardColor
  topCard: CardType | undefined
  drawStack: number
}>()

const emit = defineEmits<{
  (e: 'playCard', card: CardType): void
}>()

const { isMobile, isTablet } = useScreenSize()
const hoverIndex = ref(-1)

const cardSize = computed(() => {
  if (isMobile.value) return { width: 65, height: 91 }
  if (isTablet.value) return { width: 80, height: 112 }
  return { width: 100, height: 140 }
})

function getCardStyle(index: number) {
  return getCardStyleUtil(index, props.hand.length, hoverIndex.value, isMobile.value)
}

function canPlay(card: CardType): boolean {
  if (!props.isMyTurn || !props.topCard) return false
  return canPlayCard(card, props.topCard, props.currentColor, props.drawStack)
}

function handleCardClick(card: CardType) {
  if (!canPlay(card)) return
  emit('playCard', card)
}
</script>

<style scoped>
.player-hand {
  position: relative;
  height: 200px;
  display: flex;
  justify-content: center;
  align-items: flex-end;
  padding: 50px 20px 10px;
  overflow: visible;
  width: 100%;
}

.cards-container {
  display: flex;
  justify-content: center;
  align-items: flex-end;
  perspective: 1000px;
  flex-shrink: 0;
}

.hand-card-wrapper {
  position: relative;
  transition: transform 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275);
  cursor: pointer;
  margin-right: -35px;
  transform-origin: bottom center;
}

.hand-card-wrapper:last-child {
  margin-right: 0;
}

.hand-card-wrapper:hover {
  z-index: 9999 !important;
  transform: translateY(-40px) scale(1.12) !important;
}

.hand-card-wrapper:hover .hand-card {
  filter: drop-shadow(0 20px 30px rgba(0, 0, 0, 0.6));
}

.unplayable {
  opacity: 0.7;
  filter: brightness(0.75);
  transform: translateY(10px);
}

.hand-card-wrapper:hover .unplayable {
  transform: translateY(-30px) scale(1.05);
  opacity: 1;
  filter: grayscale(0);
}

.playable-glow .hand-card {
  box-shadow: 0 0 15px rgba(0, 243, 255, 0.5);
  border: 1px solid rgba(0, 243, 255, 0.8);
  border-radius: 8px;
  animation: pulse-glow 2s infinite;
}

@keyframes pulse-glow {
  0% { box-shadow: 0 0 10px rgba(0, 243, 255, 0.3); border-color: rgba(0, 243, 255, 0.6); }
  50% { box-shadow: 0 0 25px rgba(0, 243, 255, 0.8); border-color: rgba(0, 243, 255, 1); }
  100% { box-shadow: 0 0 10px rgba(0, 243, 255, 0.3); border-color: rgba(0, 243, 255, 0.6); }
}

/* When it's not the player's turn, gray out all cards */
.not-my-turn .cards-container {
  filter: grayscale(0.7) brightness(0.7);
  opacity: 0.7;
}

.not-my-turn .hand-card-wrapper {
  cursor: not-allowed;
}

.not-my-turn .hand-card-wrapper:hover {
  transform: translateY(-20px) scale(1.05) !important;
}

@media (max-width: 768px) {
  .player-hand {
    height: 160px;
    padding: 30px 10px 10px;
  }

  .hand-card-wrapper {
    margin-right: -25px;
  }

  .hand-card-wrapper:hover {
    transform: translateY(-30px) scale(1.1) !important;
  }
}

@media (max-width: 480px) {
  .player-hand {
    height: 120px;
    padding: 15px 5px 5px;
    overflow-x: auto;
    overflow-y: visible;
  }

  .cards-container {
    min-width: min-content;
  }

  .hand-card-wrapper {
    margin-right: -18px;
  }

  .hand-card-wrapper:hover {
    transform: translateY(-20px) scale(1.08) !important;
  }

  .not-my-turn .hand-card-wrapper:hover {
    transform: translateY(-10px) scale(1.03) !important;
  }
}
</style>
