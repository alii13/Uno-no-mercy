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
        :ref="(el: any) => setCardRef(card.id, el)"
        :style="{ ...getCardStyle(index), marginRight: index < hand.length - 1 ? cardOverlap + 'px' : '0' }"
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
import { ref, computed, inject, type Ref, type ComponentPublicInstance } from 'vue'
import gsap from 'gsap'
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

const { screenWidth, isMobile, isTablet } = useScreenSize()
const hoverIndex = ref(-1)
const cardRefs = ref<Map<string, HTMLElement>>(new Map())

const discardAreaRef = inject<Ref<HTMLElement | null>>('discardAreaRef', ref(null))
const animationLayer = inject<Ref<HTMLElement | null>>('animationLayer', ref(null))

const baseCardSize = computed(() => {
  if (isMobile.value) return { width: 65, height: 91 }
  if (isTablet.value) return { width: 80, height: 112 }
  return { width: 100, height: 140 }
})

const cardSize = computed(() => {
  const base = baseCardSize.value
  if (!isMobile.value || props.hand.length <= 8) return base
  const scale = Math.max(0.7, 1 - (props.hand.length - 8) * 0.03)
  return {
    width: Math.round(base.width * scale),
    height: Math.round(base.height * scale)
  }
})

const cardOverlap = computed(() => {
  const count = props.hand.length
  if (count <= 1) return 0
  const padding = isMobile.value ? 20 : isTablet.value ? 20 : 40
  const available = screenWidth.value - padding
  const totalWidth = count * cardSize.value.width
  if (totalWidth <= available) {
    return isMobile.value ? -15 : isTablet.value ? -25 : -35
  }
  const needed = -(totalWidth - available) / (count - 1)
  const maxOverlap = -(cardSize.value.width * 0.85)
  return Math.max(maxOverlap, needed)
})

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

function canPlay(card: CardType): boolean {
  if (!props.isMyTurn || !props.topCard) return false
  return canPlayCard(card, props.topCard, props.currentColor, props.drawStack)
}

function handleCardClick(card: CardType) {
  if (!canPlay(card)) return
  animateAndPlay(card)
}

async function animateAndPlay(card: CardType) {
  const cardEl = cardRefs.value.get(card.id)
  if (!cardEl || !discardAreaRef?.value || !animationLayer?.value) {
    emit('playCard', card)
    return
  }

  const cardRect = cardEl.getBoundingClientRect()
  const discardRect = discardAreaRef.value.getBoundingClientRect()

  // Create flying clone
  const clone = cardEl.cloneNode(true) as HTMLElement
  clone.style.position = 'fixed'
  clone.style.left = `${cardRect.left}px`
  clone.style.top = `${cardRect.top}px`
  clone.style.width = `${cardRect.width}px`
  clone.style.height = `${cardRect.height}px`
  clone.style.zIndex = '5000'
  clone.style.pointerEvents = 'none'
  clone.style.margin = '0'
  clone.style.transform = 'none'

  animationLayer.value.appendChild(clone)
  cardEl.style.opacity = '0'

  const targetX = discardRect.left + discardRect.width / 2 - cardRect.width / 2
  const targetY = discardRect.top + discardRect.height / 2 - cardRect.height / 2
  const landRotation = gsap.utils.random(-20, 20)

  await gsap.to(clone, {
    left: targetX,
    top: targetY,
    rotation: landRotation,
    scale: 0.85,
    duration: 0.35,
    ease: 'power2.out',
    onUpdate: function() {
      const progress = this.progress()
      const arcHeight = -60 * Math.sin(progress * Math.PI)
      clone.style.transform = `translateY(${arcHeight}px) rotate(${landRotation * progress}deg) scale(${1 - progress * 0.15})`
    }
  })

  clone.remove()
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
  transition: transform 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275), margin-right 0.3s ease;
  cursor: pointer;
  transform-origin: bottom center;
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

  .hand-card-wrapper:hover {
    transform: translateY(-30px) scale(1.1) !important;
  }
}

@media (max-width: 480px) {
  .player-hand {
    height: 130px;
    padding: 20px 5px 5px;
    overflow: visible;
  }

  .hand-card-wrapper:hover {
    transform: translateY(-15px) scale(1.05) !important;
  }

  .not-my-turn .hand-card-wrapper:hover {
    transform: translateY(-8px) scale(1.03) !important;
  }
}
</style>
