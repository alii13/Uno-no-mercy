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
          :size="{ width: 140, height: 196 }" 
          :is-playable="isMyTurn && canPlay(card)"
          class="hand-card"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import Card from './Card.vue'
import { canPlayCard } from '../../utils/gameRules'
import { getCardStyle as getCardStyleUtil } from '../../utils/gameHelpers'
import type { Card as CardType, CardColor } from '../../types/card'

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

const hoverIndex = ref(-1)

function getCardStyle(index: number) {
  return getCardStyleUtil(index, props.hand.length, hoverIndex.value)
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
  height: 240px;
  display: flex;
  justify-content: center;
  align-items: flex-end;
  padding: 40px 20px 20px;
  overflow-x: auto;
  overflow-y: visible;
  width: 100%;
  scrollbar-width: thin;
  scrollbar-color: #444 transparent;
}

.player-hand::-webkit-scrollbar {
  height: 6px;
}

.player-hand::-webkit-scrollbar-track {
  background: transparent;
}

.player-hand::-webkit-scrollbar-thumb {
  background: #444;
  border-radius: 3px;
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
  margin-right: -50px;
  transform-origin: bottom center;
}

.hand-card-wrapper:last-child {
  margin-right: 0;
}

.hand-card-wrapper:hover {
  z-index: 9999 !important;
  transform: translateY(-60px) scale(1.15) !important;
}

.hand-card-wrapper:hover .hand-card {
  filter: drop-shadow(0 20px 30px rgba(0, 0, 0, 0.6));
}

.unplayable {
  opacity: 0.6;
  filter: grayscale(1) brightness(0.6);
  transform: translateY(10px);
}

.hand-card-wrapper:hover .unplayable {
  transform: translateY(-50px) scale(1.1);
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
  transform: translateY(-30px) scale(1.05) !important;
}
</style>
