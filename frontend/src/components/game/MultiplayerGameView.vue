<template>
  <div class="game-view" :class="{ 'shake-screen': isShakeActive }">
    <!-- Shared Background Elements -->
    <GameBackground :direction="direction" />

    <!-- Top Bar: Opponent Info -->
    <SurveillanceBar>
      <div v-if="opponent" class="opponent-card" :class="{ active: !isMyTurn }">
        <div class="avatar" :class="{ 'avatar-active': !isMyTurn }">
          {{ opponent.name.charAt(0).toUpperCase() }}
        </div>
        <div class="opponent-info">
          <span class="name">{{ opponent.name }}</span>
          <span class="card-count">{{ opponentHandCount }} INTEL</span>
        </div>
        <div class="status-indicator" :class="{ active: !isMyTurn }"></div>
      </div>
    </SurveillanceBar>

    <!-- Main Game Table -->
    <BattlePit
      ref="battlePitRef"
      :show-draw-hint="isMyTurn && turnState === 'WAITING_FOR_ACTION'"
      :is-muted="soundEffects.isMuted.value"
      @draw="handleDraw"
      @toggle-sound="toggleSound"
    >
      <template #draw-pile>
        <CardPile :cards="deckDisplay" />
      </template>
      
      <template #discard-pile>
        <CardPile :cards="discardPile" :is-discard="true" :large="true" />
      </template>
      
      <template #status-panel>
        <StatusPanel
          :current-player-name="currentPlayerName"
          :direction="direction"
          :draw-stack="drawStack"
        />
      </template>
    </BattlePit>

    <!-- My Hand -->
    <div class="floating-hand-wrapper" ref="playerHandRef">
      <MultiplayerPlayerHand 
        v-if="visibleHand.length > 0 && showHand"
        :hand="visibleHand"
        :is-my-turn="isMyTurn"
        :current-color="currentColor"
        :top-card="topCard"
        :draw-stack="drawStack"
        @play-card="handlePlayCard"
      />
    </div>

    <!-- Player Console Bar -->
    <PlayerConsoleBar
      :player-name="myPlayer?.name || 'Unknown'"
      :card-count="myHand.length"
      :is-my-turn="isMyTurn"
      :show-uno-button="myHand.length === 2 && isMyTurn && !myPlayer?.has_called_uno"
      :show-leave-button="true"
      @call-uno="handleCallUno"
      @leave="leaveGame"
    />

    <!-- Animated Card Layer (for flying cards) -->
    <div class="animation-layer" ref="animationLayer"></div>

    <!-- Color Picker Modal (for regular Wild cards) -->
    <ColorPickerModal 
      v-if="showColorPicker"
      title="WILD CARD"
      subtitle="CHOOSE COLOR"
      @select="handleColorSelect"
    />

    <!-- Roulette Color Picker Modal (for victim choosing color) -->
    <ColorPickerModal 
      v-if="turnState === 'CHOOSING_ROULETTE_COLOR' && isMyTurn"
      title="ROULETTE TRAP DETECTED"
      subtitle="CHOOSE YOUR FATE"
      :is-roulette="true"
      @select="handleRouletteColorSelect"
    />

    <!-- Player Select Modal (for Number 7 swap - in 2P just shows opponent) -->
    <PlayerSelectModal
      v-if="turnState === 'CHOOSING_PLAYER_TO_SWAP' && isMyTurn && opponent"
      :eligible-players="[{ id: opponent.user_id, name: opponent.name, hand: (opponent.hand as Card[]) || [], isEliminated: false }]"
      @select="handleSwapPlayer"
    />

    <!-- Opponent Left -->
    <div v-if="opponentLeft" class="overlay">
      <div class="modal terminal-modal">
        <h1 class="glitch-text" data-text="DISCONNECTED">DISCONNECTED</h1>
        <p class="winner-text">OPPONENT LEFT THE GAME</p>
        <button @click="leaveGame" class="btn-primary">RETURN TO LOBBY</button>
      </div>
    </div>

    <!-- Game Over -->
    <div v-if="gameStatus === 'finished' && !opponentLeft" class="overlay">
      <div class="modal terminal-modal">
        <h1 class="glitch-text" data-text="GAME OVER">GAME OVER</h1>
        <p class="winner-text">VICTOR: {{ winnerName }}</p>
        <button @click="leaveGame" class="btn-primary">RETURN TO LOBBY</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, provide, onMounted } from 'vue'
