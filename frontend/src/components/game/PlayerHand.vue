<template>
  <div class="player-hand" :class="{ 'not-my-turn': !isMyTurn }">
    <div class="cards-container" ref="handContainer">
      <div 
        v-for="(card, index) in hand" 
        :key="card.id"
        class="hand-card-wrapper"
        :class="{
          'unplayable': isMyTurn && !canPlay(card),
          'playable-glow': isMyTurn && canPlay(card),
          'fresh-card': hiddenCardIds.has(card.id)
        }"
        :ref="(el: any) => setCardRef(card.id, el)"
        :style="{ ...getCardStyle(index), marginRight: index < hand.length - 1 ? cardOverlap + 'px' : '0' }"
        role="button"
        :tabindex="isMyTurn && canPlay(card) ? 0 : -1"
        :aria-disabled="!(isMyTurn && canPlay(card))"
        :aria-label="cardLabel(card) + (isMyTurn && canPlay(card) ? ', playable' : '')"
        @mouseenter="hoverIndex = index"
        @mouseleave="hoverIndex = -1"
        @click="handleCardClick(card, $event)"
        @keydown.enter.prevent="handleCardClick(card)"
        @keydown.space.prevent="handleCardClick(card)"
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
import { ref, computed, inject, watch, nextTick, type Ref, type ComponentPublicInstance } from 'vue'
import gsap from 'gsap'
import { Flip } from 'gsap/Flip'
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
const { screenWidth, isMobile, isTablet } = useScreenSize()
const hoverIndex = ref(-1)

// Cards that just landed in the hand via a draw animation. While in this set
// they render invisibly so they don't pop in before the flying card-back clone
// finishes its travel from the deck. Cleared shortly after the clone lands.
const hiddenCardIds = ref(new Set<string>())
const knownIds = new Set<string>()
// Seed knownIds with the initial hand so the deal animation doesn't trigger the
// "hidden" treatment.
for (const c of props.hand) knownIds.add(c.id)

watch(() => props.hand.map(c => c.id), (ids) => {
  const fresh: string[] = []
  for (const id of ids) {
    if (!knownIds.has(id)) {
      fresh.push(id)
      knownIds.add(id)
    }
  }
  if (fresh.length === 0) return
  for (const id of fresh) hiddenCardIds.value.add(id)
  // Match the flying-clone duration (~400ms) with a small buffer for the eye.
  setTimeout(() => {
    for (const id of fresh) hiddenCardIds.value.delete(id)
    // Trigger reactivity since Set mutations aren't reactive on their own
    hiddenCardIds.value = new Set(hiddenCardIds.value)
  }, 380)
})

const baseCardSize = computed(() => {
  if (isMobile.value) return { width: 65, height: 91 }
  if (isTablet.value) return { width: 80, height: 112 }
  return { width: 100, height: 140 }
})

// Dynamic card sizing - shrink cards when hand is very large on small screens
const cardSize = computed(() => {
  const base = baseCardSize.value
  if (!isMobile.value || props.hand.length <= 8) return base
  const scale = Math.max(0.7, 1 - (props.hand.length - 8) * 0.03)
  return {
    width: Math.round(base.width * scale),
    height: Math.round(base.height * scale)
  }
})

