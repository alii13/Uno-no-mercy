<template>
  <div
    class="hand-fan"
    :class="{ 'not-my-turn': !isMyTurn }"
    ref="rootEl"
  >
    <div class="hand-scroller" :class="{ scroll: layout.mode === 'scroll' }">
      <div
        class="hand-strip"
        ref="handContainer"
        :style="{ width: stripWidth + 'px', height: layout.cardH + 'px' }"
      >
        <div
          v-for="(card, index) in cards"
          :key="card.id"
          class="hand-card-wrapper"
          :class="{
            unplayable: isMyTurn && !canPlay(card),
            'playable-glow': isMyTurn && canPlay(card),
            'fresh-card': hiddenCardIds.has(card.id)
          }"
          :ref="(el: any) => setCardRef(card.id, el)"
          :style="slotStyle(index)"
          role="button"
          :tabindex="index === clampedFocus ? 0 : -1"
          :aria-disabled="!(isMyTurn && canPlay(card))"
          :aria-label="cardLabel(card) + (isMyTurn && canPlay(card) ? ', playable' : '')"
          @mouseenter="hoverIndex = index"
          @mouseleave="hoverIndex = -1"
          @focus="focusIndex = index"
          @click="handleCardClick(card)"
          @keydown="onKeydown($event, card, index)"
        >
          <Card
            :card="card"
            :size="{ width: layout.cardW, height: layout.cardH }"
            :is-playable="isMyTurn && canPlay(card)"
            class="hand-card"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, inject, watch, nextTick, onMounted, onUnmounted, type Ref, type ComponentPublicInstance } from 'vue'
import gsap from 'gsap'
import { Flip } from 'gsap/Flip'
import type { Card as CardType } from '../../types/card'
import Card from './Card.vue'
import { computeHandLayout } from '../../utils/handLayout'
import { useScreenSize } from '../../composables/useScreenSize'
import { soundEffects } from '../../composables/useSoundEffects'
import { burstImpactParticles } from '../../composables/useGameFeel'

// Unified hand for both single-player and multiplayer. It owns fan/scroll
// layout, the flying-clone play animation, and the throw sound only — the
// parent owns the store update (via @play) and the land/special sounds, so a
// card's sounds fire exactly once from each path's central mechanism.
const props = defineProps<{
  cards: CardType[]
  isMyTurn: boolean
  canPlay: (card: CardType) => boolean
  disabled?: boolean
}>()

const emit = defineEmits<{ (e: 'play', card: CardType): void }>()

const { screenWidth, isCoarsePointer } = useScreenSize()
const hoverIndex = ref(-1)

// Measure the hand band so the layout solver can cap card height to it.
const rootEl = ref<HTMLElement | null>(null)
const bandHeight = ref(200)
let resizeObserver: ResizeObserver | null = null

onMounted(() => {
  if (rootEl.value && typeof ResizeObserver !== 'undefined') {
    resizeObserver = new ResizeObserver(() => {
      if (rootEl.value) bandHeight.value = rootEl.value.clientHeight
    })
    resizeObserver.observe(rootEl.value)
    bandHeight.value = rootEl.value.clientHeight
  }
})
onUnmounted(() => resizeObserver?.disconnect())

const layout = computed(() =>
  computeHandLayout({
    viewportWidth: screenWidth.value,
    bandHeight: bandHeight.value,
    handSize: props.cards.length,
    pointerCoarse: isCoarsePointer.value
  })
)

const stripWidth = computed(() => {
  const { slots, cardW } = layout.value
  if (slots.length === 0) return cardW
  return slots[slots.length - 1]!.x + cardW
})

function slotStyle(index: number) {
  const s = layout.value.slots[index]
  if (!s) return {}
  return {
    position: 'absolute' as const,
    left: `${s.x}px`,
    bottom: '0px',
    width: `${layout.value.cardW}px`,
    height: `${layout.value.cardH}px`,
    transform: `translateY(${s.arcY}px) rotate(${s.rotate}deg)`,
    zIndex: String(s.zIndex)
  }
}

// Cards that just landed via a draw animation render invisibly until the
// flying card-back clone finishes its travel, so a drawn card doesn't pop into
// the hand while its clone is still mid-air. (Ported from single-player; the
// multiplayer hand gains it here for free.)
const hiddenCardIds = ref(new Set<string>())
const knownIds = new Set<string>()
for (const c of props.cards) knownIds.add(c.id)

watch(() => props.cards.map(c => c.id), (ids) => {
  const fresh: string[] = []
  for (const id of ids) {
    if (!knownIds.has(id)) {
      fresh.push(id)
      knownIds.add(id)
    }
  }
  if (fresh.length === 0) return
  for (const id of fresh) hiddenCardIds.value.add(id)
  setTimeout(() => {
    for (const id of fresh) hiddenCardIds.value.delete(id)
    hiddenCardIds.value = new Set(hiddenCardIds.value)
  }, 380)
})

// Injected from the game view: the discard target rect and the layer the
// flying clone is appended into. Null-safe — animation is skipped if absent.
const discardAreaRef = inject<Ref<HTMLElement | null>>('discardAreaRef', ref(null))
const animationLayer = inject<Ref<HTMLElement | null>>('animationLayer', ref(null))
const handContainer = ref<HTMLElement | null>(null)

const cardRefs = ref<Map<string, HTMLElement>>(new Map())
function setCardRef(cardId: string, el: HTMLElement | ComponentPublicInstance | null) {
  if (el) cardRefs.value.set(cardId, el as HTMLElement)
  else cardRefs.value.delete(cardId)
}