import { useMultiplayerStore } from '../../stores/multiplayerStore'
import { useAuthStore } from '../../stores/authStore'
import { soundEffects } from '../../composables/useSoundEffects'
import { useCardAnimations } from '../../composables/useCardAnimations'
import CardPile from './CardPile.vue'
import MultiplayerPlayerHand from './MultiplayerPlayerHand.vue'
import ColorPickerModal from './ColorPickerModal.vue'
import PlayerSelectModal from './PlayerSelectModal.vue'
import GameBackground from './GameBackground.vue'
import SurveillanceBar from './SurveillanceBar.vue'
import BattlePit from './BattlePit.vue'
import StatusPanel from './StatusPanel.vue'
import PlayerConsoleBar from './PlayerConsoleBar.vue'
import type { Card, CardColor } from '../../types/card'

const mpStore = useMultiplayerStore()
const authStore = useAuthStore()
const { animateFlyingCard, animateDealCards, animateDrawCardsStaggered } = useCardAnimations()

const isShakeActive = ref(false)
const showColorPicker = ref(false)
const pendingCard = ref<Card | null>(null)

// Animation refs
const battlePitRef = ref<InstanceType<typeof BattlePit> | null>(null)
const discardAreaRef = computed(() => battlePitRef.value?.discardAreaRef || null)
const animationLayer = ref<HTMLElement | null>(null)
const playerHandRef = ref<HTMLElement | null>(null)

// Provide refs for child components
provide('discardAreaRef', discardAreaRef)
provide('animationLayer', animationLayer)

// Track previous hand sizes for animation detection
const prevMyHandLength = ref(0)
const prevOpponentHandLength = ref(0)

// Track if we're in initial deal animation mode
const isInitialDeal = ref(false)
const showHand = ref(false)  // Controls hand visibility during initial deal animation
const visibleCardCount = ref(0)  // How many cards to show (for progressive reveal during draw)

// Visible hand - only show cards up to visibleCardCount
const visibleHand = computed(() => {
  const hand = myHand.value
  // If not animating, show all cards
  if (visibleCardCount.value >= hand.length || visibleCardCount.value === 0) {
    return hand
  }
  // During animation, show only the visible portion
  return hand.slice(0, visibleCardCount.value)
})

// Computed from store
const myPlayer = computed(() => mpStore.myPlayer)
const opponent = computed(() => mpStore.opponent)
const myHand = computed(() => (myPlayer.value?.hand as Card[]) || [])
const opponentHandCount = computed(() => (opponent.value?.hand as Card[])?.length || 0)
const isMyTurn = computed(() => mpStore.isMyTurn)
const gameStatus = computed(() => mpStore.gameStatus)
const opponentLeft = computed(() => mpStore.opponentLeft)

const currentGame = computed(() => mpStore.currentGame)
const direction = computed(() => currentGame.value?.direction || 1)
const drawStack = computed(() => currentGame.value?.draw_stack || 0)
const currentColor = computed(() => (currentGame.value?.current_color || 'red') as CardColor)
const turnState = computed(() => currentGame.value?.turn_state || 'WAITING_FOR_ACTION')
const discardPile = computed(() => (currentGame.value?.discard_pile as Card[]) || [])
const topCard = computed(() => discardPile.value[discardPile.value.length - 1])

const currentPlayerName = computed(() => {
  if (!currentGame.value?.current_player_id) return 'Unknown'
  if (currentGame.value.current_player_id === authStore.user?.id) return 'You'
  return opponent.value?.name || 'Opponent'
})