// Dynamic overlap - squeeze cards to always fit on screen.
// Padding budget includes room for the fan rotation (outer cards rotate up
// to ±9deg via getCardStyle's spreadRotate, expanding their bounding box
// by ~9px each side). Without this buffer the outer cards clip off-edge.
const cardOverlap = computed(() => {
  const count = props.hand.length
  if (count <= 1) return 0
  const padding = isMobile.value ? 48 : isTablet.value ? 40 : 60
  const available = screenWidth.value - padding
  const totalWidth = count * cardSize.value.width
  if (totalWidth <= available) {
    return isMobile.value ? -15 : isTablet.value ? -25 : -35
  }
  const needed = -(totalWidth - available) / (count - 1)
  const maxOverlap = -(cardSize.value.width * 0.85)
  return Math.max(maxOverlap, needed)
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
const handContainer = ref<HTMLElement | null>(null)

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

// Human-readable card name for screen readers.
function cardLabel(card: CardType): string {
  const color = card.color === 'wild' ? 'Wild' : card.color.charAt(0).toUpperCase() + card.color.slice(1)
  const names: Record<string, string> = {
    number: card.value !== undefined ? String(card.value) : 'number',
    skip: 'Skip', reverse: 'Reverse', draw2: 'Draw Two', draw4: 'Draw Four',
    draw6: 'Draw Six', draw10: 'Draw Ten', skipEveryone: 'Skip Everyone',
    discardAll: 'Discard All', wild: 'Wild', wildReverseDraw4: 'Wild Reverse Draw Four',
    wildColorRoulette: 'Wild Color Roulette'
  }
  const name = names[card.type] || card.type
  return card.color === 'wild' ? name : `${color} ${name}`
}

function canPlay(card: CardType) {
  if (!props.isMyTurn) return false
  if (store.turnState !== 'WAITING_FOR_ACTION') return false
  if (store.actionInProgress) return false
  if (!store.topCard) return false
  return canPlayCard(card, store.topCard, store.currentColor, store.drawStack, store.stackingMode)
}

function handleCardClick(card: CardType, _event?: MouseEvent) {
  if (!canPlay(card)) return
  if (store.actionInProgress) return

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

function executePlayCard(card: CardType, selectedColor?: CardColor) {
  const cardEl = cardRefs.value.get(card.id)
  if (!cardEl || !discardAreaRef?.value || !animationLayer?.value) {
    // Fallback: just play without animation
    soundEffects.playCardThrow()
    store.playerActionPlayCard(card, selectedColor)
    return
  }

  const cardRect = cardEl.getBoundingClientRect()
  const discardRect = discardAreaRef.value.getBoundingClientRect()

  // Capture Flip state of remaining hand cards BEFORE the state change so
  // they can slide into their new positions after the card is removed.
  const remainingCards = handContainer.value
    ? handContainer.value.querySelectorAll('.hand-card-wrapper')
    : null
  const handFlipState = remainingCards && remainingCards.length > 1
    ? Flip.getState(remainingCards)
    : null

  // Flying-card clone — visual only.
  const clone = cardEl.cloneNode(true) as HTMLElement
  clone.style.position = 'fixed'
  clone.style.left = `${cardRect.left}px`
  clone.style.top = `${cardRect.top}px`
  clone.style.width = `${cardRect.width}px`
  clone.style.height = `${cardRect.height}px`
  clone.style.zIndex = '1000'
  clone.style.pointerEvents = 'none'
  clone.style.margin = '0'
  animationLayer.value.appendChild(clone)
  cardEl.style.opacity = '0'

  soundEffects.playCardThrow()

  const targetX = discardRect.left + discardRect.width / 2 - cardRect.width / 2
  const targetY = discardRect.top + discardRect.height / 2 - cardRect.height / 2
  const dx = targetX - cardRect.left
  const dy = targetY - cardRect.top
  const landRotation = gsap.utils.random(-20, 20)

  // Fire game-state update FIRST so the game advances at click-speed.
  // The throw is cosmetic theatre that plays in parallel.
  // Signal CardPile to skip its own "slam from above" — the flying clone IS the visual.
  store.suppressDiscardSlam = true
  store.playerActionPlayCard(card, selectedColor)
  if (card.color === 'wild' || card.type.includes('draw')) {
    soundEffects.playSpecialCard()
  }

  // After Vue removes the played card from the hand DOM, slide the
  // remaining cards into their new positions instead of popping.
  if (handFlipState) {
    nextTick(() => {
      Flip.from(handFlipState, {
        duration: 0.35,
        ease: 'power3.out',
        stagger: 0.015,
        absolute: false
      })
    })
  }

  // Arc midpoint — lifts the card halfway between source and target.
  // ~25% of the diagonal travel as upward lift gives a satisfying toss.
  const midX = dx / 2
  const arcHeight = Math.max(80, Math.hypot(dx, dy) * 0.22)
  const midY = dy / 2 - arcHeight

  const tl = gsap.timeline({
    onComplete: () => {
      soundEffects.playCardLand()
      clone.remove()
    }
  })

  // 1. Anticipation — tiny pull-back in the opposite direction of throw.
  tl.to(clone, {
    x: -dx * 0.04,
    y: -dy * 0.04,
    scale: 0.96,
    duration: 0.07,
    ease: 'power2.in'
  })

  // 2. Throw — MotionPath arc from current position through (midX, midY) to (dx, dy).
  tl.to(clone, {
    motionPath: {
      path: [
        { x: midX, y: midY },
        { x: dx, y: dy }
      ],
      curviness: 1.5,
      autoRotate: false
    },
    rotation: landRotation,
    scale: 0.92,
    duration: 0.32,
    ease: 'power2.out'
  })

  // 3. Follow-through — slight overshoot and settle on the pile.
  tl.to(clone, {
    scale: 0.82,
    duration: 0.14,
    ease: 'back.out(2.2)'
  })

  // 4. Trigger the pile flash for power cards (runs in parallel with landing).
  if (card.color === 'wild' || card.type.includes('draw') || card.type === 'skipEveryone') {
    triggerPileFlash(card.color === 'wild' ? 'wild' : (card.color as CardColor))
  }
}

function triggerPileFlash(color: CardColor | 'wild') {
  if (!discardAreaRef?.value) return
  const flash = document.createElement('div')
  flash.className = 'pile-flash'
  const colorMap: Record<string, string> = {
    red: 'rgba(255, 60, 60, 0.85)',
    blue: 'rgba(60, 120, 255, 0.85)',
    green: 'rgba(60, 220, 120, 0.85)',
    yellow: 'rgba(255, 220, 60, 0.85)',
    wild: 'rgba(255, 80, 220, 0.9)'
  }
  flash.style.cssText = `
    position: absolute;
    inset: -40px;
    border-radius: 50%;
    background: radial-gradient(circle, ${colorMap[color] || colorMap.wild} 0%, transparent 70%);
    mix-blend-mode: screen;
    pointer-events: none;
    opacity: 0;
    z-index: 50;
    will-change: opacity, transform;
  `
  discardAreaRef.value.appendChild(flash)
  gsap.fromTo(flash,
    { opacity: 0, scale: 0.4 },
    {
      opacity: 1, scale: 1.6, duration: 0.18, ease: 'power2.out',
      onComplete: () => {
        gsap.to(flash, {
          opacity: 0, scale: 1.9, duration: 0.32, ease: 'power2.in',
          onComplete: () => flash.remove()
        })
      }
    }
  )
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
  transition: transform 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275), opacity 0.2s ease-out;
  cursor: pointer;
  transform-origin: bottom center;
  will-change: transform;
}

/* Newly-drawn card hides until the flying card-back clone has landed, so the
   user doesn't see the card pop into the hand AND a clone fly in at the same
   time. The watch above clears the class ~380ms after the draw. */
.hand-card-wrapper.fresh-card {
  opacity: 0;
}

/* Hover lifts are gated to devices with a real pointer — on touch they'd
   fire on tap and get stuck on iOS Safari. */
@media (hover: hover) and (pointer: fine) {
  .hand-card-wrapper:hover {
    z-index: 9999 !important;
    transform: translateY(-40px) scale(1.12) !important;
    position: relative;
  }

  .hand-card-wrapper:hover .hand-card {
    box-shadow: 0 18px 28px rgba(0, 0, 0, 0.55);
  }

  .hand-card-wrapper:hover .unplayable {
    transform: translateY(-30px) scale(1.05);
    opacity: 1;
    filter: grayscale(0);
  }
}

.unplayable {
  opacity: 0.7;
  filter: brightness(0.75);
  transform: translateY(10px);
}

/* Click-down press feedback — quick squash before the throw fires. */
.hand-card-wrapper.playable-glow:active {
  transform: translateY(-32px) scale(1.04) !important;
  transition: transform 0.06s ease-out;
}

/* Playable glow: keep a static box-shadow + border, pulse opacity on a pseudo-element.
   Animating opacity stays on the compositor; animating box-shadow forces paint. */
.playable-glow .hand-card {
  box-shadow: 0 0 15px rgba(0, 243, 255, 0.5);
  border: 1px solid rgba(0, 243, 255, 0.8);
  border-radius: 8px;
  position: relative;
}

.playable-glow .hand-card::after {
  content: "";
  position: absolute;
  inset: -2px;
  border-radius: 10px;
  pointer-events: none;
  box-shadow: 0 0 22px rgba(0, 243, 255, 0.85);
  opacity: 0;
  animation: pulse-glow 2.4s ease-in-out infinite;
}

@keyframes pulse-glow {
  0%, 100% { opacity: 0; }
  50% { opacity: 1; }
}

/* When it's not the player's turn, gray out all cards */
.not-my-turn .cards-container {
  filter: grayscale(0.7) brightness(0.7);
  opacity: 0.7;
}

.not-my-turn .hand-card-wrapper {
  cursor: not-allowed;
}

@media (hover: hover) and (pointer: fine) {
  .not-my-turn .hand-card-wrapper:hover {
    transform: translateY(-20px) scale(1.05) !important;
  }
}

@media (max-width: 768px) {
  .player-hand {
    height: 160px;
    padding: 30px 10px 10px;
  }
}

@media (max-width: 768px) and (hover: hover) and (pointer: fine) {
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
}

@media (max-width: 480px) and (hover: hover) and (pointer: fine) {
  .hand-card-wrapper:hover {
    transform: translateY(-15px) scale(1.05) !important;
  }

  .not-my-turn .hand-card-wrapper:hover {
    transform: translateY(-8px) scale(1.03) !important;
  }
}
</style>
