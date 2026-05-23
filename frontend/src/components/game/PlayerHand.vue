<template>
  <div class="player-hand" :class="{ 'not-my-turn': !isMyTurn }">
    <div class="cards-container" ref="handContainer">
      <div 
        v-for="(card, index) in hand" 
        :key="card.id"
        class="hand-card-wrapper"
        :class="{ 
          'unplayable': isMyTurn && !canPlay(card),
          'playable-glow': isMyTurn && canPlay(card)
        }"
        :ref="(el: any) => setCardRef(card.id, el)"
        :style="getCardStyle(index)"
        @mouseenter="hoverIndex = index"
        @mouseleave="hoverIndex = -1"
        @click="handleCardClick(card, $event)"
      >
        <Card
          :card="card"
          :size="cardSize"
          :is-playable="isMyTurn && canPlay(card)"
          class="hand-card"
        />
      </div>
    </div>

    <ColorPickerModal 
      v-if="showColorPicker"
      title="WILD CARD ACTIVATED"
      subtitle="CHOOSE NEXT COLOR"
      @select="handleColorSelect"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, inject, watch, type Ref, type ComponentPublicInstance } from 'vue'
import gsap from 'gsap'
import type { Card as CardType, CardColor } from '../../types/card'
import Card from './Card.vue'
import ColorPickerModal from './ColorPickerModal.vue'
import { useGameStore } from '../../stores/gameStore'
import { canPlayCard } from '../../utils/gameRules'
import { getCardStyle as getCardStyleUtil } from '../../utils/gameHelpers'
import { soundEffects } from '../../composables/useSoundEffects'
import { useScreenSize } from '../../composables/useScreenSize'

const props = defineProps<{
  hand: CardType[]
  isMyTurn: boolean
}>()

const store = useGameStore()
const { isMobile, isTablet } = useScreenSize()
const hoverIndex = ref(-1)

const cardSize = computed(() => {
  if (isMobile.value) return { width: 65, height: 91 }
  if (isTablet.value) return { width: 80, height: 112 }
  return { width: 100, height: 140 }
})
const cardRefs = ref<Map<string, HTMLElement>>(new Map())
const showColorPicker = ref(false)
const pendingWildCard = ref<CardType | null>(null)

// Safety: Auto-close color picker if turn changes, game ends, or it's no longer our turn
watch(() => [store.currentPlayerIndex, store.turnState, props.isMyTurn, store.gameState], () => {
  if (showColorPicker.value && (!props.isMyTurn || store.gameState === 'GAME_OVER')) {
    showColorPicker.value = false
    pendingWildCard.value = null
  }
})

// Inject animation-related refs from parent (single-player specific)
const discardAreaRef = inject<Ref<HTMLElement | null>>('discardAreaRef', ref(null))
const animationLayer = inject<Ref<HTMLElement | null>>('animationLayer', ref(null))

function setCardRef(cardId: string, el: HTMLElement | ComponentPublicInstance | null) {
  if (el) {
    cardRefs.value.set(cardId, el as HTMLElement)
  } else {
    cardRefs.value.delete(cardId)
  }
}

function getCardStyle(index: number) {
  return getCardStyleUtil(index, props.hand.length, hoverIndex.value, isMobile.value)
}

function canPlay(card: CardType) {
  if (!props.isMyTurn) return false
  if (store.turnState !== 'WAITING_FOR_ACTION') return false
  if (!store.topCard) return false
  return canPlayCard(card, store.topCard, store.currentColor, store.drawStack)
}

function handleCardClick(card: CardType, _event: MouseEvent) {
  if (!canPlay(card)) return

  // If Wild and NOT Roulette, show picker first
  // (Roulette color is chosen by the victim AFTER play, so direct play)
  if (card.color === 'wild' && card.type !== 'wildColorRoulette') {
    pendingWildCard.value = card
    showColorPicker.value = true
    return
  }

  // Normal play
  executePlayCard(card)
}

function handleColorSelect(color: CardColor) {
  showColorPicker.value = false
  if (pendingWildCard.value) {
    executePlayCard(pendingWildCard.value, color)
    pendingWildCard.value = null
  }
}

async function executePlayCard(card: CardType, selectedColor?: CardColor) {
  const cardEl = cardRefs.value.get(card.id)
  if (!cardEl || !discardAreaRef?.value || !animationLayer?.value) {
    // Fallback: just play without animation
    soundEffects.playCardThrow()
    store.playerActionPlayCard(card, selectedColor)
    return
  }
  
  // Get positions
  const cardRect = cardEl.getBoundingClientRect()
  const discardRect = discardAreaRef.value.getBoundingClientRect()
  
  // Create flying card clone
  const clone = cardEl.cloneNode(true) as HTMLElement
  clone.style.position = 'fixed'
  clone.style.left = `${cardRect.left}px`
  clone.style.top = `${cardRect.top}px`
  clone.style.width = `${cardRect.width}px`
  clone.style.height = `${cardRect.height}px`
  clone.style.zIndex = '1000'
  clone.style.pointerEvents = 'none'
  clone.style.margin = '0'
  clone.style.transform = 'none'
  
  // If it's a wild card and we picked a color, maybe tint the clone?
  // For now, keep it simple.
  
  animationLayer.value.appendChild(clone)
  
  // Hide original card
  cardEl.style.opacity = '0'
  
  // Play throw sound
  soundEffects.playCardThrow()
  
  // Calculate target position (center of discard)
  const targetX = discardRect.left + discardRect.width / 2 - cardRect.width / 2
  const targetY = discardRect.top + discardRect.height / 2 - cardRect.height / 2
  
  // Random rotation for landing
  const landRotation = gsap.utils.random(-20, 20)
  
  // Animate the throw with arc
  await gsap.to(clone, {
    left: targetX,
    top: targetY,
    rotation: landRotation,
    scale: 0.85,
    duration: 0.35,
    ease: 'power2.out',
    onUpdate: function() {
      // Add slight arc by modifying Y during animation
      const progress = this.progress()
      const arcHeight = -60 * Math.sin(progress * Math.PI)
      clone.style.transform = `translateY(${arcHeight}px) rotate(${landRotation * progress}deg) scale(${1 - progress * 0.15})`
    }
  })
  
  // Play land sound
  soundEffects.playCardLand()
  
  // Remove clone
  clone.remove()
  
  // Play the card (this updates the store)
  store.playerActionPlayCard(card, selectedColor)
  
  // Check if it's a special card and play special sound
  if (card.color === 'wild' || card.type.includes('draw')) {
    soundEffects.playSpecialCard()
  }
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
  position: relative;
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
  box-shadow: 0 0 15px rgba(0, 243, 255, 0.5); /* Neon Blue Glow */
  border: 1px solid rgba(0, 243, 255, 0.8);
  border-radius: 8px; /* Match card radius approx */
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
    height: 130px;
    padding: 20px 0 5px;
    overflow-x: scroll;
    overflow-y: hidden;
    -webkit-overflow-scrolling: touch;
    scrollbar-width: none;
    padding-bottom: 15px;
  }

  .player-hand::-webkit-scrollbar {
    display: none;
  }

  .cards-container {
    min-width: min-content;
    padding: 0 10px;
  }

  .hand-card-wrapper {
    margin-right: -15px;
    flex-shrink: 0;
  }

  .hand-card-wrapper:hover {
    transform: translateY(-15px) scale(1.05) !important;
  }

  .not-my-turn .hand-card-wrapper:hover {
    transform: translateY(-8px) scale(1.03) !important;
  }
}
</style>