const winnerName = computed(() => {
  if (!currentGame.value?.winner_id) return 'Unknown'
  if (currentGame.value.winner_id === authStore.user?.id) return 'YOU!'
  return opponent.value?.name || 'Opponent'
})

// Display deck (just show a placeholder array for the pile)
const deckDisplay = computed(() => {
  const count = (currentGame.value?.deck as any[])?.length || 0
  return Array(count).fill({ id: 'deck', color: 'wild', type: 'wild' })
})

// Watch for draw stack increases
watch(drawStack, (newVal, oldVal) => {
  if (newVal > oldVal && newVal >= 4) {
    isShakeActive.value = true
    setTimeout(() => isShakeActive.value = false, 500)
  }
})

// Flying card animation function - now async and syncs with card reveal
async function triggerDrawAnimation(targetEl: HTMLElement | null, count: number, startingVisibleCount: number): Promise<void> {
  const deckEl = document.querySelector('.draw-station .card-pile') as HTMLElement
  if (!targetEl || !deckEl) {
    // No animation possible, just show all cards
    visibleCardCount.value = startingVisibleCount + count
    return
  }

  // Animate each card one by one using composable
  for (let i = 0; i < count; i++) {
    // Play sound for this card
    soundEffects.playCardPick()

    // Animate using composable
    await animateFlyingCard(deckEl, targetEl, { duration: 0.3 })
    
    // Increment visible count so the real card appears
    visibleCardCount.value = startingVisibleCount + i + 1

    // Small delay between cards
    if (i < count - 1) {
      await new Promise(r => setTimeout(r, 50))
    }
  }
}

// Animate initial deal: deal cards one by one with staggered timing
async function animateInitialDeal(target: HTMLElement | null, cardCount: number): Promise<void> {
  const deckEl = document.querySelector('.draw-station .card-pile') as HTMLElement
  if (!target || !deckEl) return

  // Animate each card with sound played before animation
  for (let i = 0; i < cardCount; i++) {
    soundEffects.playCardPick()
    await animateFlyingCard(deckEl, target, { duration: 0.3 })
    
    // Small delay between cards
    if (i < cardCount - 1) {
      await new Promise(r => setTimeout(r, 80))
    }
  }
}

// Local flag to prevent duplicate initial deal animations
let hasRunInitialDealAnimation = false

// Watch for game status change to trigger initial deal animation
watch(gameStatus, async (newStatus, oldStatus) => {
  if (oldStatus === 'waiting' && newStatus === 'playing' && !hasRunInitialDealAnimation) {
    hasRunInitialDealAnimation = true
    isInitialDeal.value = true

    // Wait a moment for DOM to update
    await new Promise(r => setTimeout(r, 200))

    // Animate dealing to player hand
    const myHandCount = myHand.value.length
    if (myHandCount > 0 && playerHandRef.value) {
      console.log('Running initial deal animation for', myHandCount, 'cards')
      await animateInitialDeal(playerHandRef.value, myHandCount)
    }

    // Update tracking after initial deal
    prevMyHandLength.value = myHand.value.length
    prevOpponentHandLength.value = opponentHandCount.value

    isInitialDeal.value = false
  }
})

// Watch for my hand size increases to animate draws
// Use getter function to watch the length directly for more reliable detection
watch(
  () => myHand.value.length,
  (newLen, oldLen) => {
    console.log('myHand length changed:', oldLen, '->', newLen, 'isInitialDeal:', isInitialDeal.value)
    
    // Skip animation during initial deal animation
    if (isInitialDeal.value) {
      return
    }
    
    // Only animate if cards increased (a draw happened) and we had cards before
    if (newLen > (oldLen ?? 0) && (oldLen ?? 0) > 0) {
      const count = newLen - (oldLen ?? 0)
      console.log('🎴 Animating draw for player:', count, 'cards')
      // Set visible count to old value (freeze current display)
      const startingCount = oldLen ?? 0
      visibleCardCount.value = startingCount
      // Animate draw and progressively reveal cards
      triggerDrawAnimation(playerHandRef.value, count, startingCount)
    }
  }
)

