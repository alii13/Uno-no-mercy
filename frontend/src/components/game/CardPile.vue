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
  const offset = index * 3 // Taller stack visual
  return {
    transform: `translateY(${-offset}px)`,
    zIndex: index,
    filter: `brightness(${1 - index * 0.05})`
  }
}

function getScatterStyle(index: number) {
  // Use deterministic pseudo-random based on index
  const seed = index * 17
  const rotation = ((seed % 30) - 15)
  const offsetX = ((seed * 7) % 20) - 10
  const offsetY = ((seed * 13) % 16) - 8
  return {
    transform: `translate(${offsetX}px, ${offsetY}px) rotate(${rotation}deg)`,
    zIndex: index
  }
}

// Animate new card landing on discard pile
watch(() => props.cards.length, (newLen, oldLen) => {
  if (props.isDiscard && newLen > oldLen && topCardRef.value) {
    nextTick(() => {
      if (topCardRef.value) {
        // Dramatic "Slam" animation
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
            duration: 0.5,
            ease: 'bounce.out' 
            // 'bounce.out' gives a heavy impact feel
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
}

.card-pile {
  position: relative;
  cursor: pointer;
  transition: transform 0.1s ease;
}

/* Pile Interaction */
.card-pile.is-draw:active {
  transform: translateY(2px);
}

.pile-stack {
  position: relative;
  width: 100%;
  height: 100%;
}

.stacked-card {
  position: absolute;
  top: 0;
  left: 0;
  box-shadow: 0 1px 2px rgba(0,0,0,0.5);
}

.discard-scatter {
  position: relative;
  width: 100%;
  height: 100%;
}

.scattered-card-back {
  position: absolute;
  top: 0;
  left: 0;
  opacity: 0.7;
  filter: grayscale(0.8); /* Make old discard cards darker */
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
