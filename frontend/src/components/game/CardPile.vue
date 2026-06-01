<template>
  <div class="card-pile-container">
    <div 
      class="card-pile" 
      :class="{ 'is-discard': isDiscard, 'is-draw': !isDiscard }"
      :style="{ width: cardSize.width + 'px', height: cardSize.height + 'px' }"
    >
      <!-- Draw Pile: Stack of face-down cards -->
      <template v-if="!isDiscard">
        <div class="pile-stack">
          <CardBack 
            v-for="i in Math.min(stackDepth, 8)" 
            :key="`stack-${i}`"
            :size="cardSize"
            class="stacked-card"
            :style="getStackStyle(i)"
          />
        </div>
      </template>
      
      <!-- Discard Pile: Scattered cards with top visible -->
      <template v-else>
        <div class="discard-scatter">
          <!-- Background scattered cards for depth -->
          <CardBack 
            v-for="i in Math.min(scatterCount, 5)" 
            :key="`scatter-${i}`"
            :size="cardSize"
            class="scattered-card-back"
            :style="getScatterStyle(i)"
          />
          
          <!-- Top card (face up) -->
          <div v-if="topCard" class="top-card" ref="topCardRef">
            <Card 
              :card="topCard" 
              :size="cardSize"
              :is-playable="false"
            />
          </div>
        </div>
      </template>
    </div>
    
    <div class="card-count" v-if="!isDiscard">
      {{ cards.length }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch, nextTick } from 'vue'
import gsap from 'gsap'
import type { Card as CardType } from '../../types/card'
import Card from './Card.vue'
import CardBack from './CardBack.vue'
import { useScreenSize } from '../../composables/useScreenSize'
import { useGameStore } from '../../stores/gameStore'
import { useMultiplayerStore } from '../../stores/multiplayerStore'

const props = defineProps<{
  cards: CardType[]
  isDiscard?: boolean
  large?: boolean
}>()

const topCardRef = ref<HTMLElement | null>(null)
const { isMobile, isTablet } = useScreenSize()

const cardSize = computed(() => {
  if (props.large) {
    if (isMobile.value) return { width: 75, height: 105 }
    if (isTablet.value) return { width: 90, height: 126 }
    return { width: 110, height: 154 }
  }
  if (isMobile.value) return { width: 55, height: 77 }
  if (isTablet.value) return { width: 65, height: 91 }
  return { width: 80, height: 112 }
})

const stackDepth = computed(() => Math.min(Math.ceil(props.cards.length / 10), 8))
const scatterCount = computed(() => Math.min(props.cards.length, 5))

const topCard = computed(() => {
  if (props.cards.length === 0) return undefined
  return props.cards[props.cards.length - 1]
})

function getStackStyle(index: number) {
  // Real 3D depth — each card recedes slightly behind the one above via
  // translate3d's Z axis (requires `perspective` on an ancestor to render).
  // Tiny rotation jitter per card so the stack doesn't look machine-perfect.
  const yLift = index * 2
  const zPush = index * -1.5
  const seed = index * 23
  const rot = ((seed % 8) - 4) * 0.5 // -2deg to +2deg
  return {
    transform: `translate3d(0, ${-yLift}px, ${zPush}px) rotate(${rot}deg)`,
    zIndex: index,
    filter: `brightness(${1 - index * 0.04})`
  }
}

function getScatterStyle(index: number) {
  // Discard pile scatter — slightly more chaotic than the draw stack since
  // these were thrown, not placed. Each card has 3D depth too.
  const seed = index * 17
  const rotation = ((seed % 30) - 15)
  const offsetX = ((seed * 7) % 20) - 10
  const offsetY = ((seed * 13) % 16) - 8
  const zPush = index * -2.5
  return {
    transform: `translate3d(${offsetX}px, ${offsetY}px, ${zPush}px) rotate(${rotation}deg)`,
    zIndex: index
  }
}

const gameStore = useGameStore()
const mpStore = useMultiplayerStore()

// Animate new card landing on discard pile
watch(() => props.cards.length, (newLen, oldLen) => {
  if (props.isDiscard && newLen > oldLen && topCardRef.value) {
    // The flying-clone in PlayerHand IS the visual when the human throws their
    // own card — skip our own slam for that beat so the user doesn't see two
    // animations stacked. Bot plays (and any other state mutation) leave the
    // flag false, so the slam fires as the only visual.
    if (gameStore.suppressDiscardSlam || mpStore.suppressDiscardSlam) {
      gameStore.suppressDiscardSlam = false
      mpStore.suppressDiscardSlam = false
      return
    }
    nextTick(() => {
      if (topCardRef.value) {
        // Dramatic slam — back.out overshoots and settles, less cartoony than bounce.
        gsap.fromTo(topCardRef.value,
          {
            y: -100,
            scale: 1.5,
            opacity: 0,
            rotation: gsap.utils.random(-30, 30)
          },
          {
            y: 0,
            scale: 1,
            opacity: 1,
            rotation: 0,
            duration: 0.42,
            ease: 'back.out(1.7)'
          }
        )
      }
    })
  }
})
</script>

<style scoped>
.card-pile-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  position: relative;
  /* Perspective enables real 3D depth on the translate3d children below.
     Without this, the per-card Z offsets collapse to 2D. */
  perspective: 800px;
  perspective-origin: 50% 30%;
}

.card-pile {
  position: relative;
  cursor: pointer;
  transition: transform 0.18s ease;
  transform-style: preserve-3d;
}

/* Pile Interaction — draw pile lifts subtly on hover, presses on click */
.card-pile.is-draw:hover {
  transform: translateY(-3px) scale(1.02);
}
.card-pile.is-draw:active {
  transform: translateY(2px);
}

.pile-stack {
  position: relative;
  width: 100%;
  height: 100%;
  transform-style: preserve-3d;
}

.stacked-card {
  position: absolute;
  top: 0;
  left: 0;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.6);
  border-radius: 6px;
  backface-visibility: hidden;
}

.discard-scatter {
  position: relative;
  width: 100%;
  height: 100%;
  transform-style: preserve-3d;
}

.scattered-card-back {
  position: absolute;
  top: 0;
  left: 0;
  opacity: 0.55;
  filter: grayscale(0.6) brightness(0.7); /* Old discards desaturated + dimmed */
  backface-visibility: hidden;
}

.top-card {
  position: absolute;
  top: 0;
  left: 0;
  z-index: 10;
  filter: drop-shadow(0 10px 20px rgba(0, 0, 0, 0.6));
}

.card-count {
  position: absolute;
  bottom: -25px;
  color: var(--text-muted);
  font-family: 'Courier New', monospace;
  font-size: 0.8rem;
  background: #111;
  padding: 2px 6px;
  border-radius: 4px;
  border: 1px solid #333;
}
</style>