// Watch for opponent hand size increases to animate their draws
// Note: Opponent animation is visual-only, we don't control their visible cards
watch(
  () => opponentHandCount.value,
  (newLen, oldLen) => {
    console.log('opponent hand length changed:', oldLen, '->', newLen)
    
    // Skip during initial deal
    if (isInitialDeal.value) {
      return
    }
    
    // Only animate if cards increased (we don't control opponent's visible count, just animate)
    if (newLen > (oldLen ?? 0) && (oldLen ?? 0) > 0) {
      const count = newLen - (oldLen ?? 0)
      console.log('🎴 Animating draw for opponent:', count, 'cards')
      // Target the opponent card area - just visual animation
      const opponentEl = document.querySelector('.opponent-card') as HTMLElement
      // For opponent, we don't sync with visibleCardCount since we don't control their hand display
      if (opponentEl) {
        triggerOpponentDrawAnimation(opponentEl, count)
      }
    }
  }
)

// Separate animation for opponent (visual only, no card reveal sync)
function triggerOpponentDrawAnimation(targetEl: HTMLElement, count: number) {
  const deckEl = document.querySelector('.draw-station .card-pile') as HTMLElement
  if (!targetEl || !deckEl) return

  // Play sound once for the draw action
  soundEffects.playCardPick()

  // Use composable for staggered animation (visual only)
  animateDrawCardsStaggered(deckEl, targetEl, count, {
    duration: 0.3,
    staggerDelay: 0.12
  })
}

// Initialize component and run initial deal animation if needed
onMounted(async () => {
  console.log('MultiplayerGameView mounted, gameStatus:', gameStatus.value, 'hand:', myHand.value.length)
  
  // If game is already playing and we have cards, run initial deal animation
  if (gameStatus.value === 'playing' && myHand.value.length > 0) {
    isInitialDeal.value = true
    showHand.value = false  // Hide cards initially
    
    // Wait for DOM to be ready
    await new Promise(r => setTimeout(r, 100))
    
    // Animate dealing cards to player hand
    const cardCount = myHand.value.length
    if (playerHandRef.value) {
      console.log('🎴 Running initial deal animation for', cardCount, 'cards')
      await animateInitialDeal(playerHandRef.value, cardCount)
    }
    
    // Show the real hand after animation
    showHand.value = true
    isInitialDeal.value = false
  } else {
    // No animation needed, just show hand
    showHand.value = true
  }
})

async function handlePlayCard(card: Card) {
  if (!isMyTurn.value) return
  
  // Check if wild card needs color selection
  if (card.color === 'wild' && card.type !== 'wildColorRoulette') {
    pendingCard.value = card
    showColorPicker.value = true
    return
  }
  
  soundEffects.playCardThrow()
  await mpStore.playCard(card)
  soundEffects.playCardLand()
}

async function handleColorSelect(color: CardColor) {
  showColorPicker.value = false
  if (pendingCard.value) {
    soundEffects.playCardThrow()
    await mpStore.playCard(pendingCard.value, color)
    soundEffects.playCardLand()
    pendingCard.value = null
  }
}

// Handler for roulette color selection (victim choosing their fate)
async function handleRouletteColorSelect(color: CardColor) {
  await mpStore.setRouletteColor(color)
}

// Handler for player swap (Number 7 card)
async function handleSwapPlayer(playerId: string) {
  await mpStore.swapHands(playerId)
}

async function handleDraw() {
  if (!isMyTurn.value) return
  // Sound is now played by the animation watcher
  await mpStore.drawCard()
}

async function handleCallUno() {
  soundEffects.announceTurn("UNO!")
  await mpStore.callUno()
}

function toggleSound() {
  soundEffects.toggleMute()
}

async function leaveGame() {
  await mpStore.leaveGame()
}
</script>

<style>
@import '../../assets/game-shared.css';
</style>

<style scoped>
/* Component-specific styles only - most styles are in game-shared.css */
</style>