// Roving tabindex: the fan is a single tab stop; arrows traverse ALL cards
// (including unplayable ones, so keyboard users can inspect the whole hand).
const focusIndex = ref(0)
const clampedFocus = computed(() => Math.min(focusIndex.value, Math.max(0, props.cards.length - 1)))

function focusCard(index: number) {
  const card = props.cards[index]
  if (!card) return
  nextTick(() => cardRefs.value.get(card.id)?.focus())
}

function moveFocus(delta: number) {
  const n = props.cards.length
  if (n === 0) return
  const next = Math.min(n - 1, Math.max(0, clampedFocus.value + delta))
  focusIndex.value = next
  focusCard(next)
}

function onKeydown(e: KeyboardEvent, card: CardType, _index: number) {
  if (e.key === 'ArrowRight') { e.preventDefault(); moveFocus(1) }
  else if (e.key === 'ArrowLeft') { e.preventDefault(); moveFocus(-1) }
  else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleCardClick(card) }
}

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

function handleCardClick(card: CardType) {
  if (props.disabled) return
  if (!props.isMyTurn || !props.canPlay(card)) return
  executePlay(card)
}

// Fires the throw sound, hands the play to the parent (which does the store
// update + land/special sounds), and flies a clone of the card to the discard.
function executePlay(card: CardType) {
  const cardEl = cardRefs.value.get(card.id)
  if (!cardEl || !discardAreaRef?.value || !animationLayer?.value) {
    soundEffects.playCardThrow()
    emit('play', card)
    return
  }

  const cardRect = cardEl.getBoundingClientRect()
  const discardRect = discardAreaRef.value.getBoundingClientRect()

  // Capture the remaining cards' positions before Vue removes the played one,
  // so they slide into their new fan slots instead of jumping.
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

  // Fire the play FIRST so the game advances at click-speed; the throw is
  // cosmetic theatre in parallel. The parent sets suppressDiscardSlam and
  // updates the store, and its central mechanism plays the land/special sound.
  emit('play', card)

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

  const midX = dx / 2
  const arcHeight = Math.max(80, Math.hypot(dx, dy) * 0.22)
  const midY = dy / 2 - arcHeight

  const tl = gsap.timeline({ onComplete: () => clone.remove() })

  // 1. Anticipation — small pull-back opposite the throw.
  tl.to(clone, {
    x: -dx * 0.04,
    y: -dy * 0.04,
    scale: 0.96,
    duration: 0.07,
    ease: 'power2.in'
  })

  // 2. Throw — arced motion path to the pile.
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

  // 3. Impact — pile flash + shard burst for power cards. The land SOUND is NOT
  // fired here: each path's central mechanism owns it (SP: gameStore.playCard;
  // MP: the topCard watcher), so it fires exactly once per play.
  const isPowerCard = card.color === 'wild' || card.type.includes('draw') || card.type === 'skipEveryone'
  tl.call(() => {
    if (isPowerCard && discardAreaRef.value) {
      triggerPileFlash(card.color === 'wild' ? 'wild' : card.color)
      burstImpactParticles(discardAreaRef.value, card.color)
    }
  })

  // 4. Follow-through — settle onto the pile.
  tl.to(clone, {
    scale: 0.82,
    duration: 0.14,
    ease: 'back.out(2.2)'
  }, '+=0.045')
}

function triggerPileFlash(color: string) {
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
.hand-fan {
  position: relative;
  height: 200px;
  display: flex;
  justify-content: center;
  align-items: flex-end;
  padding: 50px 20px 10px;
  overflow: visible;
  width: 100%;
}

.hand-scroller {
  display: flex;
  justify-content: safe center;
  align-items: flex-end;
  perspective: 1000px;
  max-width: 100%;
}

/* Only scroll (and thus clip vertically) once the fan can't fit — fan mode
   keeps overflow visible so hover lifts aren't clipped. */
.hand-scroller.scroll {
  overflow-x: auto;
  overflow-y: visible;
  -webkit-overflow-scrolling: touch;
  scrollbar-width: none;
  touch-action: pan-x;
  padding: 0 var(--spacing-3);
}
.hand-scroller.scroll::-webkit-scrollbar { display: none; }

.hand-strip {
  position: relative;
  flex-shrink: 0;
}

.hand-card-wrapper {
  transition: transform 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275), opacity 0.2s ease-out;
  cursor: pointer;
  transform-origin: bottom center;
  will-change: transform;
}

.hand-card-wrapper.fresh-card {
  opacity: 0;
}

@media (hover: hover) and (pointer: fine) {
  .hand-card-wrapper:hover {
    z-index: 9999 !important;
    transform: translateY(-40px) scale(1.12) !important;
  }
  .hand-card-wrapper:hover .hand-card {
    box-shadow: 0 18px 28px rgba(0, 0, 0, 0.55);
  }
}

.unplayable {
  opacity: 0.7;
  filter: brightness(0.75);
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

.not-my-turn .hand-scroller {
  filter: grayscale(0.7) brightness(0.7);
  opacity: 0.7;
}
.not-my-turn .hand-card-wrapper {
  cursor: not-allowed;
}

@media (max-width: 768px) {
  .hand-fan {
    height: 160px;
    padding: 30px 10px 10px;
  }
}

@media (max-width: 480px) {
  .hand-fan {
    height: 130px;
    padding: 20px 5px 5px;
  }
}
</style>
