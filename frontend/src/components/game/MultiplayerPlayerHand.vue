<template>
  <div class="player-hand" :class="{ 'not-my-turn': !isMyTurn }">
    <div class="hand-fade hand-fade-l" v-if="canScrollL" aria-hidden="true"></div>
    <div class="hand-fade hand-fade-r" v-if="canScrollR" aria-hidden="true"></div>
    <div class="cards-container" ref="handContainer" @scroll.passive="onHandScroll">
      <div
        v-for="(card, index) in hand"
        :key="card.id"
        class="hand-card-wrapper"
        :class="{
          'unplayable': isMyTurn && !canPlay(card),
          'playable-glow': isMyTurn && canPlay(card),
          'peeked': peekedCardId === card.id
        }"
        :ref="(el: any) => setCardRef(card.id, el)"
        :style="{ ...getCardStyle(index), marginRight: index < hand.length - 1 ? cardOverlap + 'px' : '0' }"
        role="button"
        :tabindex="isMyTurn && canPlay(card) ? 0 : -1"
        :aria-disabled="!(isMyTurn && canPlay(card))"
        :aria-pressed="peekedCardId === card.id"
        :aria-label="cardLabel(card) + (isMyTurn && canPlay(card) ? ', playable' : '')"
        @mouseenter="hoverIndex = index"
        @mouseleave="hoverIndex = -1"
        @click="handleCardClick(card)"
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
  </div>
</template>

<script setup lang="ts">
import { ref, computed, inject, watch, nextTick, onMounted, onUnmounted, type Ref, type ComponentPublicInstance } from 'vue'
import gsap from 'gsap'
import { Flip } from 'gsap/Flip'
import Card from './Card.vue'
import { canPlayCard, type StackingMode } from '../../utils/gameRules'
import { getCardStyle as getCardStyleUtil } from '../../utils/gameHelpers'
import type { Card as CardType, CardColor } from '../../types/card'
import { useScreenSize } from '../../composables/useScreenSize'
import { burstImpactParticles } from '../../composables/useGameFeel'
import { useMultiplayerStore } from '../../stores/multiplayerStore'

const props = defineProps<{
  hand: CardType[]
  isMyTurn: boolean
  currentColor: CardColor
  topCard: CardType | undefined
  drawStack: number
  stackingMode: StackingMode
}>()

const emit = defineEmits<{
  (e: 'playCard', card: CardType): void
}>()

const { screenWidth, isMobile, isTablet } = useScreenSize()
const mpStore = useMultiplayerStore()
const hoverIndex = ref(-1)
const cardRefs = ref<Map<string, HTMLElement>>(new Map())
const handContainer = ref<HTMLElement | null>(null)

const discardAreaRef = inject<Ref<HTMLElement | null>>('discardAreaRef', ref(null))
const animationLayer = inject<Ref<HTMLElement | null>>('animationLayer', ref(null))

const baseCardSize = computed(() => {
  if (isMobile.value) return { width: 65, height: 91 }
  if (isTablet.value) return { width: 80, height: 112 }
  return { width: 100, height: 140 }
})

const cardSize = computed(() => {
  const base = baseCardSize.value
  // Shrink the fan on any narrow/touch screen (phone OR tablet) once the hand
  // gets big — tablets used to never shrink and overlap-crushed worse than phones.
  if ((!isMobile.value && !isTablet.value) || props.hand.length <= 8) return base
  const scale = Math.max(0.7, 1 - (props.hand.length - 8) * 0.03)
  return {
    width: Math.round(base.width * scale),
    height: Math.round(base.height * scale)
  }
})

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
  // Cap overlap so each card stays readable/tappable (~45% visible) instead of
  // collapsing into unidentifiable slivers. When the fan is wider than the
  // viewport the container scrolls horizontally (see .cards-container CSS).
  const maxOverlap = -(cardSize.value.width * 0.55)
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
  return canPlayCard(card, props.topCard, props.currentColor, props.drawStack, props.stackingMode)
}

// Human-readable card name for screen readers (the cards are otherwise just
// images, so a keyboard/SR user has no idea what they're selecting).
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

// --- Touch peek: on coarse-pointer devices the first tap lifts + magnifies a
// card (readable even when the fan is dense or it's not your turn); a second
// tap on the lifted card plays it. Native swipe still scrolls the fan. ---
const isTouch = typeof window !== 'undefined' &&
  window.matchMedia('(hover: none), (pointer: coarse)').matches
const peekedCardId = ref<string | null>(null)

// A peek is a transient reading aid — drop it whenever the situation changes
// under it (turn handoff, cards entering/leaving the hand).
watch([() => props.isMyTurn, () => props.hand.length], () => {
  peekedCardId.value = null
})

// --- Scroll-edge hints: fade gradients telling the player more cards sit
// off-screen when the fan overflows on mobile. ---
const canScrollL = ref(false)
const canScrollR = ref(false)
function onHandScroll() {
  const el = handContainer.value
  if (!el) {
    canScrollL.value = canScrollR.value = false
    return
  }
  canScrollL.value = el.scrollLeft > 8
  canScrollR.value = el.scrollLeft + el.clientWidth < el.scrollWidth - 8
}
watch(() => props.hand.length, () => nextTick(onHandScroll))
onMounted(() => {
  onHandScroll()
  window.addEventListener('resize', onHandScroll)
})
onUnmounted(() => window.removeEventListener('resize', onHandScroll))

function handleCardClick(card: CardType) {
  if (isTouch) {
    if (peekedCardId.value !== card.id) {
      peekedCardId.value = card.id
      return
    }
    peekedCardId.value = null
  }
  if (!canPlay(card)) return
  animateAndPlay(card)
}

function animateAndPlay(card: CardType) {
  const cardEl = cardRefs.value.get(card.id)
  if (!cardEl || !discardAreaRef?.value || !animationLayer?.value) {
    emit('playCard', card)
    return
  }

  const cardRect = cardEl.getBoundingClientRect()
  const discardRect = discardAreaRef.value.getBoundingClientRect()

  // Capture Flip state of remaining cards BEFORE the play so they slide
  // into their new spots after Vue removes the played card.
  const remainingCards = handContainer.value
    ? handContainer.value.querySelectorAll('.hand-card-wrapper')
    : null
  const handFlipState = remainingCards && remainingCards.length > 1
    ? Flip.getState(remainingCards)
    : null

  const clone = cardEl.cloneNode(true) as HTMLElement
  clone.style.position = 'fixed'
  clone.style.left = `${cardRect.left}px`
  clone.style.top = `${cardRect.top}px`
  clone.style.width = `${cardRect.width}px`
  clone.style.height = `${cardRect.height}px`
  clone.style.zIndex = '5000'
  clone.style.pointerEvents = 'none'
  clone.style.margin = '0'
  animationLayer.value.appendChild(clone)
  cardEl.style.opacity = '0'

  const targetX = discardRect.left + discardRect.width / 2 - cardRect.width / 2
  const targetY = discardRect.top + discardRect.height / 2 - cardRect.height / 2
  const dx = targetX - cardRect.left
  const dy = targetY - cardRect.top
  const midX = dx / 2
  const arcHeight = Math.max(80, Math.hypot(dx, dy) * 0.22)
  const midY = dy / 2 - arcHeight
  const landRotation = gsap.utils.random(-20, 20)

  // Fire the play emit FIRST so multiplayer's network round-trip starts
  // immediately. Animation runs in parallel as cosmetic theatre. The pile
  // keeps showing the previous top card until the clone lands (cleared at
  // impact below, with a timeout backstop).
  mpStore.pendingThrowCardId = card.id
  setTimeout(() => {
    if (mpStore.pendingThrowCardId === card.id) mpStore.pendingThrowCardId = null
  }, 1500)
  emit('playCard', card)

  if (handFlipState) {
    nextTick(() => {
      Flip.from(handFlipState, {
        duration: 0.35,
        ease: 'power3.out',
        stagger: 0.015
      })
    })
  }

  const tl = gsap.timeline({ onComplete: () => clone.remove() })
  tl.to(clone, {
    x: -dx * 0.04,
    y: -dy * 0.04,
    scale: 0.96,
    duration: 0.07,
    ease: 'power2.in'
  })
  tl.to(clone, {
    motionPath: {
      path: [{ x: midX, y: midY }, { x: dx, y: dy }],
      curviness: 1.5,
      autoRotate: false
    },
    rotation: landRotation,
    scale: 0.92,
    duration: 0.32,
    ease: 'power2.out'
  })
  // Impact — reveal the real top card, shard burst for power cards, then a
  // ~45ms hit-stop beat before the follow-through settle.
  const isPowerCard = card.color === 'wild' || card.type.includes('draw') || card.type === 'skipEveryone'
  tl.call(() => {
    if (mpStore.pendingThrowCardId === card.id) mpStore.pendingThrowCardId = null
    if (isPowerCard && discardAreaRef?.value) burstImpactParticles(discardAreaRef.value, card.color)
  })
  tl.to(clone, {
    scale: 0.82,
    duration: 0.14,
    ease: 'back.out(2.2)'
  }, '+=0.045')
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

/* Touch: when a big hand's fan is wider than the screen, scroll it horizontally
   instead of crushing every card into a sliver. `safe center` keeps small hands
   centered but lets large ones scroll from the first card. Top padding gives
   the peeked-card lift paint headroom inside the scroll clip box. */
@media (max-width: 768px) {
  .cards-container {
    justify-content: safe center;
    max-width: 100vw;
    overflow-x: auto;
    overflow-y: visible;
    -webkit-overflow-scrolling: touch;
    scrollbar-width: none;
    padding: 72px var(--spacing-3) 12px;
  }
  .cards-container::-webkit-scrollbar { display: none; }
}

/* Scroll-edge fades — only meaningful where the fan can actually scroll. */
.hand-fade {
  display: none;
  position: absolute;
  bottom: 0;
  width: 38px;
  height: 75%;
  pointer-events: none;
  z-index: 200;
}

@media (max-width: 768px) {
  .hand-fade { display: block; }
  .hand-fade-l {
    left: 0;
    background: linear-gradient(to right, rgba(5, 6, 8, 0.85), transparent);
  }
  .hand-fade-r {
    right: 0;
    background: linear-gradient(to left, rgba(5, 6, 8, 0.85), transparent);
  }
}

/* Touch peek — lifted, magnified, fully readable regardless of playability. */
.hand-card-wrapper.peeked {
  transform: translateY(-54px) scale(1.35) !important;
  z-index: 10000 !important;
  opacity: 1;
  filter: none;
}

.hand-card-wrapper.peeked .hand-card {
  box-shadow: 0 18px 32px rgba(0, 0, 0, 0.6);
}

.hand-card-wrapper {
  position: relative;
  transition: transform 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275);
  cursor: pointer;
  transform-origin: bottom center;
  will-change: transform;
}

@media (hover: hover) and (pointer: fine) {
  .hand-card-wrapper:hover {
    z-index: 9999 !important;
    transform: translateY(-40px) scale(1.12) !important;
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

.hand-card-wrapper.playable-glow:active {
  transform: translateY(-32px) scale(1.04) !important;
  transition: transform 0.06s ease-out;
}

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
